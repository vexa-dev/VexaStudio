# PRD — Vexa Studio

Sep 29, 2026 · @Jhony Rivera

Vexa Studio es la plataforma web única donde los socios de VEXA planifican sprints, registran horas y gastos, se comunican de forma asíncrona y ven su cumplimiento y participación calculados solos. Reemplaza el Excel, los documentos sueltos, Discord y GitHub Projects. Stack: Supabase + Vercel. MVP en dos etapas: frontend con datos simulados y luego Supabase.

## Objetivos y métricas de éxito

La plataforma tiene éxito si registrar el trabajo cuesta segundos y nadie vuelve a llenar documentos a mano.

| Objetivo | Métrica | Meta |
| --- | --- | --- |
| Registro sin fricción | Tiempo para registrar horas de una tarea | Menos de 30 s (un clic con temporizador) |
| Constancia del equipo | Socios con horas registradas cada semana | 4 de 4 |
| Visibilidad del compromiso | Cumplimiento mensual visible sin cálculos manuales | Automático, en tiempo real |
| Confianza en el equity | Registros con historial y validación en el cierre de sprint | 100 % |
| Todo en un lugar | Herramientas externas para tareas, horas, gastos y avisos | 0 (sin Excel, Discord ni GitHub Projects) |
| Preparada para crecer | Nuevo colaborador operativo | En menos de 1 día, con acceso limitado |

## Usuarios, roles y permisos

Tres roles cubren a los socios de hoy y a los colaboradores del futuro. Cada usuario tiene además un área (técnica, gestión y finanzas, comercial, diseño y marketing).

| Acción | Admin (Gestión y finanzas) | Socio | Colaborador (fase 3) |
| --- | --- | --- | --- |
| Ver tareas y sprints | Todos | Todos | Solo proyectos asignados |
| Crear y asignar tareas | Sí | Sí | No |
| Registrar sus horas | Sí | Sí | Sí (sin puntos) |
| Editar horas de otros | No | No | No |
| Registrar gastos | Sí | Sí | No |
| Votar decisiones y gastos | Sí | Sí | No |
| Ver dashboard de equity | Sí | Sí | No |
| Cambiar parámetros del acuerdo | Solo tras votación unánime | No | No |
| Invitar usuarios | Tras votación | No | No |

El rol Admin no da poder sobre los datos de otros: solo administra configuración y ejecuta lo que se vota.

## Módulos y alcance por fase

El MVP cubre lo que hoy se hace en Excel, Word, Discord y GitHub Projects; lo demás entra después, cuando el MVP se use de verdad.

| Módulo | MVP (fase 1) | Fase 2 | Fase 3 |
| --- | --- | --- | --- |
| Auth y perfiles | Login, área, horas comprometidas | Ausencias planificadas (exámenes) | Invitación de colaboradores |
| Proyectos, sprints y tareas | Tablero kanban por sprint, responsable, estimación, enlace a repo o PR | Backlog, velocidad del equipo, plantillas de tareas | Vista por cliente |
| Horas | Temporizador en cada tarea + registro manual rápido | Validación masiva en cierre de sprint | Horas pagadas a colaboradores |
| Gastos | Gasto con foto del comprobante, aprobación 3 de 4 si supera S/ 50, gastos recurrentes | Reembolsos | Presupuesto por proyecto |
| Dashboard | Cumplimiento del mes, puntos, participación | Histórico por mes, exportar PDF | Congelamiento del equity |
| Comunicación asíncrona | Daily (3 preguntas), comentarios en tareas con @menciones, anuncios | Hilos por proyecto | — |
| Notificaciones | In-app + push (PWA): daily pendiente, horas sin registrar el domingo, aprobaciones, renovaciones | Resumen semanal por email | Preferencias por usuario |
| Reuniones | Convocatoria semanal: propuesta de 2 o 3 horarios, votación, confirmación con enlace de Meet y registro de asistencia | Agenda y acta de cada reunión | — |
| Decisiones | — | Votaciones según tipo (3 de 4, unanimidad) con registro | — |
| Comercial | — | CRM ligero: prospectos, estado, próximo contacto | Propuestas y cotizaciones |
| Documentos | Acuerdo de socios enlazado | Acuerdo versionado dentro de la plataforma | Onboarding de colaboradores |
| Motivación | Progreso del sprint visible | Rachas de registro y metas del sprint | — |

**Fuera de alcance:** chat en tiempo real y videollamadas. Construirlos consumiría el MVP entero y ya existen gratis; las reuniones usan un enlace de Google Meet guardado en la plataforma. La comunicación de trabajo (daily, comentarios, anuncios, decisiones) sí vive en la plataforma.

## Flujos clave

Cinco flujos concentran el uso diario; cada uno debe resolverse en 1 o 2 pantallas.

**Trabajar una tarea**

1. El socio abre "Mis tareas" y pulsa *Iniciar* en una tarea: arranca el temporizador y la tarea pasa a "En progreso".
2. Pulsa *Detener*: se crea el registro de horas ligado a la tarea (editable durante 7 días).
3. Si olvidó el temporizador, registra manualmente: tarea, horas, fecha.
4. Al mover la tarea a "Hecho", puede enlazar el PR o entregable.

**Registrar un gasto**

1. Monto, concepto, categoría y foto del comprobante.
2. Si supera S/ 50, se notifica a los demás y se aprueba con 3 de 4 votos.
3. Los gastos recurrentes (dominio) avisan 30 y 7 días antes de renovar.

**Daily asíncrono**

1. Lunes, miércoles y viernes a las 9:00 p. m., notificación: "¿Qué hiciste, qué harás, qué te bloquea?"
2. El socio responde en un formulario de 3 campos; puede autocompletar "qué hice" con las tareas trabajadas desde el último daily.
3. Los bloqueos con @mención notifican a la persona mencionada.

**Cierre de sprint**

1. Revisión: la plataforma muestra lo comprometido vs lo entregado por socio.
2. Cada socio valida en bloque las horas de los demás; una objeción abre un comentario en ese registro.
3. Las horas validadas quedan bloqueadas y cuentan para los puntos.

**Convocar la reunión semanal** (no tiene día fijo)

1. El product owner crea la convocatoria de la semana con 2 o 3 horarios posibles.
2. Cada socio marca en cuáles puede; la plataforma recuerda a quien no haya respondido en 24 h.
3. El PO confirma el horario con más disponibilidad; todos reciben la fecha y el enlace de Meet.
4. Al terminar, el PO marca la asistencia; dos ausencias seguidas sin aviso cuentan como incumplimiento.

## Reglas de negocio

Las reglas vienen del acuerdo de socios y se guardan como parámetros editables solo por votación unánime.

| Regla | Valor inicial |
| --- | --- |
| Puntos por hora no pagada y validada | 20 |
| Puntos por S/ 1 aportado (gasto no reembolsado) | 2 |
| Horas pagadas / gastos reembolsados | 0 puntos |
| Cumplimiento mínimo mensual | 80 % de horas/semana × 4 |
| Aprobación de gasto | Automática hasta S/ 50; 3 de 4 votos si es mayor |
| Edición de un registro propio | Hasta 7 días o hasta su validación, lo que ocurra primero |
| Gastos previos a la firma | No suman puntos (incluido el dominio) |
| Ausencia justificada | Avisada con 7 días: reduce el mínimo de ese periodo |
| Incumplimiento | Menos del 80 % en un mes, 2 reuniones seguidas o 2 sprints sin entregar lo comprometido |

La participación de cada socio es sus puntos divididos entre el total, calculada en la base de datos.

## Modelo de datos

Postgres en Supabase, con RLS en todas las tablas. Las tablas marcadas con (F2) se crean en la fase 2.

| Tabla | Campos clave | Notas |
| --- | --- | --- |
| `profiles` | id (= auth.users), nombre, rol, área, horas\_semana, activo | Rol: admin, socio, colaborador |
| `settings` | clave, valor, actualizado\_por | Parámetros del acuerdo (puntos, % mínimo, límite de gasto) |
| `projects` | id, nombre, tipo (interno, producto, cliente), estado | Plataforma, Fivuza, Vantage, clientes |
| `sprints` | id, project\_id, inicio, fin, objetivo, estado | 2 semanas |
| `tasks` | id, sprint\_id, project\_id, título, estado, asignado\_a, estimación\_h, enlace | Kanban: pendiente, en progreso, revisión, hecho |
| `time_entries` | id, user\_id, task\_id, inicio, fin, horas, pagada, validada, validada\_en | Una sola entrada abierta por usuario (temporizador) |
| `expenses` | id, pagado\_por, monto, moneda, concepto, categoría, comprobante\_url, estado, reembolsado, previo\_a\_firma | Comprobante en Supabase Storage |
| `expense_votes` | expense\_id, user\_id, voto | Solo si supera el límite |
| `recurring_expenses` | id, concepto, monto, moneda, próxima\_fecha, periodicidad | Dominio: US$ 13, anual |
| `daily_updates` | id, user\_id, fecha, hecho, haré, bloqueos |  |
| `comments` | id, entidad, entidad\_id, user\_id, texto, menciones | Sobre tareas, gastos, horas |
| `announcements` | id, autor, texto, fijado |  |
| `absences` | id, user\_id, desde, hasta, motivo, horas\_reducidas | Ausencia justificada |
| `notifications` | id, user\_id, tipo, payload, leída | In-app + push |
| `push_subscriptions` | user\_id, endpoint, keys | Web Push (VAPID) |
| `audit_log` | tabla, registro\_id, acción, antes, después, user\_id, fecha | Por trigger; solo lectura |
| `decisions`, `votes` (F2) | tipo, título, estado / decision\_id, user\_id, voto | Mayoría 3 de 4 o unanimidad |
| `meetings`, `meeting_slots`, `slot_votes` | semana, estado, fecha\_confirmada, enlace, asistentes / meeting\_id, inicio / slot\_id, user\_id, disponible |  |
| `leads` (F2) | empresa, contacto, estado, próximo\_contacto, responsable | CRM ligero |

Vistas calculadas: `member_monthly_summary` (horas del mes, mínimo, cumplimiento) y `member_points` (puntos por horas, por dinero, total, participación). Nada de esto se calcula en el frontend.

## Arquitectura y stack

React (con Vite) en Vercel como frontend y Supabase como backend completo; todo en planes gratuitos para 4 a 10 usuarios.

| Pieza | Tecnología | Uso |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript + Tailwind + React Router, como SPA y PWA | Interfaz web instalable en móvil y escritorio |
| Hosting | Vercel | Despliegue automático desde la rama main; previews por PR |
| Auth | Supabase Auth (email + Google) | Sin registro público: solo invitación |
| Datos | Postgres + RLS + vistas | Reglas de acceso y cálculos en la base de datos |
| Archivos | Supabase Storage (bucket privado) | Comprobantes de gastos |
| Tiempo real | Supabase Realtime | Tablero, comentarios y notificaciones sin recargar |
| Tareas programadas | pg\_cron + Edge Functions | Recordatorio de daily, horas del domingo, renovaciones |
| Notificaciones push | Web Push con VAPID | Avisos en el celular sin app nativa |

Confianza en los datos:

- RLS: cada usuario escribe solo sus registros; nadie borra, solo anula con motivo.
- Trigger de `audit_log` en horas, gastos, tareas y parámetros.
- Registros validados quedan bloqueados.
- Respaldo semanal de la base de datos exportado fuera de Supabase.

## Datos iniciales

La base de datos arranca con estos socios y parámetros (seed). Las horas vienen del acuerdo de socios; el mínimo mensual es horas/semana × 4 × 80 %.

| Socio | Rol | Área | Horas/semana | Mínimo mensual |
| --- | --- | --- | --- | --- |
| Jhony Rivera | Admin (product owner) | Gestión y finanzas | 15 | 48 h |
| Rober Vasquez | Socio | Líder técnico | 20 | 64 h |
| José Gónzales | Socio | Comercial | 15 | 48 h |
| Diego Choque | Socio | Diseño y marketing | 25 | 80 h |

| Parámetro (`settings`) | Valor |
| --- | --- |
| `points_per_hour` | 20 |
| `points_per_sol` | 2 |
| `min_compliance` | 0.8 |
| `weeks_per_month` | 4 |
| `expense_approval_limit_pen` | 50 |
| `entry_edit_days` | 7 |
| `daily_reminder_time` | 21:00 (America/Lima), lunes, miércoles y viernes |
| `weekly_hours_reminder` | Domingo 20:00 (America/Lima) |

Proyectos iniciales: Vexa Studio (interno, activo), Fivuza (producto, activo), Vantage (producto, en pausa). Gasto recurrente inicial: dominio de VEXA, US$ 13 anual, próxima renovación 23/02/2027, marcado como previo a la firma (no suma puntos).

## Plan de entregas del MVP

Dos etapas: primero todo el frontend con datos simulados, después Supabase. La capa de datos va separada de las pantallas, así que pasar de datos simulados a reales no obliga a reescribir la interfaz.

| Etapa | Bloque | Entregable |
| --- | --- | --- |
| 1. Frontend | F1 Base | Proyecto Vite, rutas, layout responsive, componentes de UI, tipos del dominio, servicios con datos simulados, login simulado con los 4 socios |
| 1. Frontend | F2 Trabajo | Proyectos, sprints, tablero kanban, temporizador y registro manual de horas |
| 1. Frontend | F3 Control | Gastos con comprobante y votación, gastos recurrentes, dashboard de cumplimiento y puntos, cierre de sprint con validación |
| 1. Frontend | F4 Equipo | Daily, comentarios con @menciones, anuncios, convocatoria de reunión semanal, notificaciones in-app, PWA instalable |
| 2. Backend | B1 Base de datos | Migraciones, RLS, triggers, vistas de equity, seed, Auth real por invitación |
| 2. Backend | B2 Integración | Implementación Supabase de cada servicio, Storage de comprobantes, Realtime |
| 2. Backend | B3 Automatización | pg\_cron y Edge Functions para recordatorios, Web Push |

La plataforma se usa para el trabajo real desde que termina B2. En la etapa 1 los criterios de aceptación se prueban con datos simulados; los que dependen de RLS, triggers o push se verifican en la etapa 2. Si un bloque no cierra a tiempo, se recorta alcance, no se extiende el plazo.

## Criterios de aceptación del MVP

Un sprint se da por cerrado solo si cumple sus criterios y la definición de hecho.

**Sprint 1**

- [ ] Solo usuarios invitados pueden entrar; no existe registro público.
- [ ] Un socio crea un sprint, crea tareas y las mueve por las columnas del kanban.
- [ ] Iniciar el temporizador en una tarea detiene cualquier otro abierto del mismo usuario.
- [ ] Un usuario no puede crear, editar ni ver como propias las horas de otro (verificado con RLS, no solo en la UI).
- [ ] Toda creación, edición o anulación de horas queda en `audit_log`.

**Sprint 2**

- [ ] Un gasto mayor a S/ 50 queda pendiente hasta tener 3 votos a favor.
- [ ] El dashboard muestra, por socio y mes, horas, mínimo, cumplimiento, puntos y participación, calculados en vistas SQL.
- [ ] Validar horas en el cierre de sprint las bloquea para edición.
- [ ] Horas pagadas, gastos reembolsados y gastos previos a la firma suman 0 puntos.

**Sprint 3**

- [ ] El recordatorio de daily llega a las 9:00 p. m. (hora de Lima) como push y en la app.
- [ ] Una @mención en un comentario notifica al mencionado.
- [ ] Se puede convocar la reunión semanal, votar horarios, confirmar y marcar asistencia.
- [ ] La app se instala como PWA en Android e iOS.

**Definición de hecho (toda tarea):** PR revisado por otro socio, migraciones versionadas en el repo, políticas RLS en toda tabla nueva, sin errores de TypeScript ni de lint, desplegado en el preview de Vercel y probado en móvil.

## Decisiones y pendientes

Decisiones tomadas:

- Nombre: Vexa Studio. Reunión semanal: sin día fijo; se acuerda cada semana con anticipación mediante la convocatoria de la plataforma.
- Frontend: React con Vite (el equipo ya lo domina).
- Product owner: Jhony.
- Recordatorio de daily: 9:00 p. m.
- Los repositorios siguen en GitHub; la plataforma solo reemplaza el tablero de tareas. Desarrollo en dos etapas: primero el frontend con datos simulados y luego Supabase. No se usa hoja de cálculo de transición.

No quedan pendientes para iniciar el desarrollo.
