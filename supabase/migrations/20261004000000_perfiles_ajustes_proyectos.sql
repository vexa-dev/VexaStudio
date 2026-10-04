-- C18: enums, perfiles, ajustes, proyectos, miembros y etiquetas de proyecto.
--
-- Los permisos replican los del servicio mock (apps/web/src/services/mock/work.ts):
--   * admin: ve y gestiona todo lo de proyectos, miembros y etiquetas.
--   * socio / colaborador: solo proyectos de los que son miembros (membresia explicita).
--   * perfiles y ajustes: lectura para cualquier usuario activo.
-- Nadie borra filas de negocio: no se concede DELETE (salvo en project_members,
-- que es una tabla de union cuya baja es parte de la gestion de miembros).

-- Esquema para funciones internas (no expuesto por la API REST).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Enums (mismos valores que packages/domain/src/types.ts)
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'partner', 'collaborator');
create type public.user_area as enum (
  'technical', 'management_finance', 'commercial', 'design_marketing'
);
create type public.project_type as enum ('internal', 'product', 'client');
create type public.project_status as enum ('active', 'paused', 'archived');

-- ---------------------------------------------------------------------------
-- Utilidad: marca de ultima modificacion
-- ---------------------------------------------------------------------------
create function private.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: id = auth.users(id); rol, area, horas/semana y activo viven aqui
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  role public.user_role not null default 'collaborator',
  area public.user_area not null default 'technical',
  weekly_hours numeric(5, 2) not null default 0
    check (weekly_hours >= 0 and weekly_hours <= 168),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- El id de un perfil nunca cambia.
create function private.profiles_immutable() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'El id del perfil no se puede cambiar' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger profiles_immutable before update on public.profiles
  for each row execute function private.profiles_immutable();

-- Alta por invitacion: Supabase Auth no permite registro publico (enable_signup = false).
-- Al crearse el usuario en auth.users (invitacion con la API de administracion), se crea
-- su perfil como colaborador activo. Nombre, area y horas salen de los metadatos de la
-- invitacion; el rol NUNCA se toma de ahi: un administrador lo promueve despues
-- (UPDATE sobre profiles, auditado como member.role_changed).
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name, role, area, weekly_hours)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Sin nombre'
    ),
    'collaborator',
    coalesce(nullif(new.raw_user_meta_data ->> 'area', '')::public.user_area, 'technical'),
    coalesce(nullif(new.raw_user_meta_data ->> 'weekly_hours', '')::numeric, 0)
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- settings: una sola fila con columnas tipadas (parametros del acuerdo de socios)
-- ---------------------------------------------------------------------------
create table public.settings (
  id boolean primary key default true check (id),
  points_per_hour numeric not null default 20 check (points_per_hour >= 0),
  points_per_sol numeric not null default 2 check (points_per_sol >= 0),
  min_compliance numeric not null default 0.8
    check (min_compliance >= 0 and min_compliance <= 1),
  weeks_per_month numeric not null default 4 check (weeks_per_month > 0),
  expense_approval_limit_pen numeric not null default 50
    check (expense_approval_limit_pen >= 0),
  entry_edit_days integer not null default 7 check (entry_edit_days >= 0),
  -- Recordatorios (dias: 0 = domingo ... 6 = sabado, como Date.getDay()).
  daily_reminder_time time not null default '21:00',
  daily_reminder_weekdays smallint[] not null default '{1,3,5}'
    check (daily_reminder_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  weekly_hours_reminder_time time not null default '20:00',
  weekly_hours_reminder_weekday smallint not null default 0
    check (weekly_hours_reminder_weekday between 0 and 6),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
insert into public.settings default values;

create function private.settings_touch() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.id := true;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
create trigger settings_touch before update on public.settings
  for each row execute function private.settings_touch();

-- ---------------------------------------------------------------------------
-- projects, project_members, project_labels
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  type public.project_type not null,
  status public.project_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projects_updated_at before update on public.projects
  for each row execute function private.set_updated_at();

create table public.project_members (
  project_id uuid not null references public.projects (id),
  user_id uuid not null references public.profiles (id),
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

-- Solo perfiles activos pueden ser miembros ("Miembro no valido" en el mock).
create function private.project_members_check() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.user_id and p.active) then
    raise exception 'Miembro no valido' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger project_members_check before insert on public.project_members
  for each row execute function private.project_members_check();

create table public.project_labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  name text not null check (char_length(name) between 1 and 40),
  color text not null check (color ~ '^#[0-9a-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Sin duplicados por proyecto ignorando mayusculas y espacios externos.
create unique index project_labels_name_uidx
  on public.project_labels (project_id, lower(btrim(name)));

-- Nombre y color canonicos: el cliente no puede falsificarlos.
create function private.project_labels_canonical() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.color := lower(new.color);
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'Una etiqueta pertenece a un solo proyecto' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger project_labels_canonical before insert or update on public.project_labels
  for each row execute function private.project_labels_canonical();
create trigger project_labels_updated_at before update on public.project_labels
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funciones auxiliares de permisos (SECURITY DEFINER para evitar recursion de RLS)
-- ---------------------------------------------------------------------------
-- Rol del usuario actual; NULL si no hay sesion o el perfil esta inactivo.
create function public.auth_role() returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.active
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.auth_role() = 'admin', false) $$;

-- Socios y administradores (acceso a gastos, equipo y dashboard).
create function public.is_partner_or_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.auth_role() in ('admin', 'partner'), false) $$;

create function public.is_project_member(p_project uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.auth_role() is not null and exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = (select auth.uid())
  )
$$;

-- Admin ve todo; los demas, solo proyectos con membresia explicita.
create function public.can_access_project(p_project uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select public.is_admin() or public.is_project_member(p_project) $$;

-- ---------------------------------------------------------------------------
-- Privilegios: nada para anon; authenticated solo lo que las politicas permiten
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.settings, public.projects,
  public.project_members, public.project_labels from public, anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.settings to authenticated;
grant select, insert, update on public.projects to authenticated;
grant select, insert, delete on public.project_members to authenticated;
grant select, insert, update on public.project_labels to authenticated;

revoke execute on function
  public.auth_role(), public.is_admin(), public.is_partner_or_admin(),
  public.is_project_member(uuid), public.can_access_project(uuid)
  from public, anon;
grant execute on function
  public.auth_role(), public.is_admin(), public.is_partner_or_admin(),
  public.is_project_member(uuid), public.can_access_project(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_labels enable row level security;

-- profiles: cualquier usuario activo ve el equipo (members.list); solo admin modifica.
create policy profiles_select on public.profiles for select to authenticated
  using (public.auth_role() is not null);
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- settings: lectura para todos; el cambio llega con votacion, que ejecuta un admin.
create policy settings_select on public.settings for select to authenticated
  using (public.auth_role() is not null);
create policy settings_update_admin on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- projects: admin todo; los demas solo los suyos. Solo admin crea y edita.
create policy projects_select on public.projects for select to authenticated
  using (public.can_access_project(id));
create policy projects_insert_admin on public.projects for insert to authenticated
  with check (public.is_admin());
create policy projects_update_admin on public.projects for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- project_members: quien ve el proyecto ve su equipo; solo admin gestiona.
create policy project_members_select on public.project_members for select to authenticated
  using (public.can_access_project(project_id));
create policy project_members_insert_admin on public.project_members
  for insert to authenticated with check (public.is_admin());
create policy project_members_delete_admin on public.project_members
  for delete to authenticated using (public.is_admin());

-- project_labels: el catalogo es solo de admin (C19 agrega la lectura de etiquetas
-- adjuntas a tareas visibles para el resto de roles).
create policy project_labels_select_admin on public.project_labels
  for select to authenticated using (public.is_admin());
create policy project_labels_insert_admin on public.project_labels
  for insert to authenticated with check (public.is_admin());
create policy project_labels_update_admin on public.project_labels
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RPC (SECURITY INVOKER): las politicas anteriores siguen aplicando
-- ---------------------------------------------------------------------------
-- Reemplaza ProjectService.create. Los miembros se agregan en la misma transaccion.
create function public.create_project(
  p_name text,
  p_type public.project_type,
  p_status public.project_status default 'active',
  p_member_ids uuid[] default '{}'
) returns public.projects
language plpgsql security invoker set search_path = ''
as $$
declare
  v_project public.projects;
begin
  insert into public.projects (name, type, status)
  values (btrim(p_name), p_type, p_status)
  returning * into v_project;
  insert into public.project_members (project_id, user_id)
  select v_project.id, u from (select distinct unnest(p_member_ids) as u) s;
  return v_project;
end;
$$;

-- Reemplaza el cambio de memberIds en ProjectService.update: deja exactamente ese conjunto.
create function public.set_project_members(p_project uuid, p_member_ids uuid[])
returns uuid[]
language plpgsql security invoker set search_path = ''
as $$
begin
  delete from public.project_members m
  where m.project_id = p_project and not (m.user_id = any (p_member_ids));
  insert into public.project_members (project_id, user_id)
  select p_project, u from (select distinct unnest(p_member_ids) as u) s
  on conflict do nothing;
  return (select coalesce(array_agg(m.user_id order by m.user_id), '{}')
          from public.project_members m where m.project_id = p_project);
end;
$$;

revoke execute on function public.create_project(text, public.project_type, public.project_status, uuid[]),
  public.set_project_members(uuid, uuid[]) from public, anon;
grant execute on function public.create_project(text, public.project_type, public.project_status, uuid[]),
  public.set_project_members(uuid, uuid[]) to authenticated;
