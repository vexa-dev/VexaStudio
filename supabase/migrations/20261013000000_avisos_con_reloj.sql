-- M6: avisos con reloj (daily pendiente, horas sin registrar, renovaciones y resultado de gasto).
--
-- Los cuatro tipos ya estaban en el enum `notification_type`; aqui se crea su origen:
--   * daily_pending  - socios y admin sin daily del dia (Lima), en los dias de settings.daily_reminder_weekdays
--                      (por defecto lun, mie y vie) a las 21:00 de Lima.
--   * hours_missing  - socios y admin con menos horas que su meta semanal (profiles.weekly_hours) en la semana
--                      lun-dom de Lima, el dia de settings.weekly_hours_reminder_weekday (domingo) 20:00 Lima.
--                      Respeta notification_preferences.hours_reminder.
--   * renewal        - a los administradores, cuando un gasto recurrente renueva en exactamente 30 o 7 dias (Lima).
--   * expense_result - a quien pago, cuando su gasto pasa a aprobado, rechazado o anulado (trigger, sin reloj).
--
-- Planificador: pg_cron corre en UTC. Lima es UTC-5 todo el ano (sin horario de verano), asi que:
--   21:00 Lima = 02:00 UTC del dia siguiente  -> vexa_daily_pending  `0 2 * * *`
--   20:00 Lima = 01:00 UTC del dia siguiente  -> vexa_hours_missing   `0 1 * * *`
--   09:00 Lima = 14:00 UTC                    -> vexa_renewals        `0 14 * * *`
-- El trabajo diario se dispara todos los dias y la funcion decide por el dia de la semana (Lima) que dice
-- `settings`, de modo que cambiar los dias en Ajustes no exige reprogramar. La HORA si es fija: cambiarla
-- en settings no mueve el trabajo (habria que reprogramar con cron.schedule).
--
-- Idempotencia: cada aviso lleva `payload.dedupeKey` y un indice unico parcial impide repetirlo, asi que
-- ejecutar una funcion dos veces (o reintentar un trabajo) no duplica nada. Sin tablas nuevas.
--
-- Pruebas: cada generador acepta `p_now` (por defecto now()) para simular el reloj; pgTAP nunca espera al cron.
-- Despliegue: habilitar `pg_cron` en el Dashboard (Database > Extensions) ANTES de `supabase db push`.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Dedupe
-- ---------------------------------------------------------------------------
create unique index notifications_dedupe_uidx
  on public.notifications (user_id, type, ((payload ->> 'dedupeKey')))
  where payload ? 'dedupeKey';

-- Como private.notify, pero idempotente por `p_key`. Devuelve true si creo el aviso.
create function private.notify_once(
  p_user uuid, p_type public.notification_type, p_payload jsonb, p_key text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_created boolean;
begin
  if p_user is null or p_key is null
     or not exists (select 1 from public.profiles p where p.id = p_user and p.active) then
    return false;
  end if;
  insert into public.notifications (user_id, type, payload)
  values (p_user, p_type, coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('dedupeKey', p_key))
  on conflict do nothing;
  get diagnostics v_created = row_count;
  return v_created;
end;
$$;
revoke execute on function private.notify_once(uuid, public.notification_type, jsonb, text)
  from public, anon, authenticated;

create function private.money_label(p_currency public.currency_code, p_amount numeric) returns text
language sql immutable strict set search_path = ''
as $$
  select case p_currency when 'PEN' then 'S/ ' else 'US$ ' end || to_char(p_amount, 'FM999,999,990.00')
$$;
revoke execute on function private.money_label(public.currency_code, numeric)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- daily_pending
-- ---------------------------------------------------------------------------
create function private.generate_daily_pending(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'America/Lima')::date;
  v_total integer := 0;
  v_user record;
begin
  if not exists (
    select 1 from public.settings s
    where extract(dow from v_today)::smallint = any (s.daily_reminder_weekdays)
  ) then
    return 0;
  end if;

  for v_user in
    select p.id, p.name from public.profiles p
    where p.active and p.role in ('admin', 'partner')
      and not exists (select 1 from public.daily_updates d where d.user_id = p.id and d.date = v_today)
  loop
    if private.notify_once(v_user.id, 'daily_pending', jsonb_build_object(
      'title', 'Falta tu daily de hoy',
      'message', 'Aún no registras tu daily del ' || to_char(v_today, 'DD/MM/YYYY') || '.',
      'recipientName', left(v_user.name, 120),
      'details', 'La daily es asíncrona: cuenta qué hiciste, qué harás y si algo te bloquea.',
      'nextStep', 'Abre Mi día y registra tu daily.',
      'route', '/mi-dia',
      'date', v_today::text
    ), 'daily_pending:' || v_today::text) then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$$;
revoke execute on function private.generate_daily_pending(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- hours_missing
-- ---------------------------------------------------------------------------
-- Horas de la semana (lun-dom, Lima): registros finalizados, vigentes y fuera de borradores, contados en el
-- dia de inicio (misma simplificacion que los registros sin origen de la vista mensual). No descuenta
-- ausencias ni suma el credito por etiquetas.
create function private.generate_hours_missing(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'America/Lima')::date;
  v_week_start date := date_trunc('week', ((p_now at time zone 'America/Lima')::date)::timestamp)::date;
  v_total integer := 0;
  v_user record;
begin
  if not exists (
    select 1 from public.settings s where extract(dow from v_today)::smallint = s.weekly_hours_reminder_weekday
  ) then
    return 0;
  end if;

  for v_user in
    select p.id, p.name, p.weekly_hours, coalesce(sum(e.hours), 0) as logged
    from public.profiles p
    left join public.time_entries e
      on e.user_id = p.id and not e.draft and e.voided_at is null and e.ended_at is not null
     and (e.started_at at time zone 'America/Lima')::date >= v_week_start
     and (e.started_at at time zone 'America/Lima')::date < v_week_start + 7
    where p.active and p.role in ('admin', 'partner')
      and coalesce((select np.hours_reminder from public.notification_preferences np where np.user_id = p.id), true)
    group by p.id, p.name, p.weekly_hours
    having coalesce(sum(e.hours), 0) < p.weekly_hours
  loop
    if private.notify_once(v_user.id, 'hours_missing', jsonb_build_object(
      'title', 'Te faltan horas esta semana',
      'message', 'Llevas ' || round(v_user.logged, 1)::text || ' h de ' || v_user.weekly_hours::text
        || ' h de tu meta semanal.',
      'recipientName', left(v_user.name, 120),
      'details', 'Revisa que tus horas de la semana estén registradas y confirmadas.',
      'nextStep', 'Abre Horas y registra o confirma lo que falta.',
      'route', '/horas',
      'weekStart', v_week_start::text
    ), 'hours_missing:' || v_week_start::text) then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$$;
revoke execute on function private.generate_hours_missing(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- renewal
-- ---------------------------------------------------------------------------
-- recurring_expenses no guarda quien paga: el aviso va a los administradores activos.
create function private.generate_renewals(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'America/Lima')::date;
  v_total integer := 0;
  v_row record;
begin
  for v_row in
    select r.id, r.concept, r.amount, r.currency, r.next_date, (r.next_date - v_today) as days_left,
           a.id as admin_id, a.name as admin_name
    from public.recurring_expenses r
    cross join public.profiles a
    where (r.next_date - v_today) in (30, 7) and a.active and a.role = 'admin'
  loop
    if private.notify_once(v_row.admin_id, 'renewal', jsonb_build_object(
      'title', 'Se acerca una renovación',
      'message', '«' || left(v_row.concept, 120) || '» (' || private.money_label(v_row.currency, v_row.amount)
        || ') renueva en ' || v_row.days_left::text || ' días, el ' || to_char(v_row.next_date, 'DD/MM/YYYY') || '.',
      'recipientName', left(v_row.admin_name, 120),
      'expenseTitle', left(v_row.concept, 200),
      'amount', private.money_label(v_row.currency, v_row.amount),
      'details', 'Es un gasto recurrente: confirma que habrá saldo y quién lo pagará.',
      'nextStep', 'Abre Gastos y revisa los gastos recurrentes.',
      'route', '/gastos',
      'nextDate', v_row.next_date::text
    ), 'renewal:' || v_row.id::text || ':' || v_row.days_left::text || ':' || v_row.next_date::text) then
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$$;
revoke execute on function private.generate_renewals(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- expense_result (trigger)
-- ---------------------------------------------------------------------------
-- El trigger no usa "update of status": la anulacion cambia el estado desde la guarda BEFORE, no desde el SET.
-- Una carga de sistema sin sesion (seed, mantenimiento) no avisa a nadie: todo resultado real nace de un
-- voto o de una anulacion hechos por una persona (auth.uid() no nulo).
create function private.notify_expense_result() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_payer public.profiles;
  v_label text;
begin
  if (select auth.uid()) is null then
    return null;
  end if;
  select * into v_payer from public.profiles p where p.id = new.paid_by;
  v_label := case new.status when 'approved' then 'aprobado' when 'rejected' then 'rechazado'
    else 'anulado' end;

  perform private.notify_once(new.paid_by, 'expense_result', jsonb_build_object(
    'title', 'Tu gasto fue ' || v_label,
    'message', '«' || left(new.concept, 120) || '» por ' || private.money_label(new.currency, new.amount)
      || ' fue ' || v_label || '.',
    'recipientName', left(v_payer.name, 120),
    'expenseId', new.id::text,
    'expenseTitle', left(new.concept, 200),
    'amount', private.money_label(new.currency, new.amount),
    'details', case new.status
      when 'approved' then 'El gasto reunió los votos necesarios y ya cuenta en el dashboard.'
      when 'rejected' then 'El gasto ya no podía alcanzar los 3 votos a favor.'
      else 'El gasto se anuló con motivo y ya no cuenta.' end,
    'nextStep', 'Abre Gastos para ver el detalle.',
    'route', '/gastos'
  ), 'expense_result:' || new.id::text || ':' || new.status::text);
  return null;
end;
$$;
create trigger notify_expenses_result after update on public.expenses
  for each row
  when (old.status is distinct from new.status and new.status in ('approved', 'rejected', 'voided'))
  execute function private.notify_expense_result();
revoke execute on function private.notify_expense_result() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Planificador (trabajos con nombre: cron.schedule reemplaza el existente, es idempotente)
-- ---------------------------------------------------------------------------
select cron.schedule('vexa_daily_pending', '0 2 * * *', 'select private.generate_daily_pending()');
select cron.schedule('vexa_hours_missing', '0 1 * * *', 'select private.generate_hours_missing()');
select cron.schedule('vexa_renewals', '0 14 * * *', 'select private.generate_renewals()');
