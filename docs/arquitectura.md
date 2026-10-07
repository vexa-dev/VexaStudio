# Arquitectura y revisión del repositorio

Fecha: 03/10/2026. Esta organización ya está implementada. La web continúa con datos simulados; escritorio, móvil y backend remoto siguen pendientes.

## Estructura vigente

```text
apps/
  web/                      React, Vite, HTML/CSS, PWA
    src/app/                navegación, layouts, tema y providers
    src/features/           pantallas, formularios y hooks por módulo
    src/components/         UI web y mascota
    src/services/           composición y adaptadores mock de navegador
    src/lib/                utilidades de presentación y APIs web
    public/                 recursos servidos por la web
  desktop/                  reservado; README de implementación
  mobile/                   reservado; README de implementación
packages/
  domain/src/               modelo y lógica independiente de plataforma
  services/src/             contratos de acceso a datos
scripts/                    comprobaciones del repositorio
docs/                       producto, acuerdos y decisiones
```

Un solo repositorio, instalación y lockfile con npm workspaces. Cada aplicación futura tendrá su propio paquete, pantallas, build y publicación. Los paquetes actuales exponen TypeScript fuente para que cada aplicación lo transpile; todavía no se distribuyen como librerías externas.

## Qué se revisó y qué se corrigió

La revisión recorrió imports, reglas, servicios, hooks, estado local, pantallas, componentes y configuraciones de la aplicación. Es una revisión de separación y compatibilidad estructural; no certifica seguridad de un backend todavía inexistente.

| Área | Resultado y decisión |
| --- | --- |
| Modelo, permisos y reglas | Tipos, acceso por rol, puntos, cumplimiento y ventanas de edición pasan a `@vexa/domain`. Las implementaciones siguen aplicando permisos; el backend futuro deberá hacerlo de forma autoritativa. |
| Horas y temporizador | Cálculo de tiempo y actividad mensual compartidos. Se corrigió la dependencia del dominio hacia `web/src/lib/dates`. Fechas, cortes y formatos de Lima viven con sus pruebas en el dominio. Persistencia, Web Locks y sonido permanecen en web. |
| Contratos de datos | Interfaces e inputs pasan a `@vexa/services`, que solo depende del dominio. La selección por `import.meta.env` y el mock con `localStorage` permanecen en la aplicación. No se presenta ese mock como un backend multiplataforma. |
| Equipo | Importaba y reconstruía el seed desde la pantalla. Ahora consulta un hook y los servicios, con carga/error. Se añadió lectura filtrada de dailies persistidos, restringida a socios/admin. No se implementó el envío de daily ni se mezcló con el borrador local de Mi día. |
| Dashboard | La selección y orden de tareas por atender se comparte como lógica pura; la composición según rol y las consultas quedan en la web. |
| Mi día | Tipos y validación del foco y detección de descanso pasan al dominio. Guardado local, eventos del navegador, intervalos y componentes permanecen en web. Meta, plan y daily continúan locales. |
| Tareas/proyectos | Pantallas, kanban, Markdown, formularios y etiquetas quedan en la aplicación. Tipos e interfaces compartidos conservan las mismas reglas. No se trasladan componentes HTML a React Native. |
| Gastos y módulos pendientes | Contratos separados; lecturas y métodos todavía no implementados siguen como estaban. La estructura no completa automáticamente esas funcionalidades. |
| Autenticación | Providers y sesión mock quedan en web. `signIn(userId)` y selección de perfiles son contratos de demo que deberán revisarse al integrar autenticación real. |
| UI y mascota | Portales, CSS, geometría de pantalla, gestos, accesibilidad web y movimiento siguen en web. No tienen compatibilidad directa con React Native. |
| Herramientas y despliegue | Scripts raíz delegan a la web; Vitest descubre pruebas de web y dominio. Vercel compila desde la raíz y publica `apps/web/dist`. Configuración PWA y URLs públicas se conservan. |

## Límites de dependencias

```text
apps/web → @vexa/services → @vexa/domain
apps/web → @vexa/domain
```

- `domain` no importa React, componentes, servicios, Vite ni APIs de navegador. Solo tiene dependencias explícitas de fechas. Sus cálculos reciben datos; no consultan sesiones ni almacenamiento.
- `services` define interfaces, no conecta clientes. Un método compartido describe el contrato; cada implementación decide cómo autenticar, consultar y persistir.
- `@/` es interno a la web. Usar `@vexa/domain/<módulo>` y `@vexa/services` para código compartido. No importar rutas relativas hacia otra aplicación.
- Pantallas y componentes no importan el seed ni el cliente Supabase; consultan hooks y servicios.
- El mock conserva sus claves y formato de almacenamiento. Cambiar carpetas no sincroniza datos entre dispositivos.

`npm run check:boundaries`, incluido en lint, analiza imports, dependencias y APIs de navegador en los paquetes actuales. TypeScript comprueba los paquetes con `lib: ES2023`, sin DOM. Estas verificaciones ayudan a prevenir cruces; no reemplazan revisión de código ni permisos del servidor. Al añadir un paquete/aplicación hay que ampliar el comprobador con sus límites.

## Dónde agregar funcionalidades

1. Definir entidades y reglas independientes en `packages/domain/src`, con pruebas de comportamiento cuando corresponda.
2. Definir operaciones de datos en `packages/services/src/index.ts`.
3. Implementar el adaptador web en `apps/web/src/services`; después, el backend o adaptador compatible según el alcance autorizado.
4. Crear consultas/mutaciones en hooks y construir la interfaz dentro de `apps/web/src/features/<módulo>`.
5. Mantener efectos del dispositivo en su aplicación: sesiones, almacenamiento, sonidos, notificaciones, ventanas y archivos.
6. Ejecutar desde la raíz `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`.

No crear paquetes por cada carpeta. Extraerlos cuando tengan una responsabilidad clara y un consumidor real.

## Lo que se prepara después

Los directorios de escritorio y móvil contienen instrucciones, sin dependencias nativas ni aplicaciones ficticias. Al iniciar una plataforma, crear su manifiesto de workspace y desarrollar su interfaz propia sobre los contratos y reglas actuales.

Los futuros `packages/design` y `packages/ui-web` se crearán cuando haya recursos o componentes que realmente compartan dos aplicaciones. Por ahora, colores, fuentes, logos y controles permanecen juntos en la web. En móvil se podrá compartir identidad visual y lógica; HTML, CSS y componentes del navegador necesitan una implementación distinta.

La integración Supabase deberá revisar autenticación, permisos/RLS, operaciones de servicios pendientes, temporizador común entre dispositivos, validaciones e historial de auditoría. No incluir credenciales privilegiadas en ninguna aplicación. Los paquetes compartidos ayudan a mantener criterios, pero no son una barrera de seguridad.

Firmas, instaladores, tiendas, actualizaciones y funcionamiento sin conexión se discutirán al implementar cada plataforma. Ver [propuesta multiplataforma](./propuesta-multiplataforma.md).

## Desarrollo y Vercel

Ejecutar `npm ci` desde la raíz. `npm run dev -- --host 127.0.0.1 --port 5173` conserva el comando habitual. Variables locales en `apps/web/.env.local`, partiendo de `apps/web/.env.example`; Vite carga el entorno desde la aplicación.

En Vercel mantener **Root Directory en la raíz del repositorio**, con instalación `npm ci`, build `npm run build` y salida `apps/web/dist`. El archivo raíz `vercel.json` contiene esos valores, el rewrite de rutas SPA y caché de assets. Un proyecto Vercel con valores fijados previamente en su panel deberá alinearlos con esta configuración al desplegar; no se realizó un despliegue en esta tarea.

### Cabeceras, CI y tipos

- `vercel.json` envía en todas las rutas una CSP estricta (`script-src 'self'`, sin `unsafe-inline` ni `unsafe-eval`; `connect-src` solo al propio origen y a `https://*.supabase.co` / `wss://*.supabase.co`), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` y `Cross-Origin-Opener-Policy`. `index.html`, `sw.js`, `registerSW.js` y `manifest.webmanifest` se revalidan siempre (`no-cache`); `/assets/*` es inmutable. HSTS lo gestiona Vercel.
- El service worker no cachea respuestas de API y su fallback SPA ignora `/rest`, `/auth`, `/storage`, `/realtime`, `/functions` y `/api`.
- `npm run preview:headers [puerto]` sirve `apps/web/dist` aplicando las cabeceras y rewrites de `vercel.json`, para revisar la CSP contra el build real (después de `npm run build`).
- `npm run db:types` regenera `database.types.ts` desde la base local (`npm run db:start` antes); no toca el archivo si el comando falla.
- `.github/workflows/ci.yml` corre en cada PR y en `main`: job `web` (typecheck, lint, test, build) y job `database` (Supabase local, pgTAP y chequeo de que `database.types.ts` no esté desfasado).

## Validación de esta reorganización

- Tipos de herramientas, aplicación web y paquetes: aprobados.
- Vitest: 95 pruebas en 15 archivos aprobadas. Incluye dos pruebas nuevas de lectura y permisos del daily de Equipo.
- Lint y límites de arquitectura: sin errores; continúan nueve advertencias de accesibilidad existentes.
- Build de producción: aprobado, incluyendo manifest y service worker de la PWA.
- Navegador: 13 combinaciones de ruta/perfil comprobadas, con administrador en escritorio claro y colaborador en móvil oscuro; sin errores JavaScript ni desbordamiento horizontal. Incluye Equipo, proyecto, tareas, horas y Mi día.
- Lockfile: `npm ci --dry-run` aprobado. Archivos originales de aplicación, recursos y configuración comprobados en sus nuevos destinos.
- Comprobador de límites: verificado con un import de UI y una referencia a `window` temporales; ambos fueron rechazados y retirados.

## Limpieza del repositorio

Se retiraron las capturas y scripts temporales de `design-preview`, la compilación anterior de `dist` en la raíz y los artefactos de build utilizados para validar la reorganización. Estas carpetas están ignoradas por Git; `apps/web/dist` se vuelve a generar con `npm run build`.

También se quitaron cinco dependencias sin referencias en la aplicación: `@react-three/fiber`, `three`, `@types/three`, `@fontsource-variable/inter` y `@fontsource-variable/plus-jakarta-sans`. La interfaz mantiene Sora e IBM Plex Sans. El cliente opcional de Supabase y los directorios reservados para escritorio/móvil se conservan como preparación explícita del plan.

## Registro de actividad y Supabase (03/10/2026)

`AuditService` es solo de lectura y vive junto a los demás contratos en `packages/services`; los tipos y el diff de campos son puros y están en `packages/domain/src/audit.ts`. El mock escribe el registro dentro de cada operación de servicio (un `requestId` por operación); Supabase lo hará con triggers. El backend se desarrolla primero en local y el mock sigue siendo la fuente por defecto.

## Conexión web -> Supabase local (Fase D)

**Selección de fuente.** `VITE_DATA_SOURCE` (`mock` por defecto, `supabase`) decide en `apps/web/src/services/index.ts` qué implementación de `Services` se usa. La interfaz no cambia: la UI solo consulta hooks y servicios, y el cliente (`apps/web/src/lib/supabase.ts`) solo lo importan los módulos de `services/`. El flag lo lee un único helper, `services/supabase/data-source.ts`.

**Módulos** (`apps/web/src/services/supabase/`): un adaptador por servicio (`auth`, `members` con `settings`, `projects`, `sprints`, `tasks`, `time`, `dashboard`, `expenses`, `audit`), compuestos en `index.ts` (`createSupabaseServices`). Cada fábrica recibe el cliente, lo que permite probar con un cliente falso (`fake-client.ts`) o con varias sesiones a la vez. `mappers.ts` traduce filas snake_case al dominio (puro y probado), `errors.ts` traduce errores de Postgres a los mensajes que ya mostraba el mock y `database.types.ts` se genera con `supabase gen types typescript --local`. Los permisos los aplica RLS; el adaptador solo reproduce los mensajes del mock.

**Cabeceras del registro de actividad.** El cliente agrega a cada llamada REST `x-request-id` (agrupa las entradas de una operación; las operaciones de varias llamadas comparten el mismo), `x-client` (`web/<versión>`) y `x-client-at` (hora del cliente, informativa). La hora oficial `occurred_at` es la del servidor.

**Acceso.** Por invitación: no hay registro público. Con Supabase el formulario de correo y contraseña autentica de verdad (`CredentialsAuthService`, que amplía `AuthService`); el selector de perfiles de demostración es solo del mock. La recuperación de contraseña es real con Supabase (correo de recuperación y pantalla para fijar la nueva contraseña); en el mock solo avisa que requiere Supabase.

**Tiempo real.** `ActivityPage` se suscribe a `postgres_changes` de `audit_log` (Realtime respeta RLS) y recarga la actividad al llegar eventos; solo con la fuente `supabase`.

**Diferencias conocidas con el mock.**
- `tasks.list()` sin filtro de proyecto se recorta en el adaptador a las tareas asignadas a la persona (el administrador ve todas), porque RLS devuelve además las de sus proyectos.
- Los ids son uuid (el mock usaba texto).
- Si un administrador finaliza la tarea de otra persona, `timer.stopped` queda con el administrador como actor.
- Gastos y la actualización de sprints aún no generan eventos de actividad.
- `member_monthly_summary` solo lista meses desde la primera actividad: el dashboard usa `monthly_summary(p_month)`.
- Acciones del sistema (sin actor) llegan con `actorId` `system`; el contrato de dominio exige un actor.
- `move_task` no falla si RLS deja el UPDATE sin filas (tarea ajena): el adaptador lo detecta y lanza el mensaje del mock.
- `daily.list` devuelve vacío (no hay tabla de dailies); daily escrituras, comentarios, anuncios, reuniones, notificaciones y cerrar sprint siguen sin implementar en ambas fuentes.

## Seguridad por defecto

- **Funciones nuevas sin permiso.** La migración `20261005000000_privilegios_por_defecto.sql` revoca el `EXECUTE` por defecto de las funciones que crea `postgres` (a PUBLIC, `anon` y `authenticated`, en `public` y `private`). Toda función nueva necesita un `grant execute` explícito; las migraciones actuales ya lo hacen. `service_role` y los privilegios de `supabase_admin` (plataforma) no cambian. La prueba es `supabase/tests/08_endurecimiento.test.sql`. Consecuencia para las pruebas pgTAP: los ayudantes `pg_temp.*` que se llaman desde otro rol necesitan `grant execute on all functions in schema pg_temp to public`.
- **Contraseñas.** `config.toml` exige 12 caracteres con minúsculas, mayúsculas y dígitos. Solo se aplica al crear usuarios o cambiar la contraseña; quien ya tiene cuenta sigue iniciando sesión (el seed local inserta hashes directamente). En la nube se ajusta a mano al desplegar (B6).
- **Dos flags `enable_signup`.** `[auth] enable_signup = false` cierra el registro público. `[auth.email] enable_signup` debe seguir en `true`: en `false` se desactiva el inicio de sesión por correo entero. No "corregirlo".
- **Storage.** El límite global de archivo es 25 MiB; cada bucket fija el suyo (por ejemplo 2 MiB para fotos).

### Fotos de perfil en Storage

- **Buckets.** `avatars` y `banners` (migración `20261005000100_perfil_fotos_storage.sql`): privados, 2 MiB y solo `image/webp`, `image/jpeg` e `image/png`. Los límites los aplica la API de Storage. Los objetos viven en `<user_id>/<tipo>-<marca de tiempo>.<ext>`.
- **Políticas** (`storage.objects`, siempre `to authenticated`). Lectura: cualquier miembro activo del estudio (`public.auth_role() is not null`); `anon` no lee. Subir, cambiar y borrar: solo dentro de la carpeta propia (`(storage.foldername(name))[1] = auth.uid()::text`) y con el perfil activo. Nombres: `avatars_select`, `avatars_insert_own`, `avatars_update_own`, `avatars_delete_own` y los mismos cuatro para `banners`.
- **Ruta en el perfil.** `profiles.avatar_path` y `profiles.banner_path`, con un `check` que obliga a que empiecen por el id del dueño. Solo se escriben con la RPC `public.set_profile_media(p_avatar_path, p_banner_path, p_clear_avatar, p_clear_banner)`, que valida la carpeta y que el objeto exista en el bucket de su tipo. Es `SECURITY INVOKER` (el barrido 06 solo admite como `SECURITY DEFINER` públicas los ayudantes de permisos): la política `profiles_update_media_own` solo se cumple dentro de la función (marca `vexa.profile_media_rpc` de la transacción) y, aun con la marca, exige que el resto de columnas no cambie. Un UPDATE directo del propio perfil sigue sin filas. El cambio queda en el registro como `member.updated` (la foto de la auditoría es genérica y ahora incluye las rutas).
- **URLs firmadas.** `services/supabase/profile-media.ts` firma las rutas con `createSignedUrls` (una llamada por bucket), con TTL de 3600 s, las guarda en memoria y las renueva cuando queda menos del 10% de su vida. Si firmar falla, la persona se muestra sin foto (nunca se rompe la pantalla). `members` y `auth` devuelven `Profile.avatarUrl`/`bannerUrl` ya firmadas; el tipo del dominio no cambia. La caché se vacía al cerrar sesión.
- **Reemplazo y baja.** Reemplazar sube un objeto nuevo, guarda la ruta y retira el anterior; quitar la foto limpia la ruta y retira el objeto. Retirar es de mejor esfuerzo: si falla, el objeto viejo queda huérfano sin afectar la operación. Si la RPC falla tras subir, el objeto nuevo también se retira.
- **Pendiente de verificar en navegador.** La subida desde la interfaz (recorte y compresión del selector) no se ha probado con un navegador real; la integración usa un PNG mínimo contra el Storage local. La CSP ya admite `connect-src` y `img-src` hacia el origen de Supabase.

### Notificaciones

- **Tabla.** `public.notifications` (migración `20261005000200_notificaciones.sql`): `user_id`, `type` (enum `notification_type`, con los nueve valores del dominio), `payload` jsonb (`check` de menos de 2 KiB), `read_at` y `created_at`. Sin trigger de auditoría: son datos derivados de eventos ya auditados.
- **Quién escribe.** Solo triggers, mediante `private.notify(usuario, tipo, carga)` (`SECURITY DEFINER` en `private`, sin `EXECUTE` para clientes; ignora destinatarios nulos o inactivos). El cliente no inserta ni borra.
- **Quién lee y marca.** Política `notifications_select_own` (solo filas propias y perfil activo). `authenticated` tiene `SELECT` y `UPDATE (read_at)` únicamente (privilegio de columna) más la política `notifications_update_own`. El trigger `notifications_guard` impide cambiar cualquier otra columna, volver a pendiente un aviso leído o fijar `read_at` en el futuro. Los RPC `mark_notification_read(p_id)` (boolean) y `mark_all_notifications_read()` (cantidad) son `SECURITY INVOKER`.
- **Eventos implementados.** `project_added` (alta en `project_members`; no avisa a quien se agrega a sí mismo), `task_assigned` (tarea nueva con responsable o cambio de `assignee_id`; no avisa al propio actor) y `expense_vote` (gasto nuevo en estado pendiente: a admin y socios activos, menos quien lo pagó). Las claves de `payload` son las que lee `NotificationMenu` (`title`, `message`, `actorName`, `actorRole`, `recipientName`, `projectName`, `projectId`, `taskName`, `taskId`, `memberRole`, `details`, `nextStep`; los gastos añaden `expenseId`, `expenseTitle` y `amount`). Los textos libres se recortan para respetar el tope.
- **Avisos con reloj (M6).** `daily_pending`, `hours_missing` y `renewal` los generan funciones de `private` que programa `pg_cron` (`20261013000000_avisos_con_reloj.sql`; horas Lima = UTC-5: 21:00 = 02:00 UTC, 20:00 = 01:00 UTC, 09:00 = 14:00 UTC); `expense_result` es un trigger. Son idempotentes (`payload.dedupeKey` con índice único parcial) y aceptan `p_now` para pruebas. El mock no los emite. En la nube hay que habilitar `pg_cron` antes de `supabase db push`. Pruebas: `supabase/tests/26_avisos_con_reloj.test.sql`.
- **Realtime.** La tabla está en la publicación `supabase_realtime`. El front se suscribe con `subscribeToNotifications(userId, …)`: `postgres_changes` `INSERT` con filtro `user_id=eq.<id>`; Realtime aplica además el RLS de lectura. `useNotifications` recarga la lista al recibir un aviso y solo se activa con `VITE_DATA_SOURCE=supabase`.
- **Seed.** `seed.sql` desactiva los tres triggers de aviso durante la carga y los reactiva al final: la base local arranca sin notificaciones.

### Chat: contrato y servicio

- El chat pasa por `ChatService` (`packages/services/src/index.ts`) y `services.chat`. Todos los métodos son asíncronos y quien actúa lo resuelve cada implementación. Los tipos (`ChatThread`, `ChatMessage`, `ChatSettings`, `ChatEvent`…) viven en `packages/domain/src/chat.ts`; las marcas de tiempo son milisegundos y los adaptadores convierten en su borde.
- Las pantallas leen y escriben solo con los hooks de `features/chat/hooks/` (TanStack Query): `useChatThreads`, `useChatStatus`, `useChatSettings`, `useWallpaperImage`, `useSharedMessages` y `useChatActions`. Solo enviar, reaccionar y marcar como leído actualizan la caché antes de responder (con retroceso y aviso si fallan); el resto avisa del error y recarga. `useChatSync` recarga las consultas con el evento `subscribe` del servicio y `useChatPresence` publica la presencia (`trackPresence`) y la lee (`subscribePresence`).
- El mock (`apps/web/src/services/mock/chat.ts`) aplica las reglas puras de `features/chat/chat-store.ts` sobre el mismo blob `vexa.chat-preview.v1` de `localStorage`; `mock/chat.test.ts` fija las reglas 1 a 10 a través del servicio. Los cálculos puros de la interfaz (no leídos, mensajes entrantes, aviso, lectura por otros) viven en `features/chat/chat-logic.ts`.
- En modo Supabase `services.chat` falla con "aún no está implementado" hasta el adaptador (B5e); la UI no cambia.

### Chat en la base

- **Migración y prueba.** `20261005000300_chat_nucleo.sql` y `supabase/tests/11_chat_nucleo.test.sql` (pgTAP, 165 pruebas) fijan las reglas 1 a 8 del plan. Los mensajes de error son los del mock, en español; el adaptador (B5e) los muestra tal cual.
- **Tablas.** `chat_threads` (`kind` direct/group, `direct_key` única = menor:mayor de los dos ids para un directo por pareja), `chat_members`, `chat_reads` (aparte, porque un admin no integrante también guarda lectura), `chat_messages` (cuerpo ≤ 4000, adjunto ≤ 25 MiB, anulación suave) y `chat_reactions` (clave primaria = un emoji por persona y mensaje). Sin auditoría. Las cinco están en `supabase_realtime`.
- **Acceso.** `public.chat_can_access(hilo)` (ayudante de permisos `SECURITY DEFINER`, en la lista blanca de 06): perfil activo y (integrante, o admin si es un grupo). Un admin lee, envía y anula en cualquier grupo, pero no ve los directos ajenos. `anon` no tiene nada y `authenticated` no tiene `DELETE`.
- **Escritura.** Hilos, integrantes y reacciones solo con RPC: `chat_direct_thread`, `chat_save_group`, `chat_delete_group` y `chat_react` son envoltorios `SECURITY INVOKER` de funciones `private` `SECURITY DEFINER` con `grant execute` explícito (también en la lista de 06). `chat_mark_read` es un upsert invoker en `chat_reads` que nunca baja `read_at`. Los mensajes se insertan con privilegio de columna y se actualizan solo en `body`, `edited_at` y `deleted_at`; el trigger `chat_messages_guard` aplica autoría, tope de 4000 medido antes de recortar, texto guardado recortado, `reply_to` en el mismo hilo, edición solo del autor y anulación del autor o de un admin en un grupo (borra texto, adjunto y reacciones). Enviar fija la lectura del emisor. `chat_reads_guard` impide retroceder o apuntar al futuro (más de 1 minuto).
- **Grupos.** Solo admin; nombre obligatorio tras recortar (máx. 60), descripción máx. 240, al menos un integrante, el creador siempre entra y sin duplicados. Borrar es real (cascada a integrantes, mensajes, lecturas y reacciones); quitar a alguien le revoca el acceso.

### Chat: ajustes y estado en la base

- **Migración y prueba.** `20261005000400_chat_ajustes.sql` y `supabase/tests/12_chat_ajustes.test.sql` (pgTAP, 114 pruebas) fijan las reglas 9 y 10. Sin fila no hay datos: el adaptador aplica los valores por defecto, que coinciden con los de las columnas (estado "Disponible", avisos sí, sonido suave, presencia sí, fondo ninguno, proyecto ninguno).
- **`chat_status` (pública para el estudio).** `status`, `presence` y `current_project_id`. Cualquier miembro activo lee todas las filas; cada persona inserta y actualiza solo la suya (privilegios de columna y políticas de fila propia); nadie borra. Está en `supabase_realtime`. `presence = false` oculta a la persona; la presencia en vivo usa Realtime Presence y no necesita tabla.
- **`chat_preferences` (privada).** `notifications`, `sound` (`chat_sound`: soft, bell, none), `wallpaper` (jsonb) y `wallpaper_path`. Solo la dueña lee y escribe, ni el admin; no se publica en Realtime.
- **Guardas `SECURITY INVOKER` (`private.chat_status_guard`, `private.chat_preferences_guard`).** Normalizan en lugar de rechazar: el estado se recorta y se corta a 80 caracteres (vacío permitido), y un fondo que no sea `{"kind":"none"}`, `{"kind":"preset","id":<1 a 40 caracteres>}` o `{"kind":"image"}` (este último solo con ruta guardada) pasa a `{"kind":"none"}`. El proyecto actual debe ser accesible (`can_access_project`, solo al elegirlo) o falla con "No tienes acceso a ese proyecto."; `null` significa ninguno. La ruta del fondo debe empezar por la carpeta propia ("La imagen debe estar en tu carpeta") y el objeto debe existir ("La imagen no existe en el almacenamiento").
- **Bucket `chat-wallpapers`.** Privado, 1 MiB, webp/jpeg/png. Las cuatro políticas `chat_wallpapers_*_own` limitan todo a la carpeta `<uid>/` con perfil activo; `anon` no tiene nada. El DELETE directo lo bloquea Storage, así que la baja se verifica por el catálogo.
- **Sin auditoría** de ajustes ni de estado.

