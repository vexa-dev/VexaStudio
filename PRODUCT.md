# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Los 4 socios de VEXA (Jhony Rivera, admin y product owner; Rober Vasquez, líder técnico; José Gónzales, comercial; Diego Choque, diseño y marketing). Trabajan por horas comprometidas a la semana (15 a 25 h) y no comparten oficina: coordinan de forma asíncrona.

Situación de uso más frecuente: el celular, en segundos, entre otras tareas (iniciar o detener el temporizador, registrar horas, votar un gasto, responder el daily). El escritorio se usa para planificar sprints, revisar el tablero y el dashboard. El frontend permite probar colaboradores con acceso limitado mediante Alex, un perfil adicional de demostración.

Trabajo esperado: registrar el trabajo en menos de 30 s, ver el propio cumplimiento del mes y saber cuánta participación se lleva cada socio sin hacer cuentas.

## Product Purpose

Vexa Studio es la plataforma interna única de VEXA. Reemplaza el Excel, los documentos sueltos, Discord y GitHub Projects (para tareas): sprints y kanban, registro de horas con temporizador, gastos con aprobación, daily asíncrono, comentarios, anuncios, convocatoria de la reunión semanal y dashboard de cumplimiento, puntos y participación.

Éxito: 4 de 4 socios registran horas cada semana, el cumplimiento mensual se ve sin cálculos manuales, el 100 % de los registros tiene historial y validación en el cierre de sprint, y ninguna herramienta externa se usa para tareas, horas, gastos ni avisos.

## Positioning

Vexa Studio convierte el trabajo diario de 4 socios (horas, gastos, sprints) en un equity dinámico calculado solo, sin Excel ni herramientas sueltas. El cálculo sale de las reglas del acuerdo de socios; ninguna herramienta genérica de tareas lo hace.

## Operating Context

- Documentos fuente: `docs/PRD.md` (fuente de verdad del alcance) y `docs/acuerdo-socios.md`.
- Zona horaria del negocio: `America/Lima` (UTC-5); cortes de semana y mes en hora de Lima.
- Ritmo: sprints de 2 semanas, cierre de sprint con validación de horas entre socios, daily lunes, miércoles y viernes a las 9:00 p. m., reunión semanal sin día fijo convocada por el product owner con enlace de Google Meet.
- Los repositorios siguen en GitHub; la plataforma solo reemplaza el tablero de tareas.
- Uso al aire libre y con poca luz es un escenario real que la interfaz debe soportar.

## Capabilities and Constraints

- Etapa actual: solo frontend con datos simulados (capa de servicios `mock` sobre `localStorage`); Supabase (Auth, Postgres, RLS, Storage, Realtime) llega en la etapa 2. Web Push también es etapa 2; en la etapa 1 las notificaciones son solo in-app.
- Reglas de negocio: 20 puntos por hora no pagada y validada; 2 puntos por S/ 1 de gasto aprobado, no reembolsado y no previo a la firma; mínimo mensual = horas/semana × 4 × 80 %; gasto mayor a S/ 50 pendiente hasta 3 votos a favor; un solo temporizador abierto por usuario; nadie borra, se anula con motivo; edición de un registro propio hasta 7 días, con reapertura de revisión si estaba aprobado; aclaraciones pendientes permiten corrección fuera de la ventana.
- Roles: admin, socio y colaborador. Admin de cualquier área crea proyectos/tareas y asigna responsables. Personas sin rol admin trabajan en sus propias tareas y consultan únicamente proyectos con membresía explícita; asignar una tarea no otorga membresía. Nadie edita las horas de otras personas.
- Idioma de la interfaz: español (Perú). Montos `S/ 1,234.50`, fechas `dd/mm/yyyy`.
- Sin registro público: acceso por invitación en el producto previsto. Hoy el acceso funcional usa los cuatro socios y un colaborador de demo sin contraseña; el formulario visual de correo/contraseña y recuperación solo informa que la conexión de cuentas está pendiente.
- Fuera de alcance: chat en tiempo real y videollamadas.
- Stack (ya en el repositorio): React, Vite, TypeScript strict, Tailwind CSS 4, React Router, TanStack Query, PWA, Vercel.

## Brand Commitments

- Nombre: VEXA Studio (VEXA es la marca del equipo).
- Logo: `apps/web/public/vexa-logo-light.svg` y `apps/web/public/vexa-logo-dark.svg` (logos oficiales blanco/negro con verde #498974), también favicon.
- El sistema visual vigente está documentado en `DESIGN.md`; PRODUCT.md solo guarda los compromisos de marca.
- La identidad visual vigente usa grafito #08090B, blanco hielo #F7F8FA y acento de interfaz azul acero #7B97AD; el logo y la capa de la mascota conservan el verde oficial #498974. Superficies translúcidas, Sora e IBM Plex Sans locales. Las vistas comparten navegación y servicios simulados; la mascota activa es el robot v3, documentado en DESIGN.md.

## Evidence on Hand

- `docs/PRD.md` y `docs/acuerdo-socios.md`.
- Seed simulado con los 4 socios, 3 proyectos (Vexa Studio, Fivuza, Vantage) y datos de ejemplo en `apps/web/src/services/mock/seed.ts`.
- No hay testimonios, clientes, métricas de uso ni datos reales de horas o gastos todavía; no se deben inventar.

## Product Principles

1. Registrar cuesta segundos: cada flujo diario se resuelve en una o dos pantallas y funciona con una mano en el celular.
2. Las reglas del acuerdo se aplican solas; el usuario ve el resultado (cumplimiento, puntos, participación), no la fórmula.
3. La confianza viene del historial: nadie borra, todo se anula con motivo y cada corrección de horas aprobadas reabre la revisión.
4. Una sola plataforma para el trabajo del equipo; lo que ya existe gratis (chat, videollamada) no se reconstruye.
5. Se crece por bloques y se recorta alcance antes de estirar plazos.

## Accessibility & Inclusion

- Contraste suficiente (AA), foco visible y labels en formularios.
- Legible al aire libre y con poca luz: modo claro y modo oscuro cómodos en ambos extremos.
- Interfaz completa en español (Perú).

## Registro y revisión de horas (02/10/2026)

Se admite actividad sin tarea: descripción obligatoria, proyecto opcional y respaldo por enlace. Registro manual con fecha, inicio en Lima y duración; reloj persistente en Tareas, con pausas y segmentos; finalizar prepara un borrador que se confirma en Horas. Horas pendientes hasta que otro socio/admin apruebe; se puede pedir aclaración con motivo y corregir. Nadie aprueba sus propias horas. Editar una aprobación reciente elimina su validación y vuelve a revisión; no se editan registros pagados o anulados. Los nuevos horarios finalizados no pueden ser futuros ni superponerse con otros horarios conocidos propios. No se atribuyen horarios ficticios a registros antiguos.

Horas ofrece Registro, Historial completo, Resumen mensual con gráficos diarios y horarios y Revisión del equipo. Solo las horas aprobadas, no pagadas y no anuladas generan puntos. Estos flujos funcionan con servicios simulados y persistencia local; integración remota pendiente de la etapa 2.


## Organización diaria y flujo de trabajo (02/10/2026)

Mi día organiza una meta personal, hasta tres prioridades y pomodoro. El daily es un borrador plegado de comunicación. Tareas presenta el kanban personal y el reloj; los administradores gestionan el conjunto de asignaciones. Proyectos ofrece contexto y un tablero de consulta a sus miembros sin duplicar tareas. Se permiten tareas sin proyecto y asignaciones puntuales de proyectos ajenos.

Finalizar una tarea sugiere su tiempo medido o estimado en Horas, sin generar puntos ni horas confirmadas. Seleccionar varias tareas permite confirmar un único total distribuido por tarea, con fecha y avance adicional. Historial, gráficos y revisión muestran ese registro; las estimaciones y sesiones pendientes quedan fuera de los resúmenes. El reloj continúa al cerrar la página gracias a las fechas persistidas; su duración no prueba cumplimiento. Un navegador cerrado no emite alarmas locales: se recupera el estado y se ofrece pausar al regresar.


## Contexto de tareas y etiquetas de proyecto (02/10/2026)

El administrador crea/edita la descripción opcional Markdown de una tarea, incluso sin proyecto. Los colaboradores consultan la descripción, sin editarla. Los proyectos tienen un catálogo propio de etiquetas con nombre y color, gestionado solo por administradores desde el proyecto. Al editar una tarea, el administrador asigna etiquetas existentes de su proyecto. Los colaboradores solo ven las etiquetas adjuntas a tarjetas/detalles; no consultan ni modifican el catálogo, aunque sean miembros. Una tarea externa asignada conserva descripción y etiquetas sin conceder membresía al proyecto. Cambiar nombre/color propaga el cambio a las tareas asociadas.


Admin puede editar nombre, tipo, estado y membresías desde Editar proyecto en el propio tablero, además del acceso existente en la lista de proyectos. Los roles sin administración mantienen el tablero de consulta.


### Inicio y navegación del colaborador (02/10/2026)

El colaborador tiene un inicio personal: horas registradas/aprobadas/en revisión del mes, avance de sus tareas, próximas tareas, borradores de horas por confirmar y proyectos de los que es miembro. Las tareas asignadas de otros proyectos siguen en su tablero personal sin habilitar el acceso al proyecto. No se muestran participación, gastos, resúmenes del equipo ni el selector Equipo/Mías. Los accesos de escritorio y móvil son Inicio, Mi día, Proyectos, Mis tareas y Horas; las rutas Gastos/Equipo redirigen al inicio. Los servicios mock rechazan lecturas financieras y resúmenes de socios para colaboradores. Socios y administradores conservan su experiencia.
