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
