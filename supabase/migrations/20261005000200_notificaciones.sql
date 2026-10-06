-- C28: notificaciones en la app (B4).
--
-- Los avisos son datos derivados: solo los crean triggers (via `private.notify`) y el cliente
-- nunca inserta ni borra. Cada persona lee los suyos y solo puede cambiar `read_at` (privilegio de
-- columna + trigger guarda). Llegan en vivo por Realtime (`postgres_changes` aplica el RLS de
-- lectura). No llevan trigger de auditoria porque son consecuencia de eventos ya auditados.
--
-- Eventos implementados: project_added, task_assigned y expense_vote. El resto de tipos del
-- dominio queda en el enum para que el front y la base vayan alineados, pero se activan cuando
-- exista su origen (daily, recordatorios con planificador, resultado de gasto, menciones,
-- renovaciones y reuniones).
--
-- Las claves de `payload` son las que lee `NotificationMenu`: title, message, actorName,
-- actorRole, recipientName, projectName, projectId, taskName, taskId, memberRole, details,
-- nextStep (mas expenseId, expenseTitle y amount para gastos). Todas son texto.

-- ---------------------------------------------------------------------------
-- Tipo y tabla
-- ---------------------------------------------------------------------------
create type public.notification_type as enum (
  'project_added', 'task_assigned', 'daily_pending', 'hours_missing', 'expense_vote',
  'expense_result', 'mention', 'renewal', 'meeting'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  type public.notification_type not null,
  payload jsonb not null default '{}'
    constraint notifications_payload_size_check check (pg_column_size(payload) < 2048),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Privilegios y RLS: leer lo propio y marcar `read_at`; nada mas
-- ---------------------------------------------------------------------------
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and public.auth_role() is not null);
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and public.auth_role() is not null)
  with check (user_id = (select auth.uid()) and public.auth_role() is not null);

-- ---------------------------------------------------------------------------
-- Guarda: solo cambia read_at, de pendiente a leido y sin fechas futuras
-- ---------------------------------------------------------------------------
create function private.notifications_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.id, new.user_id, new.type, new.payload, new.created_at)
     is distinct from (old.id, old.user_id, old.type, old.payload, old.created_at) then
    raise exception 'Una notificacion solo puede cambiar read_at' using errcode = '42501';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'La notificacion ya fue revisada' using errcode = '42501';
  end if;
  if new.read_at is not null and new.read_at > clock_timestamp() then
    raise exception 'read_at no puede estar en el futuro' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger notifications_guard before update on public.notifications
  for each row execute function private.notifications_guard();
revoke execute on function private.notifications_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Emision: unica via de escritura
-- ---------------------------------------------------------------------------
-- Inserta como propietaria. Ignora destinatarios nulos o inactivos y devuelve el id creado.
create function private.notify(
  p_user uuid, p_type public.notification_type, p_payload jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_user is null
     or not exists (select 1 from public.profiles p where p.id = p_user and p.active) then
    return null;
  end if;
  insert into public.notifications (user_id, type, payload)
  values (p_user, p_type, coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function private.notify(uuid, public.notification_type, jsonb)
  from public, anon, authenticated;

-- Etiqueta visible del rol (la usa la ficha de detalle del menu).
create function private.notify_role_label(p_role public.user_role) returns text
language sql immutable strict set search_path = ''
as $$
  select case p_role when 'admin' then 'Administrador' when 'partner' then 'Socio'
    else 'Integrante del equipo' end
$$;
revoke execute on function private.notify_role_label(public.user_role) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Evento: alguien se agrega a un proyecto
-- ---------------------------------------------------------------------------
create function private.notify_project_member_added() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_actor public.profiles;
  v_recipient text;
  v_project text;
begin
  if new.user_id is not distinct from v_uid then
    return null;
  end if;
  select * into v_actor from public.profiles p where p.id = v_uid;
  select p.name into v_recipient from public.profiles p where p.id = new.user_id;
  select left(pr.name, 120) into v_project from public.projects pr where pr.id = new.project_id;

  perform private.notify(new.user_id, 'project_added', jsonb_strip_nulls(jsonb_build_object(
    'title', 'Te agregaron a un proyecto',
    'message', case when v_actor.id is null then 'Te agregaron a ' || v_project || ' como integrante.'
      else left(v_actor.name, 120) || ' te agregó a ' || v_project || ' como integrante.' end,
    'actorName', left(v_actor.name, 120),
    'actorRole', private.notify_role_label(v_actor.role),
    'recipientName', left(v_recipient, 120),
    'projectName', v_project,
    'projectId', new.project_id::text,
    'memberRole', 'Integrante',
    'details', 'Ya formas parte del equipo del proyecto. Puedes consultar su tablero y las tareas en las que trabaja el equipo.',
    'nextStep', 'Abre el proyecto y revisa el tablero para conocer el contexto de tu participación.'
  )));
  return null;
end;
$$;
create trigger notify_project_members_added after insert on public.project_members
  for each row execute function private.notify_project_member_added();
revoke execute on function private.notify_project_member_added() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Evento: una tarea se asigna (al crearla o al cambiar el responsable)
-- ---------------------------------------------------------------------------
create function private.notify_task_assigned() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_actor public.profiles;
  v_recipient text;
  v_project text;
  v_title text := left(new.title, 120);
begin
  if new.assignee_id is null or new.assignee_id is not distinct from v_uid then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return null;
  end if;
  select * into v_actor from public.profiles p where p.id = v_uid;
  select p.name into v_recipient from public.profiles p where p.id = new.assignee_id;
  select left(pr.name, 120) into v_project from public.projects pr where pr.id = new.project_id;

  perform private.notify(new.assignee_id, 'task_assigned', jsonb_strip_nulls(jsonb_build_object(
    'title', 'Tienes una nueva tarea asignada',
    'message', case when v_actor.id is null then 'Te asignaron «' || v_title || '».'
      else left(v_actor.name, 120) || ' te asignó «' || v_title || '».' end,
    'actorName', left(v_actor.name, 120),
    'actorRole', private.notify_role_label(v_actor.role),
    'recipientName', left(v_recipient, 120),
    'projectName', v_project,
    'projectId', new.project_id::text,
    'taskName', left(new.title, 200),
    'taskId', new.id::text,
    'details', 'Revisa los requisitos, identifica dudas y prepara tus observaciones antes de comenzar el trabajo.',
    'nextStep', 'Ve a Mis tareas para consultar tus asignaciones.'
  )));
  return null;
end;
$$;
create trigger notify_tasks_assigned after insert or update of assignee_id on public.tasks
  for each row execute function private.notify_task_assigned();
revoke execute on function private.notify_task_assigned() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Evento: un gasto nuevo necesita votos (a admin y socios activos, menos quien lo pago)
-- ---------------------------------------------------------------------------
create function private.notify_expense_pending() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_payer public.profiles;
  v_amount text;
  v_voter record;
begin
  if new.status <> 'pending' then
    return null;
  end if;
  select * into v_payer from public.profiles p where p.id = new.paid_by;
  v_amount := case new.currency::text when 'PEN' then 'S/ ' when 'USD' then 'US$ '
    else new.currency::text || ' ' end || new.amount::text;

  for v_voter in
    select p.id, p.name from public.profiles p
    where p.active and p.role in ('admin', 'partner') and p.id <> new.paid_by
  loop
    perform private.notify(v_voter.id, 'expense_vote', jsonb_strip_nulls(jsonb_build_object(
      'title', 'Un gasto espera tu voto',
      'message', left(v_payer.name, 120) || ' registró «' || left(new.concept, 120) || '» por ' || v_amount || '.',
      'actorName', left(v_payer.name, 120),
      'actorRole', private.notify_role_label(v_payer.role),
      'recipientName', left(v_voter.name, 120),
      'expenseId', new.id::text,
      'expenseTitle', left(new.concept, 200),
      'amount', v_amount,
      'details', 'Los gastos sobre el límite necesitan 3 votos a favor para aprobarse.',
      'nextStep', 'Abre Gastos y registra tu voto.'
    )));
  end loop;
  return null;
end;
$$;
create trigger notify_expenses_vote after insert on public.expenses
  for each row execute function private.notify_expense_pending();
revoke execute on function private.notify_expense_pending() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: marcar como leido (SECURITY INVOKER: usan el privilegio de columna y la politica)
-- ---------------------------------------------------------------------------
create function public.mark_notification_read(p_id uuid) returns boolean
language plpgsql set search_path = ''
as $$
begin
  update public.notifications set read_at = now()
  where id = p_id and user_id = (select auth.uid()) and read_at is null;
  return found;
end;
$$;

create function public.mark_all_notifications_read() returns integer
language plpgsql set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
