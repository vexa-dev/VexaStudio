-- C25: barrido de seguridad. Toda tabla de `public` tiene RLS, `anon` no tiene acceso a nada,
-- nadie borra (salvo las tablas de union) y las funciones internas no estan abiertas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select is(
  (select coalesce(string_agg(c.relname, ', '), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  '', 'toda tabla de public tiene RLS activado');
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')), 28,
  'las 28 tablas del alcance (si agregas una, agregale RLS y politicas y actualiza este numero)');
select is(
  (select coalesce(string_agg(c.relname, ', '), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> 'audit_chain_head'
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)),
  '', 'toda tabla (salvo audit_chain_head, interna) tiene politicas');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'audit_chain_head'), 0,
  'audit_chain_head no tiene politicas: nadie la lee ni escribe');
select is(
  (select coalesce(string_agg(c.relname, ', '), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
     and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
       or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))),
  '', 'anon no tiene acceso a ninguna tabla ni vista');
select is(
  (select coalesce(string_agg(c.relname, ', '), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
     and c.relname not in ('project_members', 'task_labels', 'time_entry_participants', 'time_entry_evidence')
     and has_table_privilege('authenticated', c.oid, 'delete')),
  '', 'authenticated no borra en ninguna tabla (salvo las de union)');
select is(
  (select coalesce(string_agg(c.relname, ', '), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
     and (has_table_privilege('authenticated', c.oid, 'truncate')
       or has_table_privilege('authenticated', c.oid, 'trigger')
       or has_table_privilege('authenticated', c.oid, 'references'))),
  '', 'authenticated no tiene TRUNCATE, TRIGGER ni REFERENCES');
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'insert')
  and not has_table_privilege('authenticated', 'public.audit_log', 'update')
  and not has_table_privilege('authenticated', 'public.audit_log', 'delete'),
  'audit_log es de solo lectura para authenticated');
select ok(not has_table_privilege('service_role', 'public.audit_log', 'insert')
  and not has_table_privilege('service_role', 'public.audit_log', 'update')
  and not has_table_privilege('service_role', 'public.audit_log', 'delete'),
  'tampoco el rol de servicio escribe en audit_log');
select ok(not has_table_privilege('authenticated', 'public.audit_chain_head', 'select'),
  'authenticated no lee la cabeza de la cadena');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon no ejecuta ninguna funcion de public');
select is(
  (select coalesce(string_agg(p.proname, ', '), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute')),
  '', 'anon no ejecuta funciones internas');
select is(
  (select coalesce(string_agg(p.proname, ', '), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname not in ('close_timer_entry', 'prepare_task_hours',
       -- Implementaciones de los RPC del chat (B5b): los envoltorios publicos son SECURITY INVOKER y
       -- llaman a estas funciones, que validan permisos adentro y tienen `grant execute` explicito.
       'chat_direct_thread', 'chat_save_group', 'chat_delete_group', 'chat_react')),
  '', 'las funciones SECURITY DEFINER internas no estan abiertas a authenticated (salvo las de reloj y las de los RPC del chat)');
select is(
  (select coalesce(string_agg(p.proname, ', '), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and p.proname not in (
     'auth_role', 'is_admin', 'is_partner_or_admin', 'is_project_member', 'can_access_project',
     'can_view_task', 'chat_can_access', 'hours_entry_tagged', 'verify_audit_chain',
     'list_my_sessions', 'revoke_my_session')),
  -- chat_can_access es un ayudante de permisos (integrante del hilo, o admin en grupos), igual que can_view_task.
  -- list_my_sessions y revoke_my_session no son ayudantes de permisos: son definers porque el esquema `auth`
  -- no esta expuesto a la API; solo leen/borran filas de auth.sessions de auth.uid() (sin IP) y solo `authenticated` las ejecuta.
  -- hours_entry_tagged responde solo si quien llama esta etiquetado en un registro (evita recursion de RLS).
  '', 'las unicas funciones publicas SECURITY DEFINER son los ayudantes de permisos y la verificacion de la cadena');
select is(
  (select coalesce(string_agg(p.proname, ', '), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and not coalesce(p.proconfig::text, '') like '%search_path=%'),
  '', 'toda funcion SECURITY DEFINER fija su search_path');
select is(
  (select count(*)::int from pg_views v where v.schemaname = 'public'
     and not coalesce((select 'security_invoker=true' = any (c.reloptions) from pg_class c
       where c.oid = (quote_ident(v.schemaname) || '.' || quote_ident(v.viewname))::regclass), false)),
  0, 'toda vista usa security_invoker (aplica el RLS de quien consulta)');
select is((select relrowsecurity from pg_class where oid = 'storage.objects'::regclass), true,
  'storage.objects tiene RLS');

select * from finish();
rollback;
