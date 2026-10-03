# VEXA Studio

Interfaz del espacio de trabajo del equipo, con datos simulados y temas claro/oscuro.
Usa los logos oficiales, paleta grafito/blanco hielo con acento azul acero, superficies de cristal, fondo lineal sutil, navegación líquida y la mascota robot v3.

## Desarrollo

Requiere Node.js 22.12 o superior y npm.

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

## Vistas

- Inicio: tareas por atender, gastos pendientes, proyectos activos, horas personales, participación y avance compacto del equipo.
- Mi día: plan diario de hasta tres prioridades (tareas o actividades libres), meta diaria y acceso a Tareas, resumen del día, daily desplegable con autoguardado e historial local, y foco configurable que continúa entre pantallas.
- Proyectos y tablero: organización de proyectos, sprints y tareas.
- Tareas: kanban personal sincronizado, administración de asignaciones y reloj persistente con pausas. Horas: borradores de tareas terminadas, selección múltiple y confirmación de un total distribuido.
- Gastos y Equipo: vistas interactivas con datos de ejemplo.
- Perfil: información del socio que inició la sesión simulada.

## Arquitectura

El repositorio usa npm workspaces y un único `package-lock.json`:

- `apps/web`: aplicación React/Vite, pantallas, estilos, PWA y adaptadores de navegador.
- `packages/domain`: tipos, reglas, fechas de Lima, formatos, prioridad de tareas y lógica de foco.
- `packages/services`: contratos asíncronos compartidos; las implementaciones actuales están en la web.
- `apps/desktop` y `apps/mobile`: espacios reservados con instrucciones; todavía no son aplicaciones.

Los comandos de desarrollo, pruebas y build se ejecutan desde la raíz. Para revisar los límites usa `npm run check:boundaries`. Las decisiones, revisión de código y guía para añadir funcionalidades están en [docs/arquitectura.md](docs/arquitectura.md).

El alias `@/` apunta a `apps/web/src`; los paquetes se importan mediante `@vexa/domain/<módulo>` y `@vexa/services`. Los tokens visuales y componentes permanecen en la web hasta que exista una segunda interfaz que los comparta.

La configuración opcional de Supabase está en `apps/web/src/lib/supabase.ts`. Crea `apps/web/.env.local` usando `apps/web/.env.example`; sus valores son públicos de cliente. La aplicación sigue usando datos simulados y no conecta datos remotos.

Vercel se configura con la **raíz del repositorio**, `npm ci`, `npm run build` y salida `apps/web/dist`, definidos en `vercel.json`. No cambiar la raíz de Vercel a `apps/web`, porque necesita acceder a los paquetes compartidos. `npm run preview` sirve esa misma compilación.

## Diseño y acceso

El sistema vigente se documenta en `DESIGN.md` y los compromisos de producto en `PRODUCT.md`.
Solo se conserva la imagen activa de mascota en `apps/web/public/mascot/vexa-robot.png`.
Para explorar la aplicación, entra desde uno de los cuatro perfiles de demo.
El formulario de correo/contraseña y recuperación muestra avisos de conexión pendiente.

Horas incluye confirmación agrupada de tareas y registro sin tarea (actividad, proyecto y respaldo), historial con filtros, resumen mensual con gráficos en Lima y revisión por otro socio. Las correcciones reabren la revisión y se auditan. El historial previo permanece intacto; sus entradas sin horario fiable se excluyen del gráfico horario. Todo funciona en los servicios mock y localStorage.


Proyectos y tareas: creación y asignación solo por admin; la membresía de un proyecto es independiente de recibir una tarea. Los colaboradores consultan únicamente proyectos de los que son miembros y mueven sus tareas desde el tablero personal. El mock añade un perfil Alex para probar estos permisos sin modificar los cuatro socios existentes.

El reloj vive en Tareas y persiste instantes/segmentos, recuperando el tiempo tras cerrar la página sin contar pausas. Sonido horario optativo mientras el navegador puede ejecutar JavaScript; al volver se informa una hora pendiente con opción de pausar. Una alarma con el navegador cerrado requiere infraestructura de notificaciones posterior. Finalizar reloj/tarea prepara un borrador; confirmar en Horas lo envía a revisión y entonces aparece en historial/resúmenes.


Las tareas admiten descripciones Markdown con vista previa y etiquetas por proyecto. Admin gestiona nombre/color desde **Proyecto → Etiquetas** y marca etiquetas al crear o editar tareas. Colaboradores consultan contenido y etiquetas adjuntas, incluso en asignaciones de proyectos externos. Todos los selectores de opciones usan el menú temático compartido.
