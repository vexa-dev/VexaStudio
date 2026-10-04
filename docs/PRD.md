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

| Acción | Admin (cualquier área) | Socio | Colaborador |
| --- | --- | --- | --- |
| Ver tareas | Todas | Propias; tablero de proyectos con membresía | Propias; tablero de proyectos con membresía |
| Crear proyectos y gestionar miembros | Sí | No | No |
| Modificar tablero del proyecto | Sí | No; consulta | No; consulta |
| Mover tareas propias en Mis tareas | Sí | Sí | Sí |
| Crear y asignar tareas | Sí | No | No |
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
2. Pausa/reanuda el reloj cuando lo necesita. Finalizar una sesión prepara un borrador en Horas, sin enviarlo automáticamente.
3. Terminar una tarea prepara un borrador con el tiempo medido o su estimación editable. Selecciona varias en Horas y confirma un total distribuido entre ellas; se crea un único registro pendiente de revisión.
4. Sin tarea o sin reloj, conserva el registro manual de actividad, fecha, horario y respaldo opcional.

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

## Ajuste autorizado de Horas — 02/10/2026

Por solicitud del usuario, en el frontend mock se permite registrar actividad sin tarea: `taskId` nullable, proyecto opcional, descripción y evidencia por enlace. El registro manual captura inicio real y duración en Lima; temporizadores nuevos identifican su origen. Registros legacy conservan datos existentes, sin asumir que sus timestamps representan horarios reales.

Revisión entre socios/admin: sin autoaprobación, con aprobador/fecha y solicitud de aclaración con motivo. Las correcciones de aprobaciones dentro de la ventana de edición vuelven a pendiente; una aclaración habilita corrección fuera de esa ventana. Pagados/anulados no se editan. Se auditan creación, edición, aclaración, aprobación y anulación. Solo horas aprobadas no pagadas generan puntos. Vista inicial Registro, Historial filtrable, Resumen mensual (días/horarios en Lima) y Revisión. Sin integración remota en esta etapa.


### Ajuste autorizado: Mi día (02/10/2026)

Mi día incorpora plan personal de hasta tres prioridades por fecha de Lima, con tareas asignadas o actividades libres; meta personal y acceso desde cada prioridad a Tareas, con el reloj allí y la confirmación de horas en Horas; resumen diario y daily local desplegable con autoguardado, historial y ayuda para redactar desde el trabajo registrado. El estado completado del plan no equivale a completar una tarea o aprobar horas. El foco de concentración es configurable y persistente por persona, separado del registro de trabajo. La comunicación compartida del daily y los bloqueos queda pendiente de la integración backend; no se envían notificaciones desde estos borradores.


### Flujo autorizado de tareas, proyectos y horas (02/10/2026)

Esta definición sustituye las reglas anteriores que permitían a todos los socios crear/asignar tareas o registrar automáticamente al detener el reloj.

- Admin de cualquier área: crea proyectos y tareas, asigna responsables y mantiene membresías explícitas. Una tarea admite proyecto y sprint nulos. Ser responsable de una tarea no concede membresía del proyecto.
- Personas sin rol admin: Mis tareas contiene solo sus asignaciones, con un kanban editable sincronizado con la misma tarea del proyecto. Proyectos muestra únicamente membresías explícitas; su tablero incluye las tareas del proyecto pero es de consulta, incluso para tareas propias. Las URL y las operaciones están verificadas en el servicio mock.
- Finalizar tarea o reloj prepara un borrador propio. El tiempo estimado es una sugerencia; el tiempo medido se conserva con precisión. No hay aprobación automática, ni puntos, ni horas en resúmenes antes de confirmar. Reabrir/terminar una tarea no duplica su borrador. Sesiones adicionales se acumulan en el borrador pendiente.
- Registro de Horas: selección múltiple de borradores, total editable distribuido por tarea, ajuste individual, fecha y texto adicional opcional. Confirma un solo registro con asignaciones de horas por tarea/proyecto; revisiones e historial muestran el detalle. Los lotes se verifican antes de modificar datos, impidiendo doble envío. Actividades sin tarea conservan el formulario manual.
- Reloj centralizado en Tareas: inicio, pausa, continuar y finalizar; controles globales también disponibles. Usa fechas persistidas y segmentos de actividad; una pestaña oculta, congelada o cerrada no pierde tiempo y las pausas no se suman. No se pausa al cambiar de pestaña: trabajar fuera de la plataforma es válido. La coordinación de escrituras usa Web Locks cuando está disponible, con refresco por eventos de almacenamiento.
- Aviso cada hora y sonido optativo activado por un gesto. Una pestaña ejecutándose puede reproducir sonido; una página congelada o un navegador cerrado no ejecuta JavaScript. Al regresar se muestra un solo aviso del umbral pendiente con acción de pausar. No se promete una alarma con el navegador cerrado ni se deduce cumplimiento del reloj. Web Push/validación remota quedan para la etapa Supabase.
- Migración aditiva del mock, sin reiniciar historial. Se incorpora Alex, colaborador de demostración, con una tarea del proyecto miembro, una de otro proyecto sin membresía y una independiente. Los cuatro socios conservan sus perfiles y datos.

Mi día sirve para organizar prioridades, definir una meta y concentrarse con pomodoro. El daily es un borrador de comunicación separado, plegado inicialmente; no registra horas ni modifica asignaciones. La integración compartida de daily permanece pendiente.


## Ajuste aprobado: descripción y etiquetas (02/10/2026)

- Task incorpora `description?: string` (Markdown opcional, máximo 20,000 caracteres) y etiquetas adjuntas. Solo admin crea/edita este contenido.
- ProjectLabel: id, projectId, name (1–40 caracteres, sin duplicados por proyecto ignorando mayúsculas/espacios externos), color (hexadecimal de seis dígitos). Solo admin lista, crea y edita el catálogo dentro del proyecto.
- Una tarea puede tener varias etiquetas de su propio proyecto; sin proyecto no admite etiquetas. Al cambiar de proyecto deben retirarse las etiquetas anteriores. El servicio valida pertenencia y usa nombre/color canónicos, ignorando valores falsificados en el cliente.
- Colaborador ve descripción y etiquetas adjuntas en las tareas que puede consultar; no recibe acceso al catálogo ni al proyecto por una asignación puntual. Renombrar/recolorear una etiqueta actualiza las tarjetas existentes.
- Mock persiste el catálogo sin reiniciar datos antiguos; la futura implementación remota debe aplicar estos mismos permisos mediante RLS y resolver etiquetas adjuntas sin exponer el catálogo al colaborador.
- La UI usa Markdown seguro sin HTML y menús temáticos compartidos en todos los módulos.


## Ajuste autorizado: registro de actividad y backend Supabase (03/10/2026)

- Se autoriza un registro de actividad inmutable: quién creó, editó, movió, aprobó o anuló qué, con hora exacta del servidor (Lima, con segundos), cambios campo a campo, motivo y rol del actor en ese momento. Solo se agrega; nadie edita ni borra entradas.
- Visibilidad: admin ve todo; socio ve los proyectos de los que es miembro y sus propias acciones; colaborador solo las suyas.
- En el mock el registro lo escribe la capa de servicios; en Supabase lo escribirá un trigger sobre `audit_log`. La UI solo lee.
- Se autoriza el backend Supabase para todo lo que hoy implementa el mock, primero en local (CLI + Docker) y con la nube al final. El mock sigue siendo la fuente por defecto.
