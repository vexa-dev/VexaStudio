-- C29: nucleo del chat en la base (B5b).
--
-- Reproduce las reglas 1 a 8 del chat actual (`chat-store.ts`): acceso, directos, grupos, enviar,
-- editar/anular, reacciones, lecturas y reenvio. Los mensajes de error son los del mock, en espanol,
-- para que el adaptador (B5e) los muestre tal cual.
--
-- Modelo de permisos
--   * `public.chat_can_access(hilo)`: perfil activo y (integrante del hilo, o admin si es un GRUPO).
--     Un admin nunca ve los directos ajenos. Es un ayudante de permisos (SECURITY DEFINER) del mismo
--     tipo que `can_view_task`; el barrido 06 lo admite de forma explicita.
--   * Hilos, integrantes y reacciones solo se escriben con RPC (`public.chat_*` son SECURITY INVOKER y
--     llaman a `private.chat_*` SECURITY DEFINER, con `grant execute` explicito).
--   * Mensajes y lecturas se escriben con privilegios de columna + politicas + triggers guarda.
--   * Nadie borra con DELETE: los grupos se borran con `chat_delete_group` y los mensajes se anulan.
--   * Los datos del chat NO se auditan (volumen y privacidad).

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create type public.chat_thread_kind as enum ('direct', 'group');

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  kind public.chat_thread_kind not null,
  name text not null default '' constraint chat_threads_name_len_check check (char_length(name) <= 60),
  description text not null default '' constraint chat_threads_description_len_check check (char_length(description) <= 240),
  -- menor:mayor de los dos ids; garantiza un solo directo por pareja.
  direct_key text unique,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_threads_shape_check check (
    (kind = 'direct' and direct_key is not null and name = '' and description = '')
    or (kind = 'group' and direct_key is null)
  )
);
create trigger chat_threads_updated_at before update on public.chat_threads
  for each row execute function private.set_updated_at();

create table public.chat_members (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index chat_members_user_idx on public.chat_members (user_id);

-- Aparte de los integrantes: un admin que no es integrante de un grupo tambien guarda su lectura.
create table public.chat_reads (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  read_at timestamptz not null,
  primary key (thread_id, user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null default '' constraint chat_messages_body_len_check check (char_length(body) <= 4000),
  reply_to uuid references public.chat_messages (id) on delete set null,
  attachment_path text,
  attachment_name text,
  attachment_mime text,
  attachment_size integer constraint chat_messages_attachment_size_check check (attachment_size <= 26214400),
  created_at timestamptz not null default clock_timestamp(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint chat_messages_content_check check (deleted_at is not null or body <> '' or attachment_path is not null),
  constraint chat_messages_deleted_check check (
    deleted_at is null or (body = '' and attachment_path is null and attachment_name is null
      and attachment_mime is null and attachment_size is null)
  )
);
create index chat_messages_thread_created_idx on public.chat_messages (thread_id, created_at desc);
create index chat_messages_reply_idx on public.chat_messages (reply_to) where reply_to is not null;

-- Un emoji por persona y mensaje (la clave primaria). La clave ya cubre las busquedas por mensaje.
create table public.chat_reactions (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  emoji text not null constraint chat_reactions_emoji_check check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Permiso de acceso (ayudante de permisos, como can_view_task)
-- ---------------------------------------------------------------------------
create function public.chat_can_access(p_thread uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.auth_role() is not null and exists (
    select 1 from public.chat_threads t
    where t.id = p_thread and (
      exists (select 1 from public.chat_members m
        where m.thread_id = t.id and m.user_id = (select auth.uid()))
      or (t.kind = 'group' and public.auth_role() = 'admin')
    )
  )
$$;
revoke execute on function public.chat_can_access(uuid) from public, anon;
grant execute on function public.chat_can_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios y RLS
-- ---------------------------------------------------------------------------
revoke all on public.chat_threads, public.chat_members, public.chat_reads,
  public.chat_messages, public.chat_reactions from public, anon, authenticated;
grant select on public.chat_threads, public.chat_members, public.chat_reads,
  public.chat_messages, public.chat_reactions to authenticated;
-- `id` se permite para que el cliente genere el id (actualizacion optimista y reenvio idempotente).
grant insert (id, thread_id, body, reply_to, attachment_path, attachment_name, attachment_mime,
  attachment_size, author_id) on public.chat_messages to authenticated;
grant update (body, edited_at, deleted_at) on public.chat_messages to authenticated;
grant insert (thread_id, user_id, read_at), update (read_at) on public.chat_reads to authenticated;

alter table public.chat_threads enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_reads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reactions enable row level security;

create policy chat_threads_select on public.chat_threads for select to authenticated
  using (public.chat_can_access(id));
create policy chat_members_select on public.chat_members for select to authenticated
  using (public.chat_can_access(thread_id));
-- Todos los que tienen acceso leen las lecturas de los demas (marcas de leido).
create policy chat_reads_select on public.chat_reads for select to authenticated
  using (public.chat_can_access(thread_id));
create policy chat_reads_insert_own on public.chat_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and public.chat_can_access(thread_id));
create policy chat_reads_update_own on public.chat_reads for update to authenticated
  using (user_id = (select auth.uid()) and public.chat_can_access(thread_id))
  with check (user_id = (select auth.uid()) and public.chat_can_access(thread_id));
create policy chat_messages_select on public.chat_messages for select to authenticated
  using (public.chat_can_access(thread_id));
create policy chat_messages_insert on public.chat_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and public.chat_can_access(thread_id));
create policy chat_messages_update on public.chat_messages for update to authenticated
  using (public.chat_can_access(thread_id))
  with check (public.chat_can_access(thread_id));
create policy chat_reactions_select on public.chat_reactions for select to authenticated
  using (exists (select 1 from public.chat_messages m
    where m.id = chat_reactions.message_id and public.chat_can_access(m.thread_id)));

-- ---------------------------------------------------------------------------
-- Guarda de mensajes (insertar, editar y anular)
-- ---------------------------------------------------------------------------
create function private.chat_messages_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_kind public.chat_thread_kind;
  v_reply_thread uuid;
begin
  if tg_op = 'INSERT' then
    if not public.chat_can_access(new.thread_id) then
      raise exception 'No tienes acceso a esta conversación.';
    end if;
    if new.author_id is distinct from v_uid then
      raise exception 'Solo puedes enviar mensajes como tú mismo.';
    end if;
    new.body := coalesce(new.body, '');
    if char_length(new.body) > 4000 then
      raise exception 'El mensaje puede tener hasta 4000 caracteres.';
    end if;
    new.body := regexp_replace(new.body, '^\s+|\s+$', '', 'g');
    if new.body = '' and new.attachment_path is null then
      raise exception 'Escribe un mensaje o adjunta un archivo.';
    end if;
    if new.attachment_path is null then
      new.attachment_name := null; new.attachment_mime := null; new.attachment_size := null;
    end if;
    if new.reply_to is not null then
      select m.thread_id into v_reply_thread from public.chat_messages m where m.id = new.reply_to;
      if v_reply_thread is distinct from new.thread_id then
        raise exception 'El mensaje original ya no está disponible.';
      end if;
    end if;
    new.edited_at := null;
    new.deleted_at := null;
    return new;
  end if;

  -- UPDATE. La referencia `reply_to` pasa a nulo cuando se borra el mensaje original (borrar un
  -- grupo): es la accion de la FK, no una edicion; el cliente no tiene privilegio sobre esa columna.
  if new.reply_to is null and old.reply_to is not null
     and (new.id, new.thread_id, new.author_id, new.body, new.attachment_path, new.attachment_name,
          new.attachment_mime, new.attachment_size, new.created_at, new.edited_at, new.deleted_at)
         is not distinct from
         (old.id, old.thread_id, old.author_id, old.body, old.attachment_path, old.attachment_name,
          old.attachment_mime, old.attachment_size, old.created_at, old.edited_at, old.deleted_at) then
    return new;
  end if;
  if old.deleted_at is not null then
    raise exception 'El mensaje ya no está disponible.';
  end if;
  if (new.id, new.thread_id, new.author_id, new.reply_to, new.attachment_path, new.attachment_name,
      new.attachment_mime, new.attachment_size, new.created_at)
     is distinct from
     (old.id, old.thread_id, old.author_id, old.reply_to, old.attachment_path, old.attachment_name,
      old.attachment_mime, old.attachment_size, old.created_at) then
    raise exception 'Solo se puede cambiar el texto, la edición o la anulación de un mensaje.';
  end if;

  if new.deleted_at is not null then
    -- Anular: del autor, o de un admin dentro de un GRUPO (el acceso lo exige el RLS).
    select t.kind into v_kind from public.chat_threads t where t.id = old.thread_id;
    if old.author_id is distinct from v_uid and not (v_kind = 'group' and public.is_admin()) then
      raise exception 'Solo puedes editar o eliminar tus mensajes.';
    end if;
    new.deleted_at := clock_timestamp();
    new.body := '';
    new.attachment_path := null; new.attachment_name := null;
    new.attachment_mime := null; new.attachment_size := null;
    new.edited_at := old.edited_at;
    delete from public.chat_reactions r where r.message_id = old.id;
  else
    -- Editar: solo el autor, con texto no vacio de hasta 4000 caracteres (medidos antes de recortar).
    if old.author_id is distinct from v_uid then
      raise exception 'Solo puedes editar o eliminar tus mensajes.';
    end if;
    new.body := coalesce(new.body, '');
    if char_length(new.body) > 4000 or regexp_replace(new.body, '^\s+|\s+$', '', 'g') = '' then
      raise exception 'Escribe un mensaje de hasta 4000 caracteres.';
    end if;
    new.body := regexp_replace(new.body, '^\s+|\s+$', '', 'g');
    new.edited_at := clock_timestamp();
  end if;
  return new;
end;
$$;
create trigger chat_messages_guard before insert or update on public.chat_messages
  for each row execute function private.chat_messages_guard();
revoke execute on function private.chat_messages_guard() from public, anon, authenticated;

-- Enviar fija la lectura del emisor (nunca la baja).
create function private.chat_messages_after_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.chat_reads (thread_id, user_id, read_at)
  values (new.thread_id, new.author_id, new.created_at)
  on conflict (thread_id, user_id)
  do update set read_at = greatest(public.chat_reads.read_at, excluded.read_at);
  return null;
end;
$$;
create trigger chat_messages_after_insert after insert on public.chat_messages
  for each row execute function private.chat_messages_after_insert();
revoke execute on function private.chat_messages_after_insert() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guarda de lecturas: nunca retroceden ni apuntan al futuro (1 minuto de tolerancia por relojes)
-- ---------------------------------------------------------------------------
create function private.chat_reads_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.read_at > clock_timestamp() + interval '1 minute' then
    raise exception 'La lectura no puede estar en el futuro.';
  end if;
  if tg_op = 'UPDATE' then
    if (new.thread_id, new.user_id) is distinct from (old.thread_id, old.user_id) then
      raise exception 'Solo se puede cambiar read_at.';
    end if;
    if new.read_at < old.read_at then
      raise exception 'La lectura no puede retroceder.';
    end if;
  end if;
  return new;
end;
$$;
create trigger chat_reads_guard before insert or update on public.chat_reads
  for each row execute function private.chat_reads_guard();
revoke execute on function private.chat_reads_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: directo (uno por pareja)
-- ---------------------------------------------------------------------------
create function private.chat_direct_thread(p_other uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_key text;
  v_id uuid;
begin
  if public.auth_role() is null then
    raise exception 'No tienes acceso a esta conversación.';
  end if;
  if p_other is null or p_other = v_uid then
    raise exception 'Selecciona a otra persona.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_other and p.active) then
    raise exception 'La persona seleccionada no está disponible.';
  end if;
  v_key := least(v_uid::text, p_other::text) || ':' || greatest(v_uid::text, p_other::text);

  insert into public.chat_threads (kind, direct_key, created_by)
  values ('direct', v_key, v_uid)
  on conflict (direct_key) do nothing
  returning id into v_id;
  if v_id is null then
    select t.id into v_id from public.chat_threads t where t.direct_key = v_key;
  else
    insert into public.chat_members (thread_id, user_id) values (v_id, v_uid), (v_id, p_other);
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: crear o editar un grupo (solo admin)
-- ---------------------------------------------------------------------------
create function private.chat_save_group(p_id uuid, p_name text, p_description text, p_members uuid[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := regexp_replace(coalesce(p_name, ''), '^\s+|\s+$', '', 'g');
  v_desc text := regexp_replace(coalesce(p_description, ''), '^\s+|\s+$', '', 'g');
  v_members uuid[];
  v_kind public.chat_thread_kind;
  v_id uuid := p_id;
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden gestionar grupos.';
  end if;
  if v_name = '' then
    raise exception 'Escribe el nombre del grupo.';
  end if;
  if char_length(v_name) > 60 then
    raise exception 'El nombre del grupo puede tener hasta 60 caracteres.';
  end if;
  if char_length(v_desc) > 240 then
    raise exception 'La descripción puede tener hasta 240 caracteres.';
  end if;
  if (select count(*) from unnest(coalesce(p_members, '{}'::uuid[])) m where m is not null) = 0 then
    raise exception 'Selecciona al menos un integrante.';
  end if;
  -- El creador entra siempre y no hay duplicados.
  select array_agg(distinct m) into v_members from unnest(p_members || v_uid) m where m is not null;

  if p_id is not null then
    if not public.chat_can_access(p_id) then
      raise exception 'No tienes acceso a esta conversación.';
    end if;
    select t.kind into v_kind from public.chat_threads t where t.id = p_id;
    if v_kind <> 'group' then
      raise exception 'Esta conversación no es un grupo.';
    end if;
  end if;
  -- Las personas nuevas deben existir y estar activas (quien ya era integrante se conserva).
  if exists (
    select 1 from unnest(v_members) m
    where not exists (select 1 from public.profiles p where p.id = m and p.active)
      and not exists (select 1 from public.chat_members cm where cm.thread_id = p_id and cm.user_id = m)
  ) then
    raise exception 'Hay integrantes que no están disponibles.';
  end if;

  if p_id is null then
    insert into public.chat_threads (kind, name, description, created_by)
    values ('group', v_name, v_desc, v_uid)
    returning id into v_id;
  else
    update public.chat_threads set name = v_name, description = v_desc where id = p_id;
    delete from public.chat_members cm where cm.thread_id = p_id and cm.user_id <> all (v_members);
  end if;
  insert into public.chat_members (thread_id, user_id)
  select v_id, m from unnest(v_members) m
  on conflict (thread_id, user_id) do nothing;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: borrar un grupo (borrado real; arrastra integrantes, mensajes, lecturas y reacciones)
-- ---------------------------------------------------------------------------
create function private.chat_delete_group(p_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind public.chat_thread_kind;
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden gestionar grupos.';
  end if;
  if not public.chat_can_access(p_id) then
    raise exception 'No tienes acceso a esta conversación.';
  end if;
  select t.kind into v_kind from public.chat_threads t where t.id = p_id;
  if v_kind <> 'group' then
    raise exception 'Solo se pueden eliminar grupos.';
  end if;
  delete from public.chat_threads where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: reaccionar (un emoji por persona; el mismo lo quita, otro lo reemplaza)
-- ---------------------------------------------------------------------------
create function private.chat_react(p_message uuid, p_emoji text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_thread uuid;
  v_deleted timestamptz;
  v_current text;
begin
  select m.thread_id, m.deleted_at into v_thread, v_deleted
  from public.chat_messages m where m.id = p_message;
  if v_thread is null then
    raise exception 'El mensaje ya no está disponible.';
  end if;
  if not public.chat_can_access(v_thread) then
    raise exception 'No tienes acceso a esta conversación.';
  end if;
  if v_deleted is not null then
    raise exception 'El mensaje ya no está disponible.';
  end if;
  if p_emoji is null or char_length(p_emoji) not between 1 and 16 then
    raise exception 'El emoji debe tener de 1 a 16 caracteres.';
  end if;

  select r.emoji into v_current from public.chat_reactions r
  where r.message_id = p_message and r.user_id = v_uid;
  if v_current is not distinct from p_emoji then
    delete from public.chat_reactions where message_id = p_message and user_id = v_uid;
  else
    insert into public.chat_reactions (message_id, user_id, emoji) values (p_message, v_uid, p_emoji)
    on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end;
$$;

revoke execute on function private.chat_direct_thread(uuid) from public, anon;
revoke execute on function private.chat_save_group(uuid, text, text, uuid[]) from public, anon;
revoke execute on function private.chat_delete_group(uuid) from public, anon;
revoke execute on function private.chat_react(uuid, text) from public, anon;
grant execute on function private.chat_direct_thread(uuid) to authenticated;
grant execute on function private.chat_save_group(uuid, text, text, uuid[]) to authenticated;
grant execute on function private.chat_delete_group(uuid) to authenticated;
grant execute on function private.chat_react(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Envoltorios publicos (SECURITY INVOKER) y marcar como leido
-- ---------------------------------------------------------------------------
create function public.chat_direct_thread(p_other uuid) returns uuid
language sql set search_path = ''
as $$ select private.chat_direct_thread(p_other) $$;

create function public.chat_save_group(p_id uuid, p_name text, p_description text, p_members uuid[])
returns uuid
language sql set search_path = ''
as $$ select private.chat_save_group(p_id, p_name, p_description, p_members) $$;

create function public.chat_delete_group(p_id uuid) returns void
language sql set search_path = ''
as $$ select private.chat_delete_group(p_id) $$;

create function public.chat_react(p_message uuid, p_emoji text) returns void
language sql set search_path = ''
as $$ select private.chat_react(p_message, p_emoji) $$;

-- Invoker: usa el privilegio de columna y las politicas de chat_reads. Nunca baja la lectura.
create function public.chat_mark_read(p_thread uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  if not public.chat_can_access(p_thread) then
    raise exception 'No tienes acceso a esta conversación.';
  end if;
  insert into public.chat_reads (thread_id, user_id, read_at)
  values (p_thread, (select auth.uid()), clock_timestamp())
  on conflict (thread_id, user_id)
  do update set read_at = greatest(public.chat_reads.read_at, excluded.read_at);
end;
$$;

revoke execute on function public.chat_direct_thread(uuid) from public, anon;
revoke execute on function public.chat_save_group(uuid, text, text, uuid[]) from public, anon;
revoke execute on function public.chat_delete_group(uuid) from public, anon;
revoke execute on function public.chat_react(uuid, text) from public, anon;
revoke execute on function public.chat_mark_read(uuid) from public, anon;
grant execute on function public.chat_direct_thread(uuid) to authenticated;
grant execute on function public.chat_save_group(uuid, text, text, uuid[]) to authenticated;
grant execute on function public.chat_delete_group(uuid) to authenticated;
grant execute on function public.chat_react(uuid, text) to authenticated;
grant execute on function public.chat_mark_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime (`postgres_changes` aplica el RLS de lectura por suscriptor)
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['chat_threads', 'chat_members', 'chat_reads', 'chat_messages', 'chat_reactions'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;
