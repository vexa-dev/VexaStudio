-- C31: adjuntos del chat en Storage e historial compartido en el servidor (B5d).
--
-- Los adjuntos dejan de ser base64 dentro del mensaje: son archivos en el bucket privado
-- `chat-attachments` (25 MiB) y el mensaje solo guarda la referencia (`attachment_path/name/mime/size`).
--
--   * Ruta: `<thread_id>/<message_id>/<nombre del archivo>`. El cliente genera el id del mensaje, sube
--     el archivo y luego inserta el mensaje con `attachment_path`. Al reenviar, copia el objeto a la
--     carpeta del hilo y del mensaje nuevos.
--   * Acceso a los objetos: el mismo que a los mensajes (`chat_can_access` sobre el hilo de la primera
--     carpeta): integrantes y, solo en grupos, admins. Los objetos son inmutables (sin UPDATE) y solo
--     los borra quien los subio. `anon` no tiene nada.
--   * La guarda de mensajes valida la referencia al insertar: prefijo de hilo y mensaje, objeto
--     existente, nombre, tipo y tamano coherentes con el objeto. Anular sigue siendo suave: vacia las
--     columnas y el cliente retira el archivo (mejor esfuerzo).
--   * `public.chat_list_shared` entrega el historial compartido (adjuntos y enlaces) paginado en el
--     servidor, apoyado en el RLS de `chat_messages`.

-- ---------------------------------------------------------------------------
-- Bucket privado con lista cerrada de tipos (sin ejecutables)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments', 'chat-attachments', false, 26214400,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf',
    'application/zip', 'application/x-zip-compressed', 'application/vnd.rar',
    'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/markdown',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Politicas de storage.objects
-- ---------------------------------------------------------------------------
-- La primera carpeta es el id del hilo. Si no parece un uuid la politica es falsa (el CASE evita
-- que un cast invalido lance un error).
drop policy if exists chat_attachments_select on storage.objects;
drop policy if exists chat_attachments_insert on storage.objects;
drop policy if exists chat_attachments_delete_own on storage.objects;

create policy chat_attachments_select on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-attachments' and public.auth_role() is not null
    and case when (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.chat_can_access(((storage.foldername(name))[1])::uuid) else false end
  );
create policy chat_attachments_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-attachments' and public.auth_role() is not null
    and case when (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.chat_can_access(((storage.foldername(name))[1])::uuid) else false end
  );
-- Sin politica de UPDATE: los objetos son inmutables.
create policy chat_attachments_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-attachments' and public.auth_role() is not null
    and (owner = (select auth.uid()) or owner_id = (select auth.uid())::text)
    and case when (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.chat_can_access(((storage.foldername(name))[1])::uuid) else false end
  );

-- ---------------------------------------------------------------------------
-- Guarda de mensajes: ahora valida la referencia del adjunto al insertar
-- ---------------------------------------------------------------------------
-- Es la misma funcion de C29 (se conservan todas sus reglas y mensajes); solo se agrega, dentro de
-- la rama INSERT, la validacion del adjunto.
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
revoke execute on function private.chat_messages_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Historial compartido en el servidor (adjuntos y enlaces)
-- ---------------------------------------------------------------------------
create index if not exists chat_messages_shared_idx
  on public.chat_messages (thread_id, created_at desc) where attachment_path is not null;

-- SECURITY INVOKER: el RLS de chat_messages decide; sin acceso al hilo no hay filas.
create or replace function public.chat_list_shared(
  p_thread uuid,
  p_before timestamptz default null,
  p_limit integer default 200
) returns setof public.chat_messages
language sql stable security invoker set search_path = ''
as $$
  select m.*
  from public.chat_messages m
  where m.thread_id = p_thread
    and m.deleted_at is null
    and (m.attachment_path is not null or m.body ~* 'https?://')
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 0), 500)
$$;
revoke execute on function public.chat_list_shared(uuid, timestamptz, integer) from public, anon;
grant execute on function public.chat_list_shared(uuid, timestamptz, integer) to authenticated;
