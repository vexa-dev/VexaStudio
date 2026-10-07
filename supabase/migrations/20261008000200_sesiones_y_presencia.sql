-- Dispositivos y sesiones (lista y cierre por sesion) y presencia siempre activa.
--
-- 1) Sesiones: el esquema `auth` no esta expuesto a la API, asi que dos funciones SECURITY DEFINER
--    en `public` lo leen y lo tocan acotadas estrictamente a auth.uid(). No devuelven la IP.
-- 2) Presencia: "en linea" ya no se puede apagar. La columna se conserva por compatibilidad.

-- ---------------------------------------------------------------------------
-- 1) Sesiones propias
-- ---------------------------------------------------------------------------
create or replace function public.list_my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  aal text,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at, s.updated_at, s.created_at)::timestamptz as updated_at,
         left(s.user_agent, 300),
         s.aal::text,
         s.id::text = (select auth.jwt() ->> 'session_id') as is_current
  from auth.sessions s
  where s.user_id = (select auth.uid())
    and (s.not_after is null or s.not_after > now())
  order by 6 desc, 3 desc
$$;

create or replace function public.revoke_my_session(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;
  if p_id::text = (select auth.jwt() ->> 'session_id') then
    raise exception 'No puedes cerrar la sesión de este dispositivo desde aquí.'
      using errcode = '22023';
  end if;
  delete from auth.sessions s where s.id = p_id and s.user_id = v_uid;
  if not found then
    raise exception 'No se encontró esa sesión.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.list_my_sessions() from public, anon;
revoke execute on function public.revoke_my_session(uuid) from public, anon;
grant execute on function public.list_my_sessions() to authenticated;
grant execute on function public.revoke_my_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Presencia siempre activa
-- ---------------------------------------------------------------------------
update public.chat_status set presence = true where not presence;
alter table public.chat_status
  add constraint chat_status_presence_always check (presence);
