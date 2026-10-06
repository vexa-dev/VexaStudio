-- Chat: ciclo de vida de los adjuntos (liberar espacio de Storage con consentimiento).
--
-- El plan Hobby de Supabase da 1 GB de Storage. Un adjunto del chat se puede retirar cuando ya nadie lo
-- necesita, y solo si TODAS las personas integrantes lo deciden:
--
--   1. Cada integrante registra su DESCARGA (`chat_attachment_states.downloaded_at`). Quien envio el
--      archivo cuenta como descarga implicita (no necesita fila).
--   2. Cuando todos descargaron, a cada integrante se le pregunta una vez: conservar o liberar espacio
--      (`keep` true / false).
--   3. Si ALGUIEN responde "conservar", el archivo se queda para siempre. Se retira solo cuando todos
--      los integrantes respondieron "liberar". Quien nunca responde equivale a "conservar": no hay
--      ningun borrado automatico por tiempo.
--   4. Retirar = quitar el objeto de Storage Y marcar el mensaje (`attachment_purged_at`) sin borrarlo:
--      el nombre, el tipo y el tamano se conservan para mostrar un marcador de texto en el chat.
--
-- Los objetos reales se retiran con la API de Storage desde el cliente (`storage.from(...).remove`).
-- NO se borra con SQL en `storage.objects`: eso deja el archivo huerfano en el almacenamiento y sigue
-- ocupando espacio. Por eso la guarda de mensajes solo acepta registrar el retiro cuando el objeto ya no
-- existe, y la politica de borrado de abajo solo abre la puerta a la API cuando todos liberaron.
--
-- Los conteos usan SOLO `chat_members`; un admin que mira un grupo sin ser integrante no cuenta ni vota.

-- ---------------------------------------------------------------------------
-- Marca del retiro en el mensaje (se conserva `attachment_path`: la restriccion de contenido del mensaje
-- lo exige para mensajes solo con adjunto; el cliente no firma ni descarga un adjunto retirado)
-- ---------------------------------------------------------------------------
alter table public.chat_messages add column attachment_purged_at timestamptz;
grant update (attachment_purged_at) on public.chat_messages to authenticated;

-- ---------------------------------------------------------------------------
-- Estado por (mensaje, integrante)
-- ---------------------------------------------------------------------------
create table public.chat_attachment_states (
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  downloaded_at timestamptz not null default clock_timestamp(),
  -- null = sin responder; true = conservar; false = liberar espacio.
  keep boolean,
  answered_at timestamptz,
  primary key (message_id, user_id),
  constraint chat_attachment_states_answer_check check ((keep is null) = (answered_at is null))
);

revoke all on public.chat_attachment_states from public, anon, authenticated;
grant select on public.chat_attachment_states to authenticated;
-- Las horas las fija el servidor (la guarda): el cliente solo pide su descarga y envia su respuesta.
grant insert (message_id, user_id), update (keep) on public.chat_attachment_states to authenticated;

alter table public.chat_attachment_states enable row level security;

create policy chat_attachment_states_select on public.chat_attachment_states for select to authenticated
  using (exists (select 1 from public.chat_messages m
    where m.id = chat_attachment_states.message_id and public.chat_can_access(m.thread_id)));
create policy chat_attachment_states_insert_own on public.chat_attachment_states for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.chat_messages m
    where m.id = chat_attachment_states.message_id and public.chat_can_access(m.thread_id)));
create policy chat_attachment_states_update_own on public.chat_attachment_states for update to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.chat_messages m
    where m.id = chat_attachment_states.message_id and public.chat_can_access(m.thread_id)))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.chat_messages m
    where m.id = chat_attachment_states.message_id and public.chat_can_access(m.thread_id)));
-- Sin politica ni privilegio de DELETE: una descarga registrada no se deshace.

-- ---------------------------------------------------------------------------
-- Ayudantes de permisos (SECURITY INVOKER: aplican el RLS de quien consulta)
-- ---------------------------------------------------------------------------
-- Todos los integrantes descargaron (quien envio cuenta como descarga implicita). Con un solo
-- integrante nunca hay pregunta: devuelve falso.
create function public.chat_attachment_all_downloaded(p_message uuid) returns boolean
language sql stable security invoker set search_path = ''
as $$
  select coalesce((
    select m.attachment_path is not null and m.deleted_at is null
      and (select count(*) from public.chat_members cm where cm.thread_id = m.thread_id) > 1
      and not exists (
        select 1 from public.chat_members cm
        where cm.thread_id = m.thread_id and cm.user_id <> m.author_id
          and not exists (select 1 from public.chat_attachment_states s
            where s.message_id = m.id and s.user_id = cm.user_id))
    from public.chat_messages m where m.id = p_message
  ), false)
$$;

-- Se puede retirar: todos descargaron, todos los integrantes respondieron "liberar", nadie respondio
-- "conservar" (ni siquiera alguien que ya salio del hilo) y el archivo aun no fue retirado.
create function public.chat_attachment_purgeable(p_message uuid) returns boolean
language sql stable security invoker set search_path = ''
as $$
  select coalesce((
    select m.attachment_purged_at is null
      and public.chat_attachment_all_downloaded(m.id)
      and not exists (select 1 from public.chat_attachment_states s
        where s.message_id = m.id and s.keep is true)
      and not exists (
        select 1 from public.chat_members cm
        where cm.thread_id = m.thread_id
          and not exists (select 1 from public.chat_attachment_states s
            where s.message_id = m.id and s.user_id = cm.user_id and s.keep is false))
    from public.chat_messages m where m.id = p_message
  ), false)
$$;

revoke execute on function public.chat_attachment_all_downloaded(uuid) from public, anon;
revoke execute on function public.chat_attachment_purgeable(uuid) from public, anon;
grant execute on function public.chat_attachment_all_downloaded(uuid) to authenticated;
grant execute on function public.chat_attachment_purgeable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Guarda de las filas de estado
-- ---------------------------------------------------------------------------
create function private.chat_attachment_states_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_thread uuid;
  v_path text;
  v_deleted timestamptz;
  v_purged timestamptz;
begin
  select m.thread_id, m.attachment_path, m.deleted_at, m.attachment_purged_at
    into v_thread, v_path, v_deleted, v_purged
  from public.chat_messages m where m.id = new.message_id;
  if v_thread is null then
    raise exception 'El mensaje ya no está disponible.';
  end if;
  if new.user_id is distinct from v_uid then
    raise exception 'Solo puedes registrar tu propia descarga.';
  end if;
  if not exists (select 1 from public.chat_members cm where cm.thread_id = v_thread and cm.user_id = v_uid) then
    raise exception 'Solo los integrantes de la conversación pueden hacerlo.';
  end if;
  if v_path is null or v_deleted is not null then
    raise exception 'Este mensaje no tiene un archivo adjunto.';
  end if;
  if v_purged is not null then
    raise exception 'El archivo ya fue eliminado para liberar espacio.';
  end if;

  if tg_op = 'INSERT' then
    -- La descarga nace sin respuesta y con la hora del servidor.
    new.downloaded_at := clock_timestamp();
    new.keep := null;
    new.answered_at := null;
    return new;
  end if;

  if (new.message_id, new.user_id, new.downloaded_at) is distinct from
     (old.message_id, old.user_id, old.downloaded_at) then
    raise exception 'No se puede cambiar la descarga registrada.';
  end if;
  if old.keep is not null then
    raise exception 'Ya respondiste sobre este archivo.';
  end if;
  if new.keep is null then
    new.answered_at := null;
    return new;
  end if;
  if not public.chat_attachment_all_downloaded(new.message_id) then
    raise exception 'Todavía falta que todos descarguen el archivo.';
  end if;
  new.answered_at := clock_timestamp();
  return new;
end;
$$;
revoke execute on function private.chat_attachment_states_guard() from public, anon, authenticated;
create trigger chat_attachment_states_guard before insert or update on public.chat_attachment_states
  for each row execute function private.chat_attachment_states_guard();

-- ---------------------------------------------------------------------------
-- RPC (SECURITY INVOKER: el RLS y la guarda de la propia fila deciden)
-- ---------------------------------------------------------------------------
create function public.chat_mark_attachment_downloaded(p_message uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from public.chat_messages m where m.id = p_message) then
    raise exception 'El mensaje ya no está disponible.';
  end if;
  insert into public.chat_attachment_states (message_id, user_id)
  values (p_message, (select auth.uid()))
  on conflict (message_id, user_id) do nothing;
end;
$$;

-- Devuelve verdadero cuando, con esta respuesta, todos liberaron: el cliente retira el objeto.
create function public.chat_answer_attachment_keep(p_message uuid, p_keep boolean) returns boolean
language plpgsql set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_keep is null then
    raise exception 'Elige conservar o liberar el espacio.';
  end if;
  if not exists (select 1 from public.chat_messages m where m.id = p_message) then
    raise exception 'El mensaje ya no está disponible.';
  end if;
  if not public.chat_attachment_all_downloaded(p_message) then
    raise exception 'Todavía falta que todos descarguen el archivo.';
  end if;
  -- La descarga de quien envio el archivo es implicita: su fila se crea al responder. Para el resto, la
  -- condicion anterior ya garantiza que su fila existe, y el conflicto no hace nada.
  insert into public.chat_attachment_states (message_id, user_id) values (p_message, v_uid)
  on conflict (message_id, user_id) do nothing;
  update public.chat_attachment_states set keep = p_keep
  where message_id = p_message and user_id = v_uid and keep is null;
  if not found then
    raise exception 'Ya respondiste sobre este archivo.';
  end if;
  return public.chat_attachment_purgeable(p_message);
end;
$$;

revoke execute on function public.chat_mark_attachment_downloaded(uuid) from public, anon;
revoke execute on function public.chat_answer_attachment_keep(uuid, boolean) from public, anon;
grant execute on function public.chat_mark_attachment_downloaded(uuid) to authenticated;
grant execute on function public.chat_answer_attachment_keep(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: cualquier integrante puede retirar el objeto SOLO cuando todos liberaron
-- ---------------------------------------------------------------------------
-- Se suma (OR) a `chat_attachments_delete_own` (quien subio el archivo). La ruta es
-- `<hilo>/<mensaje>/<archivo>`; el objeto debe ser el adjunto vigente de ese mensaje.
create policy chat_attachment_delete_released on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-attachments' and public.auth_role() is not null
    and case when (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (storage.foldername(name))[2]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then exists (select 1 from public.chat_members cm
          where cm.thread_id = ((storage.foldername(name))[1])::uuid and cm.user_id = (select auth.uid()))
        and exists (select 1 from public.chat_messages m
          where m.id = ((storage.foldername(name))[2])::uuid
            and m.thread_id = ((storage.foldername(name))[1])::uuid
            and m.attachment_path = name)
        and public.chat_attachment_purgeable(((storage.foldername(name))[2])::uuid)
      else false end
  );

-- ---------------------------------------------------------------------------
-- Guarda de mensajes: ahora tambien registra el retiro del archivo
-- ---------------------------------------------------------------------------
-- Es la misma funcion de C31 (se conservan todas sus reglas y mensajes). Cambios: el INSERT ignora
-- `attachment_purged_at`; el UPDATE acepta registrar el retiro (solo si es posible retirar y el objeto ya
-- no existe en Storage) y anular un mensaje limpia la marca.
create or replace function private.chat_messages_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_kind public.chat_thread_kind;
  v_reply_thread uuid;
  v_prefix text;
  v_obj_size text;
  v_obj_found boolean;
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
    else
      -- El adjunto debe ser un objeto del bucket, en la carpeta de este hilo y de este mensaje.
      v_prefix := new.thread_id::text || '/' || new.id::text || '/';
      if char_length(new.attachment_path) <= char_length(v_prefix)
         or left(new.attachment_path, char_length(v_prefix)) <> v_prefix then
        raise exception 'El archivo adjunto no corresponde a este mensaje.';
      end if;
      if new.attachment_name is null
         or char_length(regexp_replace(new.attachment_name, '^\s+|\s+$', '', 'g')) not between 1 and 255 then
        raise exception 'El nombre del archivo debe tener de 1 a 255 caracteres.';
      end if;
      if new.attachment_mime is null or btrim(new.attachment_mime) = '' or new.attachment_size is null then
        raise exception 'El archivo adjunto debe indicar su tipo y su tamaño.';
      end if;
      select true, o.metadata ->> 'size' into v_obj_found, v_obj_size
      from storage.objects o
      where o.bucket_id = 'chat-attachments' and o.name = new.attachment_path;
      if v_obj_found is not true then
        raise exception 'El archivo adjunto no existe en el almacenamiento.';
      end if;
      if v_obj_size ~ '^[0-9]+$' and v_obj_size::bigint <> new.attachment_size then
        raise exception 'El tamaño del archivo no coincide con el subido.';
      end if;
    end if;
    if new.reply_to is not null then
      select m.thread_id into v_reply_thread from public.chat_messages m where m.id = new.reply_to;
      if v_reply_thread is distinct from new.thread_id then
        raise exception 'El mensaje original ya no está disponible.';
      end if;
    end if;
    new.edited_at := null;
    new.deleted_at := null;
    new.attachment_purged_at := null;
    return new;
  end if;

  -- UPDATE. La referencia `reply_to` pasa a nulo cuando se borra el mensaje original (borrar un
  -- grupo): es la accion de la FK, no una edicion; el cliente no tiene privilegio sobre esa columna.
  if new.reply_to is null and old.reply_to is not null
     and (new.id, new.thread_id, new.author_id, new.body, new.attachment_path, new.attachment_name,
          new.attachment_mime, new.attachment_size, new.created_at, new.edited_at, new.deleted_at,
          new.attachment_purged_at)
         is not distinct from
         (old.id, old.thread_id, old.author_id, old.body, old.attachment_path, old.attachment_name,
          old.attachment_mime, old.attachment_size, old.created_at, old.edited_at, old.deleted_at,
          old.attachment_purged_at) then
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

  -- Retiro del archivo: lo registra cualquier integrante, una sola vez, y solo cuando todos liberaron y
  -- el objeto ya no esta en Storage (el cliente lo retiro con la API antes).
  if new.attachment_purged_at is distinct from old.attachment_purged_at then
    if old.attachment_purged_at is not null or new.attachment_purged_at is null then
      raise exception 'El archivo ya fue eliminado para liberar espacio.';
    end if;
    if (new.body, new.edited_at, new.deleted_at) is distinct from (old.body, old.edited_at, old.deleted_at) then
      raise exception 'Al registrar el retiro del archivo no se modifica nada más.';
    end if;
    if not exists (select 1 from public.chat_members cm where cm.thread_id = old.thread_id and cm.user_id = v_uid) then
      raise exception 'Solo los integrantes de la conversación pueden hacerlo.';
    end if;
    if old.attachment_path is null or not public.chat_attachment_purgeable(old.id) then
      raise exception 'Todavía no todos liberaron el archivo.';
    end if;
    if exists (select 1 from storage.objects o
        where o.bucket_id = 'chat-attachments' and o.name = old.attachment_path) then
      raise exception 'El archivo todavía está en el almacenamiento.';
    end if;
    new.attachment_purged_at := clock_timestamp();
    return new;
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
    new.attachment_purged_at := null;
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
revoke execute on function private.chat_messages_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: las respuestas deben llegar en vivo (postgres_changes aplica el RLS de lectura)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_attachment_states'
     ) then
    alter publication supabase_realtime add table public.chat_attachment_states;
  end if;
end;
$$;
