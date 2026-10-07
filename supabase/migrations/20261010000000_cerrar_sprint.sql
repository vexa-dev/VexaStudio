-- M5: cerrar sprint. Solo el admin cierra un sprint activo; en una sola transaccion valida en bloque las
-- horas elegidas (las bloquea), guarda el reporte de entrega (comprometido vs entregado por persona),
-- manda al backlog las tareas sin terminar y marca el sprint como cerrado.
--
-- La funcion es SECURITY INVOKER: todo pasa por el RLS de quien llama. Para fijar a la vez los sellos de
-- revision y el bloqueo usa `vexa.internal` (como `reset_review_on_children_change`) y repite adentro las
-- reglas de `validate_hours` (sin autoaprobacion, sin etiquetados, solo registros vigentes).
-- Eventos de actividad: cada hora aprobada (hours.approved) y cada tarea movida al backlog (task.edited) ya
-- quedan en audit_log por sus triggers; el cierre en si no tiene tipo de evento propio todavia.

alter table public.sprints
  add column closed_at timestamptz,
  add column closed_by uuid references public.profiles (id),
  -- {"partners": [...], "pendingEntryIds": [...]} (camelCase, como SprintPartnerReport).
  add column close_report jsonb
    constraint sprints_close_report_check check (close_report is null or jsonb_typeof(close_report) = 'object');

-- Registro validado y bloqueado por el cierre de este sprint: ya no se edita ni se re-etiqueta.
alter table public.time_entries
  add column locked_by_sprint uuid references public.sprints (id);
create index time_entries_locked_by_sprint_idx on public.time_entries (locked_by_sprint)
  where locked_by_sprint is not null;

-- Horas de un registro que caen en las tareas dadas (igual que entryHoursInSprint del dominio).
create function private.entry_sprint_hours(
  p_task uuid, p_hours numeric, p_allocations jsonb, p_tasks uuid[]
) returns numeric
language sql immutable set search_path = ''
as $$
  select case
    when p_task = any (p_tasks) then p_hours
    when p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then 0
    else coalesce((
      select round(sum((a ->> 'hours')::numeric), 2)
      from jsonb_array_elements(p_allocations) a
      where (a ->> 'taskId')::uuid = any (p_tasks)
    ), 0)
  end
$$;
grant execute on function private.entry_sprint_hours(uuid, numeric, jsonb, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Bloqueo: un registro validado en el cierre no cambia desde el cliente
-- ---------------------------------------------------------------------------
create function private.time_entries_sprint_lock_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select auth.uid()) is null or coalesce(current_setting('vexa.internal', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.locked_by_sprint is not null then
      raise exception 'El bloqueo lo fija el cierre de sprint' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.locked_by_sprint is not null or new.locked_by_sprint is distinct from old.locked_by_sprint then
    raise exception 'Este registro quedo bloqueado por el cierre de sprint' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger time_entries_sprint_lock_guard before insert or update on public.time_entries
  for each row execute function private.time_entries_sprint_lock_guard();

-- Etiquetas y archivos de un registro bloqueado tampoco cambian (alterarian los puntos acreditados).
create function private.sprint_lock_children_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_entry uuid := case tg_op when 'DELETE' then old.entry_id else new.entry_id end;
begin
  if (select auth.uid()) is null or coalesce(current_setting('vexa.internal', true), '') = 'on' then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  if exists (select 1 from public.time_entries e where e.id = v_entry and e.locked_by_sprint is not null) then
    raise exception 'Este registro quedo bloqueado por el cierre de sprint' using errcode = '42501';
  end if;
  return case tg_op when 'DELETE' then old else new end;
end;
$$;
revoke execute on function private.sprint_lock_children_guard() from public, anon, authenticated;
create trigger participants_sprint_lock before insert or update or delete on public.time_entry_participants
  for each row execute function private.sprint_lock_children_guard();
-- Con archivos solo se bloquea agregar: retirar uno vencido (liberar espacio) sigue permitido.
create trigger evidence_sprint_lock before insert on public.time_entry_evidence
  for each row execute function private.sprint_lock_children_guard();

-- Quitar un archivo de un registro bloqueado no le retira la aprobacion (misma funcion + una condicion).
create or replace function private.reset_review_on_children_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('vexa.internal', true), '');
  v_entry uuid := case tg_op when 'DELETE' then old.entry_id else new.entry_id end;
begin
  if (select auth.uid()) is null or v_prev = 'on' then
    return null;
  end if;
  perform set_config('vexa.internal', 'on', true);
  update public.time_entries set
    validated = false, validated_at = null, validated_by = null, reviewed_by = null
  where id = v_entry and validated and voided_at is null and not paid and locked_by_sprint is null;
  perform set_config('vexa.internal', v_prev, true);
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- SprintService.close
-- ---------------------------------------------------------------------------
create function public.close_sprint(p_sprint uuid, p_entry_ids uuid[] default '{}')
returns public.sprints
language plpgsql security invoker set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_prev text := coalesce(current_setting('vexa.internal', true), '');
  v_ids uuid[] := (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(p_entry_ids, '{}')) x);
  v_id uuid;
  v_tasks uuid[];
  v_partners jsonb;
  v_pending uuid[];
  s public.sprints;
  e public.time_entries;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cerrar un sprint' using errcode = '42501';
  end if;
  select * into s from public.sprints where id = p_sprint for update;
  if not found then
    raise exception 'El sprint no existe';
  end if;
  if s.status <> 'active' then
    raise exception 'Solo se puede cerrar un sprint activo';
  end if;
  select coalesce(array_agg(t.id), '{}') into v_tasks from public.tasks t where t.sprint_id = p_sprint;

  foreach v_id in array v_ids loop
    select * into e from public.time_entries where id = v_id;
    if not found or e.draft or e.voided_at is not null or e.ended_at is null or e.hours <= 0 then
      raise exception 'Solo se validan registros finalizados y vigentes';
    end if;
    if private.entry_sprint_hours(e.task_id, e.hours, e.allocations, v_tasks) <= 0 then
      raise exception 'El registro no pertenece a este sprint';
    end if;
    if e.paid then
      raise exception 'El registro ya esta pagado';
    end if;
    if e.validated then
      raise exception 'El registro ya esta aprobado';
    end if;
    if e.user_id = v_uid then
      raise exception 'No puedes aprobar tus propias horas';
    end if;
    if exists (select 1 from public.time_entry_participants p where p.entry_id = v_id and p.user_id = v_uid) then
      raise exception 'No puedes aprobar horas en las que estas etiquetado';
    end if;
  end loop;

  perform set_config('vexa.internal', 'on', true);
  update public.time_entries set
    validated = true, validated_at = clock_timestamp(), validated_by = v_uid,
    reviewed_by = v_uid, review_note = null, locked_by_sprint = p_sprint
  where id = any (v_ids);
  perform set_config('vexa.internal', v_prev, true);

  -- Reporte de entrega: comprometido vs entregado y horas estimadas vs registradas, por persona.
  select coalesce(jsonb_agg(jsonb_build_object(
      'userId', r.user_id, 'committed', r.committed, 'delivered', r.delivered,
      'estimatedHours', round(r.estimated, 2), 'loggedHours', round(r.logged, 2)
    ) order by r.user_id nulls last), '[]'::jsonb)
  into v_partners
  from (
    select x.user_id, sum(x.committed)::int as committed, sum(x.delivered)::int as delivered,
           sum(x.estimated) as estimated, sum(x.logged) as logged
    from (
      select t.assignee_id as user_id, 1 as committed, (t.status = 'done')::int as delivered,
             coalesce(t.estimate_hours, 0) as estimated, 0::numeric as logged
      from public.tasks t where t.sprint_id = p_sprint
      union all
      select te.user_id, 0, 0, 0::numeric,
             private.entry_sprint_hours(te.task_id, te.hours, te.allocations, v_tasks)
      from public.time_entries te
      where not te.draft and te.voided_at is null and te.ended_at is not null and te.hours > 0
        and private.entry_sprint_hours(te.task_id, te.hours, te.allocations, v_tasks) > 0
    ) x
    group by x.user_id
  ) r;

  -- Horas del sprint que siguen pendientes (la via de objecion es la solicitud de aclaracion).
  select coalesce(array_agg(te.id order by te.started_at, te.id), '{}') into v_pending
  from public.time_entries te
  where not te.draft and te.voided_at is null and te.ended_at is not null and te.hours > 0
    and not te.validated and not te.paid
    and private.entry_sprint_hours(te.task_id, te.hours, te.allocations, v_tasks) > 0;

  -- Lo que no se termino vuelve al backlog.
  update public.tasks set sprint_id = null where sprint_id = p_sprint and status <> 'done';

  update public.sprints set
    status = 'closed', closed_at = clock_timestamp(), closed_by = v_uid,
    close_report = jsonb_build_object('partners', v_partners, 'pendingEntryIds', to_jsonb(v_pending))
  where id = p_sprint
  returning * into s;
  return s;
end;
$$;
revoke execute on function public.close_sprint(uuid, uuid[]) from public, anon;
grant execute on function public.close_sprint(uuid, uuid[]) to authenticated;
