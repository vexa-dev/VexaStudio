-- C21: vistas member_monthly_summary y member_points (paridad con packages/domain/src/rules.ts
-- y time-activity.ts). Nada de esto se calcula en el frontend.
--
-- Mismas reglas que el mock (apps/web/src/services/mock/dashboard.ts):
--   * Participan los perfiles activos con rol admin o socio.
--   * Puntos por horas = horas x points_per_hour, solo horas validadas, no pagadas y no anuladas.
--   * Puntos por dinero = monto x points_per_sol, solo gastos en PEN aprobados, no reembolsados
--     y no previos a la firma (rules.expensePoints no convierte USD).
--   * Participacion = puntos del socio / puntos totales (0 si no hay puntos).
--   * Horas del mes (Lima): registros finalizados, vigentes y fuera de borradores. Con origen
--     (`source`) se reparten por segmentos y se recortan al mes; sin origen cuentan completos
--     en el dia de inicio (time-activity.monthlyActivity).
--   * Minimo = round(horas_semana x semanas_mes x %minimo - horas_de_ausencias, 2), no negativo.
--     Cumple si horas >= minimo; con minimo 0 se considera cumplido (cumplimiento 1).
-- Las vistas usan security_invoker: aplican el RLS de quien consulta. Ademas, solo socios y
-- admin reciben filas (el dashboard de equity no es para colaboradores).

-- Resumen de un mes `YYYY-MM` (Lima) para todos los socios.
create function public.monthly_summary(p_month text)
returns table (
  user_id uuid,
  month text,
  hours numeric,
  minimum_hours numeric,
  compliance numeric,
  meets_minimum boolean
)
language plpgsql stable security invoker set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mes no valido: usa YYYY-MM';
  end if;
  if not public.is_partner_or_admin() then
    return;
  end if;
  return query
  with b as (
    select ((p_month || '-01')::date)::timestamp at time zone 'America/Lima' as t_from,
           (((p_month || '-01')::date + interval '1 month'))::timestamp
             at time zone 'America/Lima' as t_to
  ),
  entries as (
    select e.id, e.user_id, e.hours, e.source, e.started_at,
           case when jsonb_array_length(coalesce(e.segments, '[]'::jsonb)) > 0 then e.segments
                else jsonb_build_array(jsonb_build_object('start', e.started_at, 'end', e.ended_at))
           end as segs
    from public.time_entries e
    where not e.draft and e.voided_at is null and e.ended_at is not null and e.hours > 0
  ),
  segs as (
    select en.id, en.user_id, en.hours,
           (s ->> 'start')::timestamptz as s_start, (s ->> 'end')::timestamptz as s_end
    from entries en cross join lateral jsonb_array_elements(en.segs) s
    where en.source is not null
  ),
  timed as (
    select g.user_id,
           case when g.total_s > 0 then
             greatest(0, extract(epoch from least(g.s_end, b.t_to) - greatest(g.s_start, b.t_from)))
             / g.total_s * g.hours
           else 0 end as h
    from (
      select sg.*, sum(greatest(0, extract(epoch from sg.s_end - sg.s_start)))
                     over (partition by sg.id) as total_s
      from segs sg
    ) g cross join b
  ),
  legacy as (
    select en.user_id, en.hours as h
    from entries en
    where en.source is null
      and to_char(en.started_at at time zone 'America/Lima', 'YYYY-MM') = p_month
  ),
  month_hours as (
    select u.user_id, sum(u.h) as h from (
      select * from timed union all select * from legacy
    ) u group by u.user_id
  ),
  reduced as (
    select a.user_id, sum(a.reduced_hours) as h
    from public.absences a
    where to_char(a.from_date, 'YYYY-MM') = p_month
    group by a.user_id
  ),
  base as (
    select p.id as uid,
           coalesce(mh.h, 0) as hrs,
           greatest(0, round(
             p.weekly_hours * st.weeks_per_month * st.min_compliance - coalesce(r.h, 0), 2
           )) as minimum
    from public.profiles p
    cross join public.settings st
    left join month_hours mh on mh.user_id = p.id
    left join reduced r on r.user_id = p.id
    where p.active and p.role <> 'collaborator'
  )
  select base.uid, p_month, base.hrs, base.minimum,
         case when base.minimum <= 0 then 1::numeric else base.hrs / base.minimum end,
         case when base.minimum <= 0 then true else base.hrs >= base.minimum end
  from base
  order by base.uid;
end;
$$;

-- Un renglon por socio y mes, desde el primer mes con actividad hasta el mes actual (Lima).
-- Para un mes concreto fuera de ese rango, usar public.monthly_summary('YYYY-MM').
create view public.member_monthly_summary with (security_invoker = true) as
select s.user_id, s.month, s.hours, s.minimum_hours, s.compliance, s.meets_minimum
from (
  select to_char(d, 'YYYY-MM') as month
  from generate_series(
    date_trunc('month', least(
      coalesce((select min(e.started_at at time zone 'America/Lima') from public.time_entries e),
               now() at time zone 'America/Lima'),
      coalesce((select min(a.from_date)::timestamp from public.absences a),
               now() at time zone 'America/Lima'),
      now() at time zone 'America/Lima'
    )),
    date_trunc('month', now() at time zone 'America/Lima'),
    interval '1 month'
  ) d
) m
cross join lateral public.monthly_summary(m.month) s;

create view public.member_points with (security_invoker = true) as
with partners as (
  select p.id as user_id from public.profiles p where p.active and p.role <> 'collaborator'
),
hour_pts as (
  select e.user_id, sum(e.hours * st.points_per_hour) as pts
  from public.time_entries e cross join public.settings st
  where not e.paid and e.validated and e.voided_at is null
  group by e.user_id
),
money_pts as (
  select x.paid_by as user_id, sum(x.amount * st.points_per_sol) as pts
  from public.expenses x cross join public.settings st
  where x.currency = 'PEN' and x.status = 'approved'
    and not x.reimbursed and not x.before_signing
  group by x.paid_by
),
per_member as (
  select pa.user_id,
         coalesce(h.pts, 0) as hour_points,
         coalesce(m.pts, 0) as money_points
  from partners pa
  left join hour_pts h on h.user_id = pa.user_id
  left join money_pts m on m.user_id = pa.user_id
),
total as (
  select coalesce(sum(hour_points + money_points), 0) as pts from per_member
)
select pm.user_id,
       pm.hour_points,
       pm.money_points,
       pm.hour_points + pm.money_points as total_points,
       case when t.pts = 0 then 0::numeric
            else (pm.hour_points + pm.money_points) / t.pts end as participation
from per_member pm cross join total t
where public.is_partner_or_admin();

revoke all on public.member_monthly_summary, public.member_points from public, anon, authenticated;
grant select on public.member_monthly_summary, public.member_points to authenticated;
revoke execute on function public.monthly_summary(text) from public, anon;
grant execute on function public.monthly_summary(text) to authenticated;
