-- Seed LOCAL equivalente al mock (apps/web/src/services/mock/seed.ts + CLAUDE.md "Datos simulados").
-- Se ejecuta con `supabase db reset`. SOLO PARA DESARROLLO LOCAL:
--   * las cuentas usan la contrasena de desarrollo `vexa-local-dev` (no existe en la nube);
--   * nunca ejecutar este archivo contra un proyecto remoto.
-- Fechas FIJAS (determinista): el ancla es 2026-10-03 12:00 hora de Lima (17:00 UTC).
-- El registro de actividad arranca vacio, como en el mock: se desactivan los triggers de
-- auditoria solo durante la carga y se reactivan al final.

begin;

alter table public.tasks disable trigger audit_tasks;
alter table public.projects disable trigger audit_projects;
alter table public.project_labels disable trigger audit_project_labels;
alter table public.sprints disable trigger audit_sprints;
alter table public.time_entries disable trigger audit_time_entries;
alter table public.profiles disable trigger audit_profiles;
alter table public.settings disable trigger audit_settings;
alter table public.project_members disable trigger audit_project_members_ins;
alter table public.task_labels disable trigger audit_task_labels_ins;

-- ---------------------------------------------------------------------------
-- Usuarios (auth.users + identities) y perfiles
-- ---------------------------------------------------------------------------
-- El trigger on_auth_user_created crea cada perfil como colaborador; el rol se ajusta abajo.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('vexa-local-dev', extensions.gen_salt('bf')),
  '2026-10-03 17:00:00+00',
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('name', u.name, 'area', u.area, 'weekly_hours', u.weekly_hours),
  '2026-10-03 17:00:00+00', '2026-10-03 17:00:00+00',
  '', '', '', '', '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'jhony@vexa.test', 'Jhony Rivera', 'management_finance', 15),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'rober@vexa.test', 'Rober Vasquez', 'technical', 20),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'jose@vexa.test', 'José Gónzales', 'commercial', 15),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'diego@vexa.test', 'Diego Choque', 'design_marketing', 25),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'alex@vexa.test', 'Alex · Colaborador demo', 'technical', 15)
) as u(id, email, name, area, weekly_hours);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', '2026-10-03 17:00:00+00', '2026-10-03 17:00:00+00', '2026-10-03 17:00:00+00'
from auth.users u;

update public.profiles set role = 'admin'
  where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set role = 'partner'
  where id in ('00000000-0000-4000-8000-000000000002',
               '00000000-0000-4000-8000-000000000003',
               '00000000-0000-4000-8000-000000000004');

-- ---------------------------------------------------------------------------
-- Ajustes del acuerdo
-- ---------------------------------------------------------------------------
update public.settings set
  points_per_hour = 20,
  points_per_sol = 2,
  min_compliance = 0.8,
  weeks_per_month = 4,
  expense_approval_limit_pen = 50,
  entry_edit_days = 7,
  daily_reminder_time = '21:00',
  daily_reminder_weekdays = '{1,3,5}',
  weekly_hours_reminder_time = '20:00',
  weekly_hours_reminder_weekday = 0;

-- ---------------------------------------------------------------------------
-- Proyectos y miembros (los 4 socios en todos; Alex solo en Vexa Studio)
-- ---------------------------------------------------------------------------
insert into public.projects (id, name, type, status) values
  ('10000000-0000-4000-8000-000000000001', 'Vexa Studio', 'internal', 'active'),
  ('10000000-0000-4000-8000-000000000002', 'Fivuza', 'product', 'active'),
  ('10000000-0000-4000-8000-000000000003', 'Vantage', 'product', 'paused');

insert into public.project_members (project_id, user_id)
select p.id, m.id
from public.projects p
cross join public.profiles m
where m.role <> 'collaborator'
   or (m.role = 'collaborator' and p.id = '10000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- Sprints: el 1 cerrado, el 2 activo (el trigger crea el primero como activo)
-- ---------------------------------------------------------------------------
insert into public.sprints (id, project_id, start_date, end_date, goal) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '2026-09-12', '2026-09-25', 'Alinear alcance y montar la infraestructura');
update public.sprints set status = 'closed' where id = '20000000-0000-4000-8000-000000000001';
insert into public.sprints (id, project_id, start_date, end_date, goal) values
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   '2026-09-26', '2026-10-09', 'Base del frontend con datos simulados');

-- ---------------------------------------------------------------------------
-- Tareas: todas las columnas del kanban
-- ---------------------------------------------------------------------------
insert into public.tasks (id, sprint_id, project_id, title, status, assignee_id, estimate_hours, link) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'Definir alcance del MVP', 'done', '00000000-0000-4000-8000-000000000001', 6, null),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'Crear repositorio y pipeline de despliegue', 'done', '00000000-0000-4000-8000-000000000002', 8,
   'https://github.com/vexa/vexa-studio/pull/1'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'Configurar proyecto base y capa de servicios', 'done', '00000000-0000-4000-8000-000000000002', 10,
   'https://github.com/vexa/vexa-studio/pull/4'),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'Diseñar login y layout responsive', 'review', '00000000-0000-4000-8000-000000000004', 8, null),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'Reglas de puntos y cumplimiento', 'in_progress', '00000000-0000-4000-8000-000000000002', 12, null),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'Guía de marca para la app', 'done', '00000000-0000-4000-8000-000000000004', 5, null),
  ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'Registrar gastos recurrentes', 'todo', '00000000-0000-4000-8000-000000000001', 4, null),
  ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'Lista de prospectos para Fivuza', 'in_progress', '00000000-0000-4000-8000-000000000003', 6, null),
  ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'Plantilla de propuesta comercial', 'todo', '00000000-0000-4000-8000-000000000003', 5, null),
  ('30000000-0000-4000-8000-000000000010', null, '10000000-0000-4000-8000-000000000002',
   'Landing de Fivuza', 'todo', '00000000-0000-4000-8000-000000000004', 10, null),
  ('30000000-0000-4000-8000-000000000011', null, '10000000-0000-4000-8000-000000000002',
   'Definir precios del plan inicial', 'todo', null, 3, null),
  -- Tareas de Alex (colaborador): una de proyecto miembro, una de otro proyecto sin membresia
  -- y una independiente.
  ('30000000-0000-4000-8000-000000000012', null, '10000000-0000-4000-8000-000000000001',
   'Revisar navegación del estudio', 'todo', '00000000-0000-4000-8000-000000000005', 2, null),
  ('30000000-0000-4000-8000-000000000013', null, '10000000-0000-4000-8000-000000000002',
   'Revisar textos de Fivuza', 'todo', '00000000-0000-4000-8000-000000000005', 1, null),
  ('30000000-0000-4000-8000-000000000014', null, null,
   'Preparar notas de la reunión', 'todo', '00000000-0000-4000-8000-000000000005', 1, null);

-- ---------------------------------------------------------------------------
-- Horas de las ultimas 6 semanas: 3 registros por semana y socio. Lo anterior al sprint
-- activo (hace mas de 7 dias) ya esta validado; un registro de Diego (semana 3) esta pagado.
-- ---------------------------------------------------------------------------
insert into public.time_entries (
  id, user_id, task_id, project_id, started_at, ended_at, hours,
  paid, validated, validated_at, validated_by, reviewed_by, created_at
)
with anchor as (select timestamptz '2026-10-03 17:00:00+00' as t),
members(ord, user_id, hours, tasks) as (values
  (1, '00000000-0000-4000-8000-000000000001'::uuid, 5.0::numeric,
     array['30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000007']::uuid[]),
  (2, '00000000-0000-4000-8000-000000000002'::uuid, 7.5::numeric,
     array['30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003',
           '30000000-0000-4000-8000-000000000005']::uuid[]),
  (3, '00000000-0000-4000-8000-000000000003'::uuid, 3.0::numeric,
     array['30000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000009']::uuid[]),
  (4, '00000000-0000-4000-8000-000000000004'::uuid, 7.5::numeric,
     array['30000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000006',
           '30000000-0000-4000-8000-000000000010']::uuid[])
),
grid as (
  select m.ord, m.user_id, m.hours, w, s,
         m.tasks[(w + s) % cardinality(m.tasks) + 1] as task_id,
         w * 7 + s * 2 + case when w = 0 then 0 else 1 end as d
  from members m cross join generate_series(0, 5) w cross join generate_series(0, 2) s
)
select
  ('40000000-0000-4000-8000-' || lpad(row_number() over (order by g.ord, g.w, g.s)::text, 12, '0'))::uuid,
  g.user_id, g.task_id, t.project_id,
  a.t - make_interval(days => g.d) - g.hours * interval '1 hour',
  a.t - make_interval(days => g.d),
  g.hours,
  (g.ord = 4 and g.w = 3 and g.s = 0),
  g.d > 7,
  case when g.d > 7 then a.t - make_interval(days => g.d - 7) end,
  case when g.d > 7 then
    case when g.ord = 1 then '00000000-0000-4000-8000-000000000002'::uuid
         else '00000000-0000-4000-8000-000000000001'::uuid end end,
  case when g.d > 7 then
    case when g.ord = 1 then '00000000-0000-4000-8000-000000000002'::uuid
         else '00000000-0000-4000-8000-000000000001'::uuid end end,
  a.t - make_interval(days => g.d)
from grid g
cross join anchor a
join public.tasks t on t.id = g.task_id;

-- ---------------------------------------------------------------------------
-- Gastos en varios estados. Se cargan pendientes y los votos los resuelven (trigger):
-- e-2 sigue pendiente (2 a favor), e-3 queda aprobado (3 a favor), e-4 rechazado (2 en contra).
-- ---------------------------------------------------------------------------
insert into public.expenses (
  id, paid_by, amount, currency, concept, category, status, reimbursed, before_signing, created_at
) values
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 35, 'PEN',
   'Hosting del entorno de pruebas', 'infrastructure', 'approved', false, false, '2026-09-13 17:00:00+00'),
  ('50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', 180, 'PEN',
   'Licencia anual de herramienta de diseño', 'software', 'pending', false, false, '2026-10-01 17:00:00+00'),
  ('50000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 120, 'PEN',
   'Registro de marca (trámite)', 'legal', 'pending', false, false, '2026-09-21 17:00:00+00'),
  ('50000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 90, 'PEN',
   'Publicidad en redes', 'marketing', 'pending', false, false, '2026-09-24 17:00:00+00'),
  ('50000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', 45, 'PEN',
   'Banco de imágenes', 'software', 'approved', true, false, '2026-09-17 17:00:00+00'),
  ('50000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 13, 'USD',
   'Dominio de VEXA (año 1)', 'infrastructure', 'approved', false, true, '2026-03-17 17:00:00+00');

insert into public.expense_votes (expense_id, user_id, in_favor) values
  ('50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', true),
  ('50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', true),
  ('50000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', true),
  ('50000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', true),
  ('50000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', true),
  ('50000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', false),
  ('50000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', false);

-- Gasto recurrente: dominio de VEXA, previo a la firma (no suma puntos).
insert into public.recurring_expenses (id, concept, amount, currency, next_date, periodicity, before_signing) values
  ('60000000-0000-4000-8000-000000000001', 'Dominio de VEXA', 13, 'USD', '2027-02-23', 'yearly', true);

alter table public.tasks enable trigger audit_tasks;
alter table public.projects enable trigger audit_projects;
alter table public.project_labels enable trigger audit_project_labels;
alter table public.sprints enable trigger audit_sprints;
alter table public.time_entries enable trigger audit_time_entries;
alter table public.profiles enable trigger audit_profiles;
alter table public.settings enable trigger audit_settings;
alter table public.project_members enable trigger audit_project_members_ins;
alter table public.task_labels enable trigger audit_task_labels_ins;

commit;
