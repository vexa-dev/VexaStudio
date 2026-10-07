-- Convocatoria de la reunion semanal (M4).
--
--   * Una convocatoria por semana de Lima (`week` = lunes). Estados: polling -> confirmed -> held
--     (`cancelled` existe en el tipo pero ninguna accion lo usa todavia).
--   * Lectura: admin y socios. Un colaborador no ve nada. Nadie borra.
--   * Proponer (solo admin, el product owner): `propose_meeting(slots)` crea la convocatoria y sus 2 o 3
--     horarios (futuros, distintos, de una sola semana de Lima que sea la actual o la siguiente). Es el unico
--     camino de INSERT: las tablas no tienen INSERT para authenticated. La implementacion es SECURITY DEFINER
--     en `private` y el envoltorio publico es SECURITY INVOKER (mismo patron que los RPC del chat).
--   * Votar: cualquier admin o socio, solo como uno mismo, un voto por horario, cambiable hasta que se confirme.
--   * Confirmar y marcar asistencia: UPDATE de columnas concretas por admin; la guarda valida cada transicion.
--     El enlace debe ser https. La asistencia solo despues de que empiece el horario confirmado.
--   * Avisos (`meeting`, solo por trigger): al proponer y al confirmar, a admin y socios activos salvo quien actua.
--   * El recordatorio "sin responder en 24 h" del PRD NO es un trabajo programado: la UI lo deriva de created_at.
--   * Brecha conocida: sin evento de auditoria (el catalogo de audit_log admite solo ciertas tablas).

create type public.meeting_status as enum ('polling', 'confirmed', 'held', 'cancelled');

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  week date not null constraint meetings_week_key unique
    constraint meetings_week_monday_check check (extract(isodow from week) = 1),
  status public.meeting_status not null default 'polling',
  confirmed_slot_id uuid,
  meet_link text constraint meetings_meet_link_len_check check (char_length(meet_link) <= 500),
  attendee_ids uuid[] not null default '{}',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint meetings_confirmed_check check (status in ('polling', 'cancelled')
    or (confirmed_slot_id is not null and meet_link is not null))
);

create table public.meeting_slots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id),
  starts_at timestamptz not null,
  constraint meeting_slots_unique_start unique (meeting_id, starts_at)
);
create index meeting_slots_meeting_idx on public.meeting_slots (meeting_id, starts_at);

alter table public.meetings add constraint meetings_confirmed_slot_fkey
  foreign key (confirmed_slot_id) references public.meeting_slots (id);

create table public.slot_votes (
  slot_id uuid not null references public.meeting_slots (id),
  user_id uuid not null default auth.uid() references public.profiles (id),
  available boolean not null,
  created_at timestamptz not null default now(),
  primary key (slot_id, user_id)
);

-- Lunes (Lima) de la semana que contiene el instante dado.
create function private.lima_week_monday(p_ts timestamptz) returns date
language sql immutable strict set search_path = ''
as $$ select date_trunc('week', p_ts at time zone 'America/Lima')::date $$;
revoke execute on function private.lima_week_monday(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios y RLS
-- ---------------------------------------------------------------------------
revoke all on public.meetings, public.meeting_slots, public.slot_votes from public, anon, authenticated;
grant select on public.meetings, public.meeting_slots, public.slot_votes to authenticated;
grant update (status, confirmed_slot_id, meet_link, attendee_ids) on public.meetings to authenticated;
-- user_id lo llena auth.uid() y nadie puede falsificarlo.
grant insert (slot_id, available) on public.slot_votes to authenticated;
grant update (available) on public.slot_votes to authenticated;

alter table public.meetings enable row level security;
alter table public.meeting_slots enable row level security;
alter table public.slot_votes enable row level security;

create policy meetings_select on public.meetings for select to authenticated
  using (public.is_partner_or_admin());
create policy meetings_update_admin on public.meetings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy meeting_slots_select on public.meeting_slots for select to authenticated
  using (public.is_partner_or_admin());

create policy slot_votes_select on public.slot_votes for select to authenticated
  using (public.is_partner_or_admin());
create policy slot_votes_insert_own on public.slot_votes for insert to authenticated
  with check (public.is_partner_or_admin() and user_id = (select auth.uid()));
create policy slot_votes_update_own on public.slot_votes for update to authenticated
  using (public.is_partner_or_admin() and user_id = (select auth.uid()))
  with check (public.is_partner_or_admin() and user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Guardas
-- ---------------------------------------------------------------------------
-- Votos: solo mientras la convocatoria sigue en votacion; la fila no cambia de horario ni de dueno.
create function private.slot_votes_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_status public.meeting_status;
begin
  if tg_op = 'UPDATE' and (new.slot_id <> old.slot_id or new.user_id <> old.user_id) then
    raise exception 'El voto no cambia de horario ni de dueno' using errcode = 'check_violation';
  end if;
  select m.status into v_status
  from public.meeting_slots s join public.meetings m on m.id = s.meeting_id
  where s.id = new.slot_id;
  if not found then
    raise exception 'El horario no existe o no tienes permiso' using errcode = '42501';
  end if;
  if v_status is distinct from 'polling' then
    raise exception 'La votacion ya termino' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger slot_votes_guard before insert or update on public.slot_votes
  for each row execute function private.slot_votes_guard();
revoke execute on function private.slot_votes_guard() from public, anon, authenticated;

-- Convocatoria: solo las transiciones polling -> confirmed y confirmed -> held, cada una con sus campos.
create function private.meetings_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_start timestamptz;
  v_bad int;
begin
  if (new.id, new.week, new.created_by, new.created_at)
     is distinct from (old.id, old.week, old.created_by, old.created_at) then
    raise exception 'La convocatoria no cambia de semana ni de autor' using errcode = 'check_violation';
  end if;

  if old.status = 'polling' and new.status = 'confirmed' then
    if not exists (select 1 from public.meeting_slots s
        where s.id = new.confirmed_slot_id and s.meeting_id = new.id) then
      raise exception 'El horario no pertenece a esta convocatoria' using errcode = 'check_violation';
    end if;
    new.meet_link := btrim(coalesce(new.meet_link, ''));
    if char_length(new.meet_link) > 500 or new.meet_link !~ '^https://[^\s/]+\.[^\s/]+(/\S*)?$' then
      raise exception 'El enlace debe ser una URL https' using errcode = 'check_violation';
    end if;
    if new.attendee_ids <> old.attendee_ids then
      raise exception 'La asistencia se marca despues de la reunion' using errcode = 'check_violation';
    end if;
  elsif old.status = 'confirmed' and new.status = 'held' then
    if (new.confirmed_slot_id, new.meet_link) is distinct from (old.confirmed_slot_id, old.meet_link) then
      raise exception 'La reunion confirmada no cambia' using errcode = 'check_violation';
    end if;
    select s.starts_at into v_start from public.meeting_slots s where s.id = old.confirmed_slot_id;
    if v_start is null or v_start > now() then
      raise exception 'La asistencia se marca cuando la reunion ya empezo' using errcode = 'check_violation';
    end if;
    new.attendee_ids := coalesce((
      select array_agg(x.id order by x.pos)
      from (select u.id, min(u.pos) as pos from unnest(new.attendee_ids) with ordinality as u(id, pos)
            group by u.id) x), '{}');
    select count(*) into v_bad from unnest(new.attendee_ids) a(id)
      where not exists (select 1 from public.profiles p
        where p.id = a.id and p.active and p.role in ('admin', 'partner'));
    if v_bad > 0 then
      raise exception 'Solo admin y socios activos pueden asistir' using errcode = 'check_violation';
    end if;
  else
    raise exception 'Esa transicion de la convocatoria no esta permitida' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger meetings_guard before update on public.meetings
  for each row execute function private.meetings_guard();
revoke execute on function private.meetings_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Proponer (unico camino de INSERT)
-- ---------------------------------------------------------------------------
create function private.propose_meeting(p_slots timestamptz[]) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_actor public.profiles;
  v_week date;
  v_this date := private.lima_week_monday(now());
  v_id uuid;
  v_slot timestamptz;
  v_recipient record;
begin
  select * into v_actor from public.profiles p where p.id = v_uid and p.active;
  if v_actor.id is null or v_actor.role <> 'admin' then
    raise exception 'Solo el product owner convoca la reunion' using errcode = '42501';
  end if;
  if p_slots is null or cardinality(p_slots) not between 2 and 3 or array_position(p_slots, null) is not null then
    raise exception 'Propon 2 o 3 horarios' using errcode = 'check_violation';
  end if;
  if (select count(distinct s) from unnest(p_slots) s) <> cardinality(p_slots) then
    raise exception 'Los horarios deben ser distintos' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(p_slots) s where s <= now()) then
    raise exception 'Los horarios deben estar en el futuro' using errcode = 'check_violation';
  end if;
  if (select count(distinct private.lima_week_monday(s)) from unnest(p_slots) s) <> 1 then
    raise exception 'Los horarios deben ser de la misma semana' using errcode = 'check_violation';
  end if;
  v_week := private.lima_week_monday(p_slots[1]);
  if v_week not in (v_this, v_this + 7) then
    raise exception 'Los horarios deben ser de esta semana o la siguiente' using errcode = 'check_violation';
  end if;

  begin
    insert into public.meetings (week, created_by) values (v_week, v_uid) returning id into v_id;
  exception when unique_violation then
    raise exception 'Ya hay una convocatoria para esa semana' using errcode = '23505';
  end;
  foreach v_slot in array p_slots loop
    insert into public.meeting_slots (meeting_id, starts_at) values (v_id, v_slot);
  end loop;

  for v_recipient in
    select p.id, p.name from public.profiles p
    where p.active and p.role in ('admin', 'partner') and p.id <> v_uid
  loop
    perform private.notify(v_recipient.id, 'meeting', jsonb_build_object(
      'title', 'Nueva convocatoria de reunión',
      'message', left(v_actor.name, 120) || ' propuso ' || cardinality(p_slots)
        || ' horarios para la reunión semanal. Marca tu disponibilidad.',
      'actorName', left(v_actor.name, 120),
      'actorRole', private.notify_role_label(v_actor.role),
      'recipientName', left(v_recipient.name, 120),
      'meetingId', v_id::text,
      'week', v_week::text,
      'nextStep', 'Abre Mi día y vota los horarios.'
    ));
  end loop;
  return v_id;
end;
$$;
revoke execute on function private.propose_meeting(timestamptz[]) from public, anon;
grant execute on function private.propose_meeting(timestamptz[]) to authenticated;

create function public.propose_meeting(p_slots timestamptz[]) returns uuid
language sql set search_path = ''
as $$ select private.propose_meeting(p_slots) $$;
revoke execute on function public.propose_meeting(timestamptz[]) from public, anon;
grant execute on function public.propose_meeting(timestamptz[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Aviso al confirmar: fecha y enlace, a admin y socios activos (no a quien confirma)
-- ---------------------------------------------------------------------------
create function private.notify_meeting_confirmed() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_actor public.profiles;
  v_start timestamptz;
  v_when text;
  v_recipient record;
begin
  if not (old.status = 'polling' and new.status = 'confirmed') then
    return null;
  end if;
  select * into v_actor from public.profiles p where p.id = v_uid;
  select s.starts_at into v_start from public.meeting_slots s where s.id = new.confirmed_slot_id;
  v_when := to_char(v_start at time zone 'America/Lima', 'DD/MM/YYYY') || ' a las '
    || to_char(v_start at time zone 'America/Lima', 'HH24:MI');
  for v_recipient in
    select p.id, p.name from public.profiles p
    where p.active and p.role in ('admin', 'partner') and p.id is distinct from v_uid
  loop
    perform private.notify(v_recipient.id, 'meeting', jsonb_strip_nulls(jsonb_build_object(
      'title', 'Reunión semanal confirmada',
      'message', 'La reunión será el ' || v_when || ' (hora de Lima).',
      'actorName', left(v_actor.name, 120),
      'actorRole', private.notify_role_label(v_actor.role),
      'recipientName', left(v_recipient.name, 120),
      'meetingId', new.id::text,
      'startsAt', to_char(v_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'meetLink', new.meet_link,
      'details', 'Enlace: ' || new.meet_link,
      'nextStep', 'Únete con el enlace a la hora indicada.'
    )));
  end loop;
  return null;
end;
$$;
create trigger notify_meetings_confirmed after update on public.meetings
  for each row execute function private.notify_meeting_confirmed();
revoke execute on function private.notify_meeting_confirmed() from public, anon, authenticated;
