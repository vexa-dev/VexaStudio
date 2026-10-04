-- C20: gastos, votos, gastos recurrentes y bucket privado de comprobantes.
--
-- Reglas (PRD, acuerdo de socios y packages/domain/src/rules.ts):
--   * Solo socios y admin ven y registran gastos; los colaboradores no.
--   * Hasta el limite (settings.expense_approval_limit_pen) se aprueba solo; por encima
--     queda pendiente hasta 3 votos a favor. Un gasto en otra moneda siempre vota
--     (el limite esta en soles), igual que resolveExpenseStatus.
--   * Se rechaza cuando ya no se pueden alcanzar los 3 votos a favor.
--   * Nadie borra ni edita: se anula con motivo. Los votos no se modifican.

create type public.expense_category as enum (
  'infrastructure', 'software', 'marketing', 'legal', 'other'
);
create type public.expense_status as enum ('pending', 'approved', 'rejected', 'voided');
create type public.currency_code as enum ('PEN', 'USD');
create type public.periodicity as enum ('monthly', 'yearly');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  paid_by uuid not null references public.profiles (id),
  amount numeric(12, 2) not null check (amount > 0),
  currency public.currency_code not null default 'PEN',
  concept text not null check (btrim(concept) <> ''),
  category public.expense_category not null default 'other',
  -- Ruta del comprobante en el bucket privado `receipts` (<user_id>/<archivo>).
  receipt_url text,
  status public.expense_status not null default 'pending',
  reimbursed boolean not null default false,
  -- Gasto previo a la firma del acuerdo: no suma puntos.
  before_signing boolean not null default false,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text,
  check ((voided_at is null) = (void_reason is null)),
  check ((status = 'voided') = (voided_at is not null))
);
create index expenses_paid_by_idx on public.expenses (paid_by);
create index expenses_status_idx on public.expenses (status);

create table public.expense_votes (
  expense_id uuid not null references public.expenses (id),
  user_id uuid not null references public.profiles (id),
  in_favor boolean not null,
  created_at timestamptz not null default now(),
  primary key (expense_id, user_id)
);

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  concept text not null check (btrim(concept) <> ''),
  amount numeric(12, 2) not null check (amount > 0),
  currency public.currency_code not null default 'PEN',
  next_date date not null,
  periodicity public.periodicity not null,
  before_signing boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Guardas
-- ---------------------------------------------------------------------------
-- Inserta: el estado lo decide el servidor (no el cliente). Actualiza: solo `reimbursed`
-- (admin), la anulacion (quien pago) y el estado por la resolucion de votos (interno).
create function private.expenses_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_limit numeric;
begin
  if v_uid is null or coalesce(current_setting('vexa.internal', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.paid_by <> v_uid then
      raise exception 'Solo puedes registrar gastos pagados por ti' using errcode = '42501';
    end if;
    select s.expense_approval_limit_pen into v_limit from public.settings s;
    new.concept := btrim(new.concept);
    new.reimbursed := false;
    new.voided_at := null;
    new.void_reason := null;
    new.status := case
      when new.currency <> 'PEN' or new.amount > v_limit then 'pending'::public.expense_status
      else 'approved'::public.expense_status
    end;
    return new;
  end if;

  -- UPDATE
  if (new.id, new.paid_by, new.amount, new.currency, new.concept, new.category,
      new.receipt_url, new.before_signing, new.created_at)
     is distinct from
     (old.id, old.paid_by, old.amount, old.currency, old.concept, old.category,
      old.receipt_url, old.before_signing, old.created_at) then
    raise exception 'Un gasto registrado no se edita: se anula con motivo' using errcode = '42501';
  end if;
  if old.status = 'voided' then
    raise exception 'El gasto ya esta anulado' using errcode = '42501';
  end if;
  if new.voided_at is distinct from old.voided_at then
    if old.paid_by <> v_uid then
      raise exception 'Solo quien pago el gasto puede anularlo' using errcode = '42501';
    end if;
    if char_length(btrim(coalesce(new.void_reason, ''))) < 3 then
      raise exception 'Escribe el motivo de la anulacion' using errcode = '23514';
    end if;
    new.voided_at := clock_timestamp();
    new.void_reason := btrim(new.void_reason);
    new.status := 'voided';
    new.reimbursed := old.reimbursed;
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'El estado del gasto lo define la votacion' using errcode = '42501';
  end if;
  if new.reimbursed is distinct from old.reimbursed and not public.is_admin() then
    raise exception 'Solo un administrador registra reembolsos' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger expenses_guard before insert or update on public.expenses
  for each row execute function private.expenses_guard();

-- Un voto solo entra mientras el gasto esta pendiente.
create function private.expense_votes_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is not null and new.user_id <> v_uid then
    raise exception 'Solo puedes votar por ti' using errcode = '42501';
  end if;
  if not exists (select 1 from public.expenses e where e.id = new.expense_id and e.status = 'pending') then
    raise exception 'Este gasto ya no admite votos' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger expense_votes_guard before insert on public.expense_votes
  for each row execute function private.expense_votes_guard();

-- Tras cada voto se recalcula el estado (equivale a rules.resolveExpenseStatus; el total de
-- votantes es el de socios y admin activos, 4 en el acuerdo actual).
create function private.expense_votes_resolve() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev text := coalesce(current_setting('vexa.internal', true), '');
  v_total integer;
  v_for integer;
  v_against integer;
  v_status public.expense_status;
begin
  select count(*) into v_total from public.profiles p
  where p.active and p.role in ('admin', 'partner');
  select count(*) filter (where v.in_favor), count(*) filter (where not v.in_favor)
  into v_for, v_against from public.expense_votes v where v.expense_id = new.expense_id;
  v_status := case
    when v_for >= 3 then 'approved'::public.expense_status
    when v_against > v_total - 3 then 'rejected'::public.expense_status
    else 'pending'::public.expense_status
  end;
  perform set_config('vexa.internal', 'on', true);
  update public.expenses set status = v_status
  where id = new.expense_id and status = 'pending' and v_status <> 'pending';
  perform set_config('vexa.internal', v_prev, true);
  return null;
end;
$$;
create trigger expense_votes_resolve after insert on public.expense_votes
  for each row execute function private.expense_votes_resolve();

-- ---------------------------------------------------------------------------
-- Privilegios y RLS
-- ---------------------------------------------------------------------------
revoke all on public.expenses, public.expense_votes, public.recurring_expenses
  from public, anon, authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select, insert on public.expense_votes to authenticated;
grant select, insert, update on public.recurring_expenses to authenticated;

alter table public.expenses enable row level security;
alter table public.expense_votes enable row level security;
alter table public.recurring_expenses enable row level security;

create policy expenses_select on public.expenses for select to authenticated
  using (public.is_partner_or_admin());
create policy expenses_insert on public.expenses for insert to authenticated
  with check (public.is_partner_or_admin() and paid_by = (select auth.uid()));
-- Quien paga anula; admin registra reembolsos. La guarda limita que columnas cambian.
create policy expenses_update on public.expenses for update to authenticated
  using (public.is_partner_or_admin() and (paid_by = (select auth.uid()) or public.is_admin()))
  with check (public.is_partner_or_admin() and (paid_by = (select auth.uid()) or public.is_admin()));

create policy expense_votes_select on public.expense_votes for select to authenticated
  using (public.is_partner_or_admin());
create policy expense_votes_insert on public.expense_votes for insert to authenticated
  with check (public.is_partner_or_admin() and user_id = (select auth.uid()));

create policy recurring_expenses_select on public.recurring_expenses for select to authenticated
  using (public.is_partner_or_admin());
create policy recurring_expenses_insert_admin on public.recurring_expenses
  for insert to authenticated with check (public.is_admin());
create policy recurring_expenses_update_admin on public.recurring_expenses
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RPC (SECURITY INVOKER)
-- ---------------------------------------------------------------------------
-- ExpenseService.create: el estado (aprobado/pendiente) lo fija la guarda.
create function public.create_expense(
  p_amount numeric,
  p_currency public.currency_code,
  p_concept text,
  p_category public.expense_category,
  p_receipt_url text default null,
  p_before_signing boolean default false
) returns public.expenses
language plpgsql security invoker set search_path = ''
as $$
declare
  e public.expenses;
begin
  insert into public.expenses (
    paid_by, amount, currency, concept, category, receipt_url, before_signing
  ) values (
    (select auth.uid()), p_amount, p_currency, p_concept, p_category,
    nullif(p_receipt_url, ''), coalesce(p_before_signing, false)
  ) returning * into e;
  return e;
end;
$$;

-- ExpenseService.vote: registra el voto; el trigger resuelve el estado.
create function public.vote_expense(p_expense uuid, p_in_favor boolean)
returns public.expenses
language plpgsql security invoker set search_path = ''
as $$
declare
  e public.expenses;
begin
  insert into public.expense_votes (expense_id, user_id, in_favor)
  values (p_expense, (select auth.uid()), p_in_favor);
  select * into e from public.expenses where id = p_expense;
  return e;
end;
$$;

-- ExpenseService.void: nadie borra; se anula con motivo.
create function public.void_expense(p_id uuid, p_reason text)
returns public.expenses
language plpgsql security invoker set search_path = ''
as $$
declare
  e public.expenses;
begin
  update public.expenses set voided_at = clock_timestamp(), void_reason = p_reason
  where id = p_id returning * into e;
  if not found then
    raise exception 'El gasto no existe o no tienes permiso';
  end if;
  return e;
end;
$$;

revoke execute on function
  public.create_expense(numeric, public.currency_code, text, public.expense_category, text, boolean),
  public.vote_expense(uuid, boolean), public.void_expense(uuid, text)
  from public, anon;
grant execute on function
  public.create_expense(numeric, public.currency_code, text, public.expense_category, text, boolean),
  public.vote_expense(uuid, boolean), public.void_expense(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado de comprobantes (<user_id>/<archivo>)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Socios y admin leen comprobantes; suben solo a su propia carpeta. Sin UPDATE ni DELETE:
-- nadie borra ni reemplaza.
create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_partner_or_admin());
create policy receipts_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and public.is_partner_or_admin()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
