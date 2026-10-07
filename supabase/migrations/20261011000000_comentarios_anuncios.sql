-- Comentarios con @menciones y anuncios.
--
-- Comentarios (`comments`): hilo sobre una tarea, un registro de horas o un gasto.
--   * Lectura: quien puede leer la entidad padre (el RLS de tasks, time_entries y expenses decide,
--     por eso `can_view_comment_entity` es SECURITY INVOKER).
--   * Escritura: solo insertar, solo como uno mismo y solo sobre una entidad que se pueda leer. `user_id`
--     sale de auth.uid() (no esta en el privilegio de INSERT). Nadie edita ni borra: es un registro inmutable.
--   * Menciones: el cliente manda los ids que resolvio desde `@usuario`; la guarda los depura (sin
--     duplicados, sin uno mismo, solo personas activas que pueden leer la entidad, maximo 10) y un trigger
--     crea un aviso `mention` por persona. Los avisos solo los crean triggers (private.notify).
--   * Brecha conocida: sin evento de auditoria (el catalogo de audit_log admite solo ciertas tablas).
--
-- Anuncios (`announcements`): el PRD no dice quien los lee; se deja a admin y socios. Solo admin
-- publica y fija o desfija (unica columna editable: `pinned`). Nadie borra.

-- ---------------------------------------------------------------------------
-- Tipos y tablas
-- ---------------------------------------------------------------------------
create type public.comment_entity as enum ('task', 'expense', 'time_entry');

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  entity public.comment_entity not null,
  entity_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id),
  text text not null constraint comments_text_len_check check (char_length(text) between 1 and 2000),
  mentions uuid[] not null default '{}' constraint comments_mentions_len_check check (cardinality(mentions) <= 10),
  created_at timestamptz not null default now()
);
create index comments_entity_idx on public.comments (entity, entity_id, created_at);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id),
  text text not null constraint announcements_text_len_check check (char_length(text) between 1 and 1000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index announcements_order_idx on public.announcements (pinned desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Ayudantes de permisos
-- ---------------------------------------------------------------------------
-- La persona que llama puede leer la entidad (SECURITY INVOKER: aplica el RLS de la tabla padre).
create function public.can_view_comment_entity(p_entity public.comment_entity, p_id uuid) returns boolean
language sql stable security invoker set search_path = ''
as $$
  select case p_entity
    when 'task' then exists (select 1 from public.tasks t where t.id = p_id)
    when 'time_entry' then exists (select 1 from public.time_entries e where e.id = p_id)
    when 'expense' then exists (select 1 from public.expenses x where x.id = p_id)
    else false
  end
$$;
revoke execute on function public.can_view_comment_entity(public.comment_entity, uuid) from public, anon;
grant execute on function public.can_view_comment_entity(public.comment_entity, uuid) to authenticated;

-- Lo mismo para OTRA persona (para depurar menciones). Replica el RLS de cada tabla; solo la usan los
-- triggers (SECURITY DEFINER interna, sin acceso para authenticated).
create function private.user_can_view_comment_entity(p_user uuid, p_entity public.comment_entity, p_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  with u as (select p.id, p.role from public.profiles p where p.id = p_user and p.active)
  select exists (select 1 from u) and case p_entity
    when 'task' then exists (
      select 1 from public.tasks t, u where t.id = p_id and (
        u.role = 'admin'
        or t.assignee_id = u.id
        or (t.project_id is not null and exists (
          select 1 from public.project_members m where m.project_id = t.project_id and m.user_id = u.id))))
    when 'time_entry' then exists (
      select 1 from public.time_entries e, u where e.id = p_id and (
        e.user_id = u.id
        or (not e.draft and (
          u.role in ('admin', 'partner')
          or exists (select 1 from public.time_entry_participants tp where tp.entry_id = e.id and tp.user_id = u.id)))))
    when 'expense' then exists (select 1 from public.expenses x where x.id = p_id)
      and exists (select 1 from u where u.role in ('admin', 'partner'))
    else false
  end
$$;
revoke execute on function private.user_can_view_comment_entity(uuid, public.comment_entity, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios y RLS
-- ---------------------------------------------------------------------------
revoke all on public.comments, public.announcements from public, anon, authenticated;
grant select on public.comments to authenticated;
-- user_id no se concede: lo llena auth.uid() y nadie puede falsificarlo.
grant insert (entity, entity_id, text, mentions) on public.comments to authenticated;

grant select on public.announcements to authenticated;
grant insert (text, pinned) on public.announcements to authenticated;
grant update (pinned) on public.announcements to authenticated;

alter table public.comments enable row level security;
alter table public.announcements enable row level security;

create policy comments_select on public.comments for select to authenticated
  using (public.auth_role() is not null and public.can_view_comment_entity(entity, entity_id));
create policy comments_insert_own on public.comments for insert to authenticated
  with check (
    public.auth_role() is not null
    and user_id = (select auth.uid())
    and public.can_view_comment_entity(entity, entity_id)
  );

create policy announcements_select on public.announcements for select to authenticated
  using (public.is_partner_or_admin());
create policy announcements_insert_admin on public.announcements for insert to authenticated
  with check (public.is_admin() and author_id = (select auth.uid()));
create policy announcements_update_admin on public.announcements for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Guardas
-- ---------------------------------------------------------------------------
-- Comentario: texto recortado y menciones depuradas. El autor es quien llama (la politica lo exige).
create function private.comments_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.text := btrim(new.text);
  new.mentions := coalesce((
    select array_agg(m.id order by m.first_pos)
    from (
      select x.id, min(x.pos) as first_pos
      from unnest(new.mentions) with ordinality as x(id, pos)
      where x.id <> new.user_id
        and private.user_can_view_comment_entity(x.id, new.entity, new.entity_id)
      group by x.id
    ) m
  ), '{}');
  return new;
end;
$$;
create trigger comments_guard before insert on public.comments
  for each row execute function private.comments_guard();
revoke execute on function private.comments_guard() from public, anon, authenticated;

create function private.announcements_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.text := btrim(new.text);
  if new.text = '' then
    raise exception 'El anuncio no puede estar vacio' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger announcements_guard before insert on public.announcements
  for each row execute function private.announcements_guard();
revoke execute on function private.announcements_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aviso: una notificacion `mention` por persona mencionada
-- ---------------------------------------------------------------------------
create function private.notify_comment_mentions() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor public.profiles;
  v_recipient record;
  v_subject text;
  v_place text;
  v_project uuid;
  v_task uuid;
begin
  if cardinality(new.mentions) = 0 then
    return null;
  end if;
  select * into v_actor from public.profiles p where p.id = new.user_id;
  if new.entity = 'task' then
    select left(t.title, 120), t.project_id, t.id into v_subject, v_project, v_task
      from public.tasks t where t.id = new.entity_id;
    v_place := 'en la tarea «' || coalesce(v_subject, '') || '»';
  elsif new.entity = 'time_entry' then
    v_place := 'en un registro de horas';
  else
    v_place := 'en un gasto';
  end if;

  for v_recipient in
    select p.id, p.name from public.profiles p where p.id = any (new.mentions)
  loop
    perform private.notify(v_recipient.id, 'mention', jsonb_strip_nulls(jsonb_build_object(
      'title', 'Te mencionaron en un comentario',
      'message', left(v_actor.name, 120) || ' te mencionó ' || v_place || '.',
      'actorName', left(v_actor.name, 120),
      'actorRole', private.notify_role_label(v_actor.role),
      'recipientName', left(v_recipient.name, 120),
      'taskName', case when new.entity = 'task' then v_subject end,
      'taskId', v_task::text,
      'projectId', v_project::text,
      'entity', new.entity::text,
      'entityId', new.entity_id::text,
      'commentId', new.id::text,
      'details', left(new.text, 300),
      'nextStep', 'Abre el comentario y responde si hace falta.'
    )));
  end loop;
  return null;
end;
$$;
create trigger notify_comments_mention after insert on public.comments
  for each row execute function private.notify_comment_mentions();
revoke execute on function private.notify_comment_mentions() from public, anon, authenticated;
