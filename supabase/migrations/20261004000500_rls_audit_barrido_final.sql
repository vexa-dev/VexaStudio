-- C23: RLS y bloqueo de escritura del registro de actividad + barrido final de seguridad.
--
-- 1. Lectura de audit_log por rol (igual que AuditService del mock):
--      admin        todo
--      socio        eventos de proyectos de los que es miembro + sus propias acciones
--      colaborador  solo sus propias acciones
--    No hay politicas de INSERT/UPDATE/DELETE: solo escribe el trigger (SECURITY DEFINER).
-- 2. Barrido: toda tabla de `public` con RLS, sin acceso para `anon`, nadie borra salvo las
--    tablas de union, y las funciones internas (`private`) no quedan abiertas por defecto.
-- 3. Comprobacion final que hace fallar la migracion si algo queda abierto.

-- ---------------------------------------------------------------------------
-- 1. audit_log: solo lectura filtrada
-- ---------------------------------------------------------------------------
revoke all on public.audit_log, public.audit_chain_head
  from public, anon, authenticated, service_role;
grant select on public.audit_log to authenticated, service_role;

create policy audit_log_select on public.audit_log for select to authenticated
  using (
    public.auth_role() is not null and (
      public.is_admin()
      or actor_id = (select auth.uid())
      or (
        public.auth_role() = 'partner'
        and project_id is not null
        and public.is_project_member(project_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Barrido de privilegios
-- ---------------------------------------------------------------------------
-- anon no tiene nada en `public` (la aplicacion solo se usa con sesion).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- authenticated: sin TRUNCATE/REFERENCES/TRIGGER y sin DELETE (nadie borra), salvo las
-- tablas de union cuya baja forma parte de la gestion (miembros de proyecto, etiquetas).
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke delete on all tables in schema public from authenticated;
grant delete on public.project_members, public.task_labels to authenticated;

-- Funciones internas: nada por defecto; solo las que usan las RPC/guardas como invoker.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.iso(timestamptz),
  private.lima_date(timestamptz),
  private.can_edit_entry(timestamptz, timestamptz, boolean, text),
  private.close_timer_entry(uuid, timestamptz),
  private.prepare_task_hours(uuid, uuid, uuid, text, numeric),
  private.assert_activity(uuid, text),
  private.assert_hours(numeric),
  private.assert_interval(timestamptz, numeric, uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Comprobacion: si algo queda abierto, la migracion falla
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad text;
begin
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if v_bad is not null then
    raise exception 'Tablas sin RLS: %', v_bad;
  end if;

  select string_agg(c.relname, ', ') into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    and (has_table_privilege('anon', c.oid, 'select')
      or has_table_privilege('anon', c.oid, 'insert')
      or has_table_privilege('anon', c.oid, 'update')
      or has_table_privilege('anon', c.oid, 'delete'));
  if v_bad is not null then
    raise exception 'anon tiene acceso a: %', v_bad;
  end if;

  select string_agg(c.relname, ', ') into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and c.relname not in ('project_members', 'task_labels')
    and has_table_privilege('authenticated', c.oid, 'delete');
  if v_bad is not null then
    raise exception 'authenticated puede borrar en: %', v_bad;
  end if;

  if has_table_privilege('authenticated', 'public.audit_log', 'insert')
     or has_table_privilege('authenticated', 'public.audit_log', 'update')
     or has_table_privilege('authenticated', 'public.audit_log', 'delete')
     or has_table_privilege('authenticated', 'public.audit_log', 'truncate') then
    raise exception 'audit_log no es de solo lectura para authenticated';
  end if;
end;
$$;
