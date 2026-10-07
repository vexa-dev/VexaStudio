# Vexa Studio

Plataforma interna de VEXA (4 socios): tablero de sprints y tareas, registro de horas con temporizador, gastos con aprobación, comunicación asíncrona (daily, comentarios, anuncios), convocatoria de reunión semanal y dashboard de cumplimiento, puntos y participación (equity dinámico).

**Fuente de verdad:** `docs/PRD.md`. Ante cualquier duda de alcance o reglas, léelo antes de implementar. Si algo no está en el PRD, pregunta; no lo inventes.

## Etapa actual: frontend con dos fuentes de datos y backend Supabase listo en local

- El frontend funciona con datos simulados (`VITE_DATA_SOURCE=mock`, valor por defecto) o con Supabase (`VITE_DATA_SOURCE=supabase`). Perfil con foto y banner, notificaciones y chat existen en las dos fuentes detrás de la capa de servicios.
- Autorizado el 03/10/2026: registro de actividad (auditoría) y backend Supabase, primero en local (CLI + Docker). Las migraciones SQL viven en `supabase/` y nunca llevan la clave `service_role` a un cliente. Hasta el 07/10/2026 hay 26 migraciones aplicadas en local y 26 archivos pgTAP (la última, `20261014000000_gestion_de_miembros`); las migraciones nuevas (`20261005000000` en adelante) NO están aplicadas en la nube: el orden de despliegue está en la descripción del PR de entrega.
- Mock con latencia casi nula (0–15 ms); `VITE_MOCK_LATENCY=1` restaura 150–300 ms. El chat se puede reducir a una burbuja flotante (`ChatBubble`, modo `bubble` en `app/chat-dock.ts`) con el botón "Minimizar chat"; el panel sigue montado.
- `apps/web/src/lib/supabase.ts` sigue como cliente opcional; la UI solo cambia de fuente mediante `VITE_DATA_SOURCE`.
- Las pantallas **nunca** importan datos simulados directamente: siempre pasan por la capa de servicios (ver "Capa de datos"). Así, en la etapa 2 solo se agrega la implementación de Supabase sin tocar la UI.

## Stack

- React + Vite + TypeScript (strict) + Tailwind CSS 4 + React Router. Tailwind se integra con `@tailwindcss/vite` (sin `tailwind.config`); los colores viven como tokens en `apps/web/src/index.css`.
- Iconos: lucide-react. Alias de imports: `@/` apunta a `apps/web/src/`.
- Estado del servidor: TanStack Query. Formularios: react-hook-form + zod. Drag & drop del kanban: @dnd-kit
- Fechas: date-fns. Zona horaria del negocio: `America/Lima` (UTC-5, sin horario de verano). Guardar fechas en ISO UTC; convertir a Lima solo para mostrar y para cortes de semana/mes.
- PWA: vite-plugin-pwa (manifest + service worker)
- Tests: Vitest para lógica pura (cálculos de equity, cumplimiento, reglas, fechas). Los archivos van junto al código: `*.test.ts`.
- Lint: **oxlint** (no ESLint), configurado en `.oxlintrc.json`.
- Hosting: Vercel (SPA, `vercel.json` con rewrite de todas las rutas a `/index.html`)

## Comandos

```bash
npm run dev          # servidor local
npm run build        # build de producción
npm run lint         # oxlint
npm run typecheck    # tipos de todos los workspaces
npm run test         # Vitest (una pasada)
npm run test:watch   # Vitest en modo watch
npm run preview      # sirve el build de producción
npm run preview:headers   # sirve el build con las cabeceras de vercel.json (para revisar la CSP)
npm run db:start | db:reset | db:test   # Supabase local (Docker): migraciones + seed y pruebas pgTAP
npm run db:types     # regenera database.types.ts (se commitea sin formatear)
npm run test:integration   # contra el Supabase local, con SUPABASE_URL y SUPABASE_ANON_KEY en el entorno
```

Antes de dar una tarea por terminada: `npm run typecheck && npm run lint && npm run test && npm run build` sin errores.

## Estructura

```text
apps/web/                   aplicación React/Vite y adaptadores de navegador
  src/app/                  router, layout, providers
  src/features/             funcionalidades, pantallas y hooks
  src/components/           componentes HTML/CSS y mascota
  src/services/             selección de implementación y mock persistido
  src/lib/                  utilidades específicas de la web
  public/                   logos, iconos PWA y mascota
apps/desktop/               reservado para React + Tauri (sin app todavía)
apps/mobile/                reservado para React Native + Expo (sin app todavía)
packages/domain/src/        tipos, reglas, fechas, formatos, prioridad y foco puros
packages/services/src/      interfaces asíncronas de servicios, sin implementación
scripts/check-boundaries.mjs control de dependencias e imports
vitest.config.ts            pruebas de web y paquetes desde la raíz
docs/                       producto, propuesta y arquitectura vigente
vercel.json                 build de apps/web/dist y rewrite SPA
```

Los imports `@vexa/domain/<módulo>` y `@vexa/services` identifican código compartido. `@/` sigue apuntando exclusivamente a `apps/web/src`. Los paquetes compartidos no importan pantallas, React, Vite ni APIs del navegador. Consulta `docs/arquitectura.md` antes de añadir nuevas dependencias o mover código.

## Capa de datos

- `AuditService` (solo lectura: `list` paginado por `seq` y `timeline`) forma parte de la capa de servicios. Las escrituras del registro son internas al mock; en Supabase las hace un trigger. Visibilidad: admin ve todo; socio ve sus proyectos y sus acciones; colaborador solo las suyas.
- Cada módulo tiene una interfaz en `packages/services/src/index.ts` con métodos asíncronos (devuelven `Promise`), como si hablaran con una API real.
- `apps/web/src/services/mock/` implementa esas interfaces con datos en memoria, persistidos en `localStorage` para que sobrevivan al recargar, y con un pequeño retraso artificial (150–300 ms) para probar estados de carga.
- `apps/web/src/services/index.ts` exporta la implementación según `VITE_DATA_SOURCE` (`mock` por defecto; `supabase` cuando se integre).
- Estado del mock: implementados Auth, Settings, Members, Projects, Dashboard (resumen mensual y puntos, con `packages/domain/src/rules.ts`) y, en `mock/work.ts`, Sprints (listar, activo, crear), Tasks (listar, crear, editar, mover) y Time (temporizador único por tarea/actividad, registro manual sin tarea, historial, revisión con aprobación/aclaración, editar y anular con motivo), con permisos y `auditLog`. Gastos tiene lecturas de movimientos, votos y recurrentes compartidas con el dashboard; crear, votar y anular gastos siguen pendientes. Perfil (foto y banner), Notificaciones y Chat también están implementados en el mock (`mock/profile-media.ts`, `mock/chat.ts`). Cerrar sprint está en `mock/sprint-close.ts`. Falta el resto de servicios: fallan con un mensaje claro (`pending`/`notImplemented` en `mock/utils.ts`) hasta su bloque F3–F4.
- Los hooks de `features/*/hooks` usan TanStack Query sobre los servicios. Los componentes solo usan hooks.
- Los cálculos de equity y cumplimiento viven en `packages/domain/src/rules.ts`. El mock los usa para generar el resumen; en la etapa 2 el cálculo pasa a vistas SQL y el frontend solo lo lee, con el mismo tipo de resultado.
- Los permisos (quién puede editar qué) se aplican en el servicio mock igual que lo hará RLS después; la UI además oculta lo que no corresponde.

## Datos simulados (seed)

| Socio | Rol | Área | Horas/semana |
| --- | --- | --- | --- |
| Jhony Rivera | admin (product owner) | Gestión y finanzas | 15 |
| Rober Vasquez | socio | Líder técnico | 20 |
| José Gónzales | socio | Comercial | 15 |
| Diego Choque | socio | Diseño y marketing | 25 |

- Proyectos: Vexa Studio (interno, activo), Fivuza (producto, activo), Vantage (producto, en pausa).
- Un sprint activo con tareas en todas las columnas, horas registradas de varias semanas, gastos en distintos estados, dailies, comentarios y una convocatoria de reunión.
- Gasto recurrente: dominio de VEXA, US$ 13 anual, próxima renovación 2027-02-23, previo a la firma (no suma puntos).
- Settings: pointsPerHour 20, pointsPerSol 2, minCompliance 0.8, weeksPerMonth 4, expenseApprovalLimitPen 50, entryEditDays 7, dailyReminder 21:00 (lun, mié, vie), weeklyHoursReminder domingo 20:00.
- Login simulado: elegir uno de los 4 socios o Alex, colaborador de demostración (sin contraseña). El formulario visual de correo/contraseña muestra avisos de conexión pendiente y la recuperación avisa que solo funciona con Supabase; no autentica ni envía correos. Se conserva cambio de usuario para probar permisos.

## Reglas de negocio (resumen del PRD)

- Puntos: 20 por hora no pagada y validada; 2 por S/ 1 de gasto aprobado, no reembolsado y no previo a la firma.
- Participación = puntos del socio / puntos totales.
- Mínimo mensual = horas_semana × 4 × 0.8. Cumple si horas del mes (Lima) ≥ mínimo, descontando ausencias justificadas.
- Gasto > S/ 50: pendiente hasta 3 votos a favor. ≤ S/ 50: aprobado automáticamente.
- Un solo temporizador abierto por usuario: iniciar uno finaliza el anterior en borrador. El reloj vive en Tareas, persiste segmentos/fechas y continúa fuera de la página. Pausa manual; al volver se avisa una hora pendiente. Horas confirma borradores individualmente o en grupo antes de sumar al historial/resúmenes.
- Cada usuario crea y edita solo sus propios registros; edición permitida 7 días o hasta que se validen. Nadie borra: se anula con motivo.
- Ajuste autorizado de Horas (02/10/2026): se permite corregir una aprobación dentro de la ventana de edición, devolviéndola a pendiente y retirando sus puntos. Pagados/anulados quedan bloqueados. Una solicitud de aclaración habilita corrección fuera de esa ventana. Revisan otros socios/admin, sin autoaprobación.
- Reunión semanal sin día fijo: el PO propone 2–3 horarios, los socios marcan disponibilidad, el PO confirma (con enlace de Meet) y marca asistencia.
- Notificaciones: en esta etapa solo in-app. Web Push llega en la etapa 2.

## UI

- Mobile first: todo debe funcionar bien en un celular. Navegación inferior en móvil, sidebar en escritorio.
- Textos de la UI en español (Perú). Montos en soles con formato `S/ 1,234.50`; fechas `dd/mm/yyyy`.
- Modo claro y oscuro. Estados de carga, vacío y error en toda pantalla con datos.
- Accesible: labels en formularios, foco visible, contraste suficiente.
- Identidad VEXA: grafito #08090B y blanco hielo #F7F8FA, acento de interfaz azul acero #7B97AD, verde oficial #498974 en logos y capa de la mascota, cristal translúcido, Sora e IBM Plex Sans locales. Usa los tokens semánticos de `apps/web/src/glass.css`. La aplicación conserva sus servicios y reglas; la demo independiente fue retirada por solicitud del usuario. El detalle visual está en `DESIGN.md`; el contexto, en `PRODUCT.md`.
- Cifras de datos (horas, puntos, %, montos) con la clase `.num` (tabulares, sin saltos al animar). El estado nunca depende solo del color: siempre va acompañado de texto.
- Componentes de datos ya disponibles en `components/ui/`: `Meter` (progreso con marca de umbral), `SegmentedBar` (reparto entre personas), `CountUp` (cifra que cuenta), `Card` (tonos `default`, `raised`, `accent`). `Sheet` es la hoja modal para formularios y confirmaciones (abajo en el celular, centrada en escritorio) y `Toaster` (Sonner) muestra los avisos con `toast.success`/`toast.error`. Reutilízalos antes de crear otros.
- Movimiento: solo `transform`, `opacity` y `clip-path`; curva `--ease-out`; entradas escalonadas de 60 ms con `.enter` y `stagger(i)`. Las animaciones de datos (barras, contadores) se reproducen solo la primera vez por sesión (`useFirstPlay`). Nada de animación en acciones frecuentes o de teclado. Con `prefers-reduced-motion` se conserva el cambio de estado (opacidad) y se quita el desplazamiento.
- Nativo en móvil: objetivos táctiles de 44 px, `dvh`, áreas seguras, `touch-action: manipulation`, sin resaltado de toque; los estilos `hover` solo con puntero fino.
- Formularios con react-hook-form + zod (esquemas junto a cada módulo en `schemas.ts`); campos con `Field`, `SelectField` o `TextareaField`. Las mutaciones de cada módulo viven en `hooks/` y muestran su aviso de éxito o error con Sonner. Cada pantalla se carga de forma diferida (`lazy` en `App.tsx`).
- Temporizador: la barra móvil (`TimerBar`) va sobre la navegación inferior y el chip (`TimerChip`) en el encabezado de escritorio; ambos solo aparecen con un temporizador activo. Nadie borra registros: se anulan con motivo.
- Tras cualquier cambio de UI, el hook de Impeccable revisa el archivo; el detector completo se corre con `.claude/skills/impeccable/scripts/impeccable detect apps/web/src` y debe devolver `[]`.

## Skills del proyecto

Las skills viven en `.claude/skills` (registro en `skills-lock.json`). Úsalas así:

- **Diseño y UI**: `impeccable` es el eje (`shape` para planear, `critique`/`audit` para evaluar, `polish` para cerrar, `document` para actualizar `DESIGN.md`). Complementan `emil-design-eng` (detalles y estados), `animate`, `animation-vocabulary` y `review-animations` (movimiento), `mobile-native` (sensación de app instalada), `apple-design` (resortes y gestos, para el temporizador y las hojas de F2) y `accessibility`.
- **Código**: `react-best-practices`, `composition-patterns`, `tailwind-css-patterns`, `react-hook-form`, `zod`, `vitest`, `vite`, `oxlint`, `typescript-advanced-types`. `ask-sonner` para avisos tipo toast y `pick-ui-library` solo si hace falta una librería nueva (justificarla antes).
- **No usar**: `industrial-brutalist-ui`, `minimalist-ui`, `gpt-taste`, `stitch-design-taste`, `design-taste-frontend`, `high-end-visual-design`, `redesign-existing-projects` y `brandkit` (chocan con la identidad fija de VEXA); `imagegen-*` e `image-to-code` (no hay generación de imágenes); `animate-expo`, `write-swift`, `nodejs-*` y `seo` (no aplican a este proyecto).
- La identidad de VEXA es una decisión de marca: el trabajo visual **extiende** el sistema existente, no lo reemplaza.

## Convenciones

- Código en inglés (`camelCase` en TS, `PascalCase` en componentes). Textos visibles en español.
- Componentes funcionales y hooks. Sin lógica de negocio en `components/ui/`.
- Nada de `any` (oxlint lo marca como error). Validación de formularios con zod, reutilizando los tipos del dominio.
- Commits en formato Conventional Commits, con el tipo en inglés y la descripción en español (`feat(domain): agrega reglas de puntos`, `fix: corrige el corte de mes`, `chore: actualiza dependencias`). Una rama y un PR por tarea.
- No agregar librerías fuera del stack sin justificarlo.

## Cómo trabajar en este repo

- Avanza por bloques del PRD (F1 → F2 → F3 → F4), no todo de golpe.
- Antes de implementar un bloque, propone el plan (tipos, métodos de servicio, rutas y pantallas) y espera confirmación.
- Mantén las soluciones simples y legibles.


## Ajuste autorizado del flujo (02/10/2026)

Admin de cualquier área crea proyectos y tareas, asigna responsables y gestiona miembros. Socios sin rol admin y colaboradores solo mueven sus propias tareas en Mis tareas. Proyectos se limita a membresía explícita, independientemente de asignaciones puntuales, y su kanban es de consulta para no admins. La capa de servicios mock aplica permisos. Task.projectId admite null. Finalizar tarea/reloj crea borradores; Horas confirma un total distribuido en un registro, sin sumar estimaciones ni duplicar puntos. Mi día queda para meta, prioridades y pomodoro, con enlace a Tareas. Daily local plegado, sin crear horas. Esta definición sustituye permisos/flujo previos de F2; el backend se autorizó después (03/10/2026, ver "Etapa actual").


### Descripciones, etiquetas y desplegables

- Usar `components/ui/ChoicePicker` para todos los menús de opciones; no introducir `<select>` nativos. Calendarios compartidos: DatePicker de TimePickers. Ambos usan `usePopupPosition` para respetar pantalla, modales y transforms.
- Descripción Markdown opcional por tarea, editable solo por admin. Renderizar con TaskMarkdown (react-markdown + remark-gfm, skipHtml); no habilitar HTML crudo.
- ProjectLabel pertenece a un solo proyecto. El catálogo se administra desde ProjectLabelsSheet mediante servicios/hooks, solo admin. Colaboradores reciben únicamente etiquetas adjuntas a tareas, sin catálogo. El servicio valida el proyecto y canonicaliza nombre/color; editar etiqueta propaga a todas sus tareas. Mantener estas reglas en el futuro backend/RLS.

## Estructura multiplataforma autorizada (03/10/2026)

La web vive en `apps/web`; dominio y contratos en `packages`. Mantener los comandos desde la raíz y un solo lockfile. Escritorio/móvil están reservados, sin runtime nativo. `npm run lint` incluye el control de límites. El mock y localStorage son adaptadores de web; no trasladarlos a los paquetes compartidos. Equipo consulta servicios/hooks; el daily es compartido y persistente en ambas fuentes (`DailyService.list/submit/suggestDone`).


## Supabase local (Fase D, 03/10/2026)

- Flujo: `npm run db:start`, `npm run db:reset` (migraciones + seed), `npm run db:test` (pgTAP). Claves con `supabase status -o env` (`API_URL`, `ANON_KEY`); solo la clave pública va al cliente, nunca `service_role`. Crea `apps/web/.env.local` con `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (plantilla: `.env.example` de la raíz).
- Cuentas del seed (solo local): jhony@, rober@, jose@, diego@, alex@ `vexa.test`, contraseña `vexa-local-dev`. Acceso por invitación: no hay registro público.
- Código: `apps/web/src/services/supabase/` (un adaptador por servicio, `index.ts` los compone; `mappers.ts`, `errors.ts`, `database.types.ts` generado con `supabase gen types typescript --local`). Los adaptadores reciben el cliente; `fake-client.ts` sirve para pruebas unitarias e `integration.test.ts` (`npm run test:integration`, con `SUPABASE_URL` y `SUPABASE_ANON_KEY`) corre contra el stack local y se omite sin esas variables.
- Cabeceras que envía el cliente en cada llamada REST: `x-request-id`, `x-client` (`web/<versión>`), `x-client-at`. La hora oficial es la del servidor.
- Implementado en ambas fuentes: perfil con foto y banner (Storage privado con URLs firmadas), notificaciones (creadas solo por triggers; Realtime) y chat (conversaciones, mensajes, reacciones, lecturas, estado, preferencias, fondo, adjuntos de hasta 25 MiB en Supabase y 3 MiB en el mock, presencia por canal privado). Los avisos con reloj ya son reales en Supabase (ver "Avisos con reloj"); el mock no los emite (solo trae ejemplos sembrados).
- Chat, ciclo de vida (migraciones `20261007000000` a `20261007000200`): todos los canales Realtime son privados (`private: true`) con política de lectura en `realtime.messages` por prefijo de tópico, y el latido corre en un worker propio (`public/realtime-heartbeat.worker.js`, compatible con la CSP). Los ticks tienen tres estados (enviado, recibido, leído en verde); "recibido" se marca desde `UserMenu` con la app abierta. Los adjuntos se pueden liberar: cuando todos los integrantes los descargaron se pregunta a cada uno si debe quedarse; un solo "Conservar" lo mantiene, sin respuesta cuenta como conservar y solo si todos eligen "Liberar espacio" se borra el archivo (por la API de Storage, nunca con SQL) y el mensaje queda con un aviso. Al subir una foto o banner nuevo se borra el anterior. Las evidencias de Horas siguen siendo un enlace: no hay archivo que liberar.
- Avisos con reloj (migración `20261013000000`, M6): `pg_cron` ejecuta tres trabajos con nombre que llaman a funciones del esquema `private` (no accesibles a clientes): `vexa_daily_pending` (`0 2 * * *` UTC = 21:00 Lima; avisa a socios/admin sin daily de hoy en los días de `settings.daily_reminder_weekdays`), `vexa_hours_missing` (`0 1 * * *` UTC = 20:00 Lima; el día de `weekly_hours_reminder_weekday`, a quien lleva menos horas que su meta semanal en la semana lun-dom de Lima y no desactivó `hours_reminder`) y `vexa_renewals` (`0 14 * * *` UTC = 09:00 Lima; a los admin cuando un gasto recurrente renueva en 30 o 7 días). `expense_result` es un trigger sobre `expenses` (aprobado, rechazado o anulado, a quien pagó; sin sesión no avisa). Idempotentes: `payload.dedupeKey` + índice único parcial. La hora es fija en el cron (cambiarla en Ajustes no la mueve; los días sí). Para probar en local cada generador acepta `p_now` (`select private.generate_daily_pending('2027-03-02 02:00+00')`, como postgres); pgTAP no espera al cron. El mock NO emite avisos con reloj. Despliegue: habilitar `pg_cron` en el Dashboard (Database > Extensions) ANTES de `supabase db push`.
- Perfil completo (migración `20261008000000`): datos personales (nombre, usuario único en minúsculas, "Sobre mí"; el correo es solo lectura y sale de la sesión), cambio de contraseña (pide la actual y exige 12 o más con mayúsculas, minúsculas y dígitos), verificación en dos pasos con TOTP, "Cerrar sesión en los demás dispositivos" y preferencias de avisos por usuario (`task_assigned` y `hours_reminder` se respetan; el resumen semanal se guarda sin efecto todavía). Contraseña, dos pasos y sesiones solo funcionan con Supabase; el mock lo avisa. El segundo paso se exige en el login pero NO en la base (RLS no pide `aal2`): endurecerlo es una mejora pendiente. No hay códigos de recuperación: si alguien pierde el celular, un admin quita el factor desde el panel. En la nube hay que habilitar TOTP (Auth > Multi-Factor) y activar "Require current password when updating".
- Horas con etiquetas y evidencias (migración `20261008000100`, autorizado el 06/10/2026): quien registra horas puede etiquetar hasta 10 personas y fija para cada una un porcentaje de 1 a 100 (por defecto 100); al aprobarse, la persona etiquetada recibe `horas × porcentaje` en puntos y en el mínimo mensual, y quien registró siempre conserva el 100 %. Quien registró y los etiquetados no pueden aprobar esa entrada. Las evidencias en archivo (hasta 5, 10 MiB, bucket privado `hours-evidence`) se conservan 7 días tras aprobar y luego se borran con la API de Storage cuando alguien abre Horas (sin cron); al anular quedan listas para borrar de inmediato, y agregar o quitar un archivo en un registro aprobado lo devuelve a pendiente. La notificación de etiqueta reutiliza el tipo `mention`. `useProjectSummaries` sigue sumando horas del equipo, sin crédito por etiquetas, para no contar dos veces.
- Recuperación de contraseña (real solo con Supabase): `¿La olvidaste?` en el login llama a `requestPasswordReset` (siempre responde igual: "Si el correo está registrado, te enviamos un enlace") y el enlace abre la ruta pública `/restablecer`, que canjea los tokens del hash (`beginPasswordRecovery`; el cliente tiene `detectSessionInUrl: false`), valida la política de 12+ y llama a `completePasswordReset` (cierra todas las sesiones y vuelve al login). El mock avisa que no la soporta. Prueba local: el correo llega a Mailpit en http://127.0.0.1:54324; `supabase/config.toml` permite `/restablecer` en `additional_redirect_urls` (reinicia con `supabase stop && supabase start` si cambia). Despliegue: añadir `https://<dominio>/restablecer` a Redirect URLs, el SMTP integrado de Supabase tiene un límite de envíos muy bajo (usar SMTP propio), y una cuenta con TOTP puede exigir el segundo paso al fijar la contraseña.
- Imágenes de perfil: con Supabase la foto sale a 768², el banner a 2400×480 y el fondo del chat a 1080×1920 (calidad mínima 0.6); el mock conserva los tamaños chicos por el límite de `localStorage`.
- Descargas: los buckets son privados con URLs firmadas (TTL 1 h); las subidas nuevas llevan `Cache-Control` de un año (los objetos son inmutables), las imágenes del chat cargan diferidas y las URLs firmadas se conservan en `localStorage` mientras sigan vigentes.
- Gestión de miembros (migración `20261014000000`, C1): la invitación es real con Supabase. Un admin invita a un **colaborador** por correo (`MemberService.invite` → Edge Function `members-admin` → `auth.admin.inviteUserByEmail`); la persona fija su contraseña en `/restablecer`; los socios no se invitan (entran tras votación y un admin los promueve). `setRole` y `setActive` llaman a los RPC `set_member_role` / `set_member_active` (SECURITY INVOKER, solo admin activo, nunca sobre uno mismo, nunca dejando cero admins activos, desactivar exige motivo; nota y motivo quedan en `audit_log.reason`). Una persona inactiva pierde el acceso por `auth_role()` (RLS); la función además la bloquea en Auth (`revoke-sessions` / `restore-access`) y no puede reactivarse sola. La función valida con las mismas reglas que `packages/domain/src/member-admin.ts` (hay una prueba de paridad con `supabase/functions/members-admin/validate.ts`) y nunca expone `service_role`. El mock hace lo mismo sin enviar correo (crea un colaborador `pendingInvite`). El formulario de Equipo (`CollaboratorForm`) sigue siendo solo local; la interfaz real vive sin montar en `features/members/` (`InviteCollaboratorSheet`, `MemberAdminActions`). Despliegue: `supabase db push`, `supabase functions deploy members-admin` con el secreto `ALLOWED_ORIGINS`, Site URL y Redirect URLs (incluida `/restablecer`) y SMTP propio (el correo integrado tiene un límite muy bajo). La función no se pudo ejecutar en local (`edge_runtime` apagado en `config.toml`).
- Daily compartido (migración `20261009000000`): tabla `daily_updates`, una fila por persona y fecha de Lima; admin y socios leen todo, el colaborador lo suyo; cada quien envía solo el suyo y solo el de hoy (lo exige la base, no el reloj del cliente), reenviar el mismo día lo corrige y nadie borra. `suggestDone` arma "qué hice" con las horas desde el último daily (`packages/domain/src/daily.ts`). Sin evento de auditoría todavía; los bloqueos con @mención siguen diferidos; el recordatorio de las 21:00 ya existe (ver "Avisos con reloj").
- Cerrar sprint (migración `20261010000000`, M5): `SprintService.close(sprintId, validatedEntryIds)` solo lo ejecuta el admin sobre un sprint activo y es atómico (RPC `close_sprint` en SQL; todo o nada también en el mock): valida en bloque las horas elegidas (sin autoaprobación ni etiquetados) y las bloquea (`locked_by_sprint`: ni el dueño las edita ni cambian sus etiquetas), manda al backlog (`sprint_id` nulo) las tareas sin terminar y guarda el reporte de entrega por persona en `sprints.close_report` (`getCloseReport` lo lee). Las horas no elegidas siguen pendientes. Reglas puras en `packages/domain/src/sprint-close.ts`; UI en `CloseSprintSheet` (admin, desde el tablero). El cierre no tiene tipo propio en `audit_log`: quedan los eventos `hours.approved` y `task.edited`.
- Comentarios y anuncios (migración `20261011000000`, mock y Supabase): comentarios sobre tarea, registro de horas y gasto (esta última entidad sin pantalla), de 1 a 2000 caracteres, inmutables (nadie edita ni borra) y visibles para quien lee la entidad padre. La UI resuelve `@usuario` a ids (`packages/domain/src/comments.ts`; sin usuario configurado vale el primer nombre sin tildes), la base depura las menciones (sin duplicados, sin uno mismo, solo quien puede leer la entidad, máximo 10) y un trigger crea un aviso `mention` por persona (el mock lo agrega a `db.notifications`). Anuncios de 1 a 1000 caracteres: los leen admin y socios, solo admin publica y fija o desfija, nadie borra. UI: hilo en el detalle de tarea, "Objetar" en la hoja de cierre de sprint (abre el hilo del registro de horas) y tarjeta de anuncios en Mi día. Sin evento de auditoría todavía.
- Reuniones (migración `20261012000000`, mock y Supabase, M4): una convocatoria por semana de Lima (`week` = lunes; los horarios deben caer en una sola semana, la actual o la siguiente). Solo admin convoca (RPC `propose_meeting`: 2 o 3 horarios futuros y distintos), confirma (enlace https; Meet preferido, otro servicio solo avisa en la UI) y marca asistencia (solo después de que empiece el horario confirmado); admin y socios leen y votan por sí mismos (un voto por horario, cambiable hasta confirmar); el colaborador no ve nada; nadie borra. Estados `polling` → `confirmed` → `held`. Avisos `meeting` por trigger (al convocar y al confirmar, a admin y socios menos quien actúa). El recordatorio "sin responder en 24 h" es un indicador derivado de `created_at` en la UI, no un trabajo programado. Reglas puras en `packages/domain/src/meetings.ts` (`consecutiveAbsences` para el incumplimiento de 2 reuniones seguidas aún no está conectado al dashboard). UI: tarjeta plegable "Reunión semanal" en Mi día. Sin evento de auditoría todavía.
- Gastos y sprints no generan eventos de actividad aún. `tasks.list()` sin proyecto se filtra a las asignadas en el adaptador.
- Despliegue en la nube (proyecto ya creado con las 7 primeras migraciones y los 4 socios): antes de fusionar un PR que despliegue el frontend, copia de seguridad, `supabase db push` de las migraciones nuevas, ajustes de Auth a mano (contraseña mínima de 12 con mayúsculas, minúsculas y dígitos; Site URL y Redirect URLs de producción; dejar los dos `enable_signup` como están: el de `[auth.email]` en `false` desactiva el login por correo), Realtime con acceso público desactivado (probar primero en el preview con el interruptor apagado; si el chat deja de actualizarse en vivo, volver a encenderlo) y los buckets `avatars`, `banners`, `chat-wallpapers` y `chat-attachments`. Variables de Vercel: `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Seguridad por defecto (B2): toda función nueva exige `grant` explícito (el revoke a `PUBLIC` es global); toda tabla pública nueva sube el contador de `06_barrido_rls`; las funciones `security definer` públicas solo pueden ser auxiliares de permisos (lista blanca en `06`). Después de usar la app o la integración contra la base local, corre `npm run db:reset` antes de `npm run db:test`.
