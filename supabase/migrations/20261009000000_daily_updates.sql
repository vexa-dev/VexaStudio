-- Daily compartido: una actualizacion por persona y por fecha de Lima (hecho, hare, bloqueos).
--   * Lectura: admin y socios ven todos los dailies; un colaborador solo los suyos.
--   * Escritura: cada persona crea y corrige solo el suyo, y solo el de HOY en America/Lima. La fecha
--     la decide el servidor (el reloj del cliente no es de fiar): la guarda rechaza cualquier otra.
--   * Enviar de nuevo el mismo dia corrige el daily (upsert por user_id + date). Nadie borra.
--   * Los bloqueos con @mencion y el recordatorio de las 21:00 quedan fuera (comentarios y avisos con reloj).
--   * Brecha conocida: sin evento de auditoria (el catalogo de audit_log admite solo ciertas tablas);
--     si se pide, se agrega en su propia migracion.

create table public.daily_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id),
  date date not null,
  done text not null default '' constraint daily_updates_done_len_check check (char_length(done) <= 2000),
  will_do text not null default '' constraint daily_updates_will_do_len_check check (char_length(will_do) <= 2000),
  blockers text not null default '' constraint daily_updates_blockers_len_check check (char_length(blockers) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_updates_user_date_key unique (user_id, date),
  constraint daily_updates_content_check check (btrim(done) <> '' or btrim(will_do) <> '')
);
create index daily_updates_date_idx on public.daily_updates (date desc);

create trigger daily_updates_updated_at before update on public.daily_updates
  for each row execute function private.set_updated_at();

-- Guarda: texto recortado, solo el daily de hoy (Lima) y la fila no cambia de dueno ni de fecha.
create function private.daily_updates_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Lima')::date;
begin
  new.done := btrim(new.done);
  new.will_do := btrim(new.will_do);
  new.blockers := btrim(new.blockers);
  if new.date <> v_today then
    raise exception 'Solo puedes enviar el daily de hoy' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id or new.date <> old.date then
      raise exception 'El daily no cambia de dueno ni de fecha' using errcode = 'check_violation';
    end if;
    if old.date <> v_today then
      raise exception 'Solo puedes corregir el daily de hoy' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger daily_updates_guard before insert or update on public.daily_updates
  for each row execute function private.daily_updates_guard();

revoke all on public.daily_updates from public, anon, authenticated;
grant select on public.daily_updates to authenticated;
-- user_id se llena con auth.uid() y la politica exige que sea quien llama.
grant insert (user_id, date, done, will_do, blockers) on public.daily_updates to authenticated;
grant update (date, done, will_do, blockers) on public.daily_updates to authenticated;

alter table public.daily_updates enable row level security;

create policy daily_updates_select on public.daily_updates for select to authenticated
  using (public.auth_role() is not null and (user_id = (select auth.uid()) or public.is_partner_or_admin()));
create policy daily_updates_insert_own on public.daily_updates for insert to authenticated
  with check (public.auth_role() is not null and user_id = (select auth.uid()));
create policy daily_updates_update_own on public.daily_updates for update to authenticated
  using (public.auth_role() is not null and user_id = (select auth.uid()))
  with check (public.auth_role() is not null and user_id = (select auth.uid()));
