-- C26: privilegios por defecto sobre funciones nuevas (B2, endurecimiento).
--
-- Antes: las funciones nuevas creadas por `postgres` quedaban ejecutables por PUBLIC (y, en
-- `public`, por `authenticated`), salvo que cada migracion las revocara a mano. Un privilegio por
-- defecto con `in schema` solo SUMA al global, asi que quitar PUBLIC exige tambien la forma global.
--
-- Despues: toda funcion nueva de `postgres` nace sin permiso de ejecucion para PUBLIC, anon ni
-- authenticated; hace falta un `grant execute` explicito (las migraciones actuales ya lo hacen).
-- No cambia los privilegios de las funciones existentes. Es idempotente.
--
-- Alcance: solo el rol `postgres`, que es quien ejecuta las migraciones. Los privilegios por
-- defecto de `supabase_admin` (extensiones, realtime, graphql) son de la plataforma y no se tocan.
-- `service_role` conserva su ejecucion por defecto en `public` (rol de servidor, nunca del cliente).

-- Global: quita el EXECUTE implicito de PUBLIC en cualquier esquema.
alter default privileges for role postgres revoke execute on functions from public;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;
