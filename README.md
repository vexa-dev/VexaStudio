# VEXA Studio · Observatorio

Demo interactiva local para el equipo VEXA: proyectos, sprints, tareas, horas y gastos. Interfaz liquid glass con un símbolo V tridimensional, temas oscuro/claro y movimiento adaptable.

## Integración con la aplicación existente

La resolución del PR #5 integra `main` sin sustituir sus flujos F1–F2. La aplicación principal conserva el acceso simulado de socios, los servicios mock, permisos, dashboard de participación, proyectos, tablero kanban, Mis tareas, horas, perfil y las pantallas previstas de gastos/equipo. Adopta los colores y tipografía Observatorio, navegación de cristal y núcleo 3D en el dashboard.

La demo original de cuatro rutas se conserva en `/observatorio/`, con acceso desde la navegación de la aplicación. Sus datos (`vexa.observatorio.v1`) son independientes del mock principal: el reinicio de la demo no reemplaza los registros del equipo. Comparte la preferencia de tema con la aplicación; sus estilos se aíslan mediante `@scope` para evitar colisiones entre componentes. No se han incorporado las ramas F3/F4 que todavía no forman parte de `main`.

`src/App.tsx` y `src/main.tsx` mantienen el router y los proveedores principales. `src/ObservatorioApp.tsx` contiene la demo; `src/index.css` define el sistema compartido y `src/observatorio.css` sus patrones propios. Se combinan las dependencias y las 63 pruebas de ambas líneas de trabajo.

## Desarrollo

Requiere Node.js 22.12 o superior y npm.

```powershell
npm ci
npm run dev
```

```powershell
npm run lint
npm test
npm run build
npm run preview
```

## Qué puedes probar

- Resumen con progreso, horas y gastos calculados a partir de los registros.
- Proyectos: crear, editar, buscar, filtrar y configurar el sprint; añadir tareas y cambiar su estado.
- Horas: registro manual en minutos o un temporizador global con pausa, continuación y guardado. El temporizador sobrevive a navegación y recarga, y redondea al siguiente minuto al guardarse. Una sesión admite hasta 24 horas; puedes descartarla con confirmación y registrar sesiones manuales separadas.
- Gastos: crear y editar registros por proyecto, fecha y categoría; importes en PEN con dos decimales.
- Preferencias: alternar temas, reducir efectos y restaurar ejemplos o comenzar con un espacio vacío. Reiniciar reemplaza los datos locales y el temporizador, con confirmación previa.

## Datos y límites

**Es una demo.** Los ejemplos y tus cambios se guardan solo en este navegador bajo `vexa.observatorio.v1`; no hay cuentas, sincronización ni conexión a datos reales. Usa fechas de Perú (`America/Lima`). No abras la demo simultáneamente en varias pestañas para editar: cada pestaña mantiene su propia sesión y la última escritura puede reemplazar cambios de otra.

Si localStorage está bloqueado o lleno, la interfaz avisa que los cambios durarán únicamente durante la sesión. Si los datos guardados tienen JSON inválido, una versión desconocida o referencias incompatibles, se cargan ejemplos con un aviso. Las preferencias se guardan por separado.

Supabase se mantiene preparado en `src/lib/supabase.ts`. Su configuración es opcional para esta demo:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Usa `.env.local`, que Git excluye, y conserva `.env.example` como plantilla. No coloques claves privadas en variables `VITE_`: se incorporan al cliente.

## Arquitectura

React 19, TypeScript, React Router, Vite y Tailwind. Formularios con React Hook Form y Zod; animación con Motion; geometría, material físico y reflejos locales con Three.js/React Three Fiber. Sora e IBM Plex Sans se sirven desde paquetes locales, sin peticiones a proveedores de fuentes.

- `src/domain.ts`: esquemas, datos de ejemplo, totales, tiempo y persistencia validada.
- `src/demo.ts` y `src/store.tsx`: contexto, acciones y avisos de almacenamiento.
- `src/pages/`: las cuatro pantallas; módulos de trabajo cargados por separado.
- `src/components/`: formularios, diálogos, temporizador y núcleo 3D.
- `src/index.css`: tokens, materiales, temas, estados y adaptación.
- `PRODUCT.md` y `DESIGN.md`: contexto del producto y sistema visual compartidos.

El 3D se carga en un chunk separado. Ese chunk supera 500 kB minificado y Vite informa el aviso; su carga se difiere y la interfaz funciona antes de que termine. La PWA precarga recursos de aplicación y fuentes en producción. WebGL tiene alternativa SVG; reducir efectos sustituye el canvas por SVG. Las animaciones respetan la preferencia del sistema y el render se pausa fuera de vista o con la pestaña oculta.

La escena Three.js modifica objetos externos al estado de React: Oxlint desactiva `react/immutability` solo para ese componente. La tabla desplazable tiene foco de teclado: `no-noninteractive-tabindex` admite su sección solo en la página de registros.

## Git y herramientas locales

Se comparten instrucciones/configuraciones de agentes, `PRODUCT.md`, `DESIGN.md`, `.impeccable/config.json` y `.impeccable/design.json`. Los paquetes de skills instaladas, configuraciones locales, cachés, binarios, capturas y reportes generados se excluyen sin borrarse del equipo.

## Validación

Vitest cubre esquemas, totales monetarios, progreso, datos inválidos, almacenamiento bloqueado y el cálculo del temporizador tras pausa/continuación/recarga. La revisión manual cubre creación de proyecto y tarea, edición de sprint y horas, cambios de estado, temporizador global, creación/edición de gastos, estados vacíos, reinicio y ambos temas en escritorio/móvil. También se comprobó reflujo a 720 px, nombres accesibles de la navegación compacta y la alternativa SVG al desactivar efectos. Las capturas de revisión quedan en `.impeccable/review/`, excluidas de Git.

Pendiente de comprobar en un navegador de escritorio real: zoom al 200 %, preferencia de movimiento reducido del sistema y WebGL deshabilitado. Sus mecanismos están implementados y revisados en código; esta sesión no simuló esas condiciones del entorno. La revisión visual independiente confirmó la composición tras corregir el encabezado del resumen.

No hay despliegue realizado. Autenticación, RLS, adjuntos y sincronización Supabase pertenecen a la siguiente fase.
