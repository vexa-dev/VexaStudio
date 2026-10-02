---
name: VEXA Studio
description: Espacio de trabajo compacto de grafito y blanco hielo, cristal translúcido y acento azul acero.
colors:
  brand: "#498974"
  accent: "#7b97ad"
  bg-dark: "#08090b"
  bg-light: "#f7f8fa"
  glass-dark: "rgba(24, 27, 32, 0.68)"
  glass-light: "rgba(255, 255, 255, 0.66)"
typography:
  display:
    fontFamily: "Sora Variable, sans-serif"
    fontWeight: 500
    letterSpacing: "-0.035em"
  body:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
rounded:
  control: "12px"
  navigation: "15px"
  card-compact: "17px"
  card-mobile: "18px"
  login-panel: "28px"
---

# Sistema de diseño: VEXA Studio

Actualizado el 02/10/2026. Este documento describe la implementación vigente; sustituye las propuestas anteriores de Observatorio, paleta verde, esculturas 3D y zorro.

## Dirección visual

Interfaz compacta para trabajar con horas, tareas, proyectos y participación. Fondos grafito y blanco hielo, superficies de cristal y acentos azul acero. El logo oficial conserva el verde VEXA. Inicio y Mi día presentan cabeceras breves con fecha e información útil; el resumen personal de horas aparece antes de participación y equipo.

La demo independiente Observatorio y sus objetos 3D fueron retirados. No existe una portada decorativa ni un banner WorkspaceHero activo.

## Fuentes de verdad

- `src/colors.css`: paletas de referencia OKLCH, verde de marca, neutros, acero y estados.
- `src/glass.css`: roles semánticos de ambos temas, materiales y distribución compacta.
- `src/index.css`: base, tipografía, aliases Tailwind y estilos funcionales. Sus valores iniciales de color son sobrescritos por `glass.css`, que se importa después.
- `src/lib/motion-tokens.ts`: duraciones, desplazamientos, inclinación, mascota y navegación líquida.
- `src/features/auth/pages/login.css`: composición y controles del acceso.
- `src/components/mascot-companion.css`: tamaño, posición y controles de la mascota.

Los componentes deben consumir roles semánticos. Los cambios de paleta se realizan en las referencias y en su asignación por tema.

## Color y temas

| Rol | Claro | Oscuro |
| --- | --- | --- |
| Fondo `--bg` | `#f7f8fa` | `#08090b` |
| Superficie `--surface` | `--neutral-50` | `--neutral-900` |
| Superficie elevada `--surface-2` | `--neutral-100` | `--neutral-800` |
| Texto `--fg` | `--neutral-900` | `--neutral-50` |
| Texto secundario `--muted` | `--neutral-600` | `--neutral-400` |
| Acento `--primary` | `--steel` (`#7b97ad`) | `--steel` (`#7b97ad`) |
| Acción `--primary-solid` | `--steel-700` | `--steel-300` |
| Texto sobre acción `--primary-fg` | Blanco | `#08090b` |
| Texto de acento `--primary-text` | `--steel-800` | `--steel-200` |
| Cristal `--glass` | Blanco al 66 % | `rgb(24 27 32)` al 68 % |
| Borde de control `--control-border` | `--neutral-450` | `--neutral-550` |

Éxito, advertencia y error usan `--success`, `--warning`, `--danger` y sus fondos `*-soft`. Los estados incluyen texto; el color por sí solo no comunica su significado. La marca usa `public/vexa-fondo-blanco.svg` y `public/vexa-fondo-negro.svg`, sin recolorear su verde `#498974`.

El tema oscuro se activa mediante `.dark` en el elemento raíz. El selector está disponible tanto en acceso como dentro del espacio de trabajo.

## Tipografía

Sora Variable para marca, títulos y cifras principales. IBM Plex Sans local en pesos 400, 500 y 600 para lectura, etiquetas y controles. Las cifras de horas, porcentajes e importes usan `.num` para conservar ancho tabular.

Las cabeceras tranquilas usan títulos de 24–30 px y texto secundario de 13 px. El acceso usa un título de 40–64 px en escritorio y 32 px en móvil. La jerarquía favorece datos y acciones; Inicio muestra la participación y sus puntos sin un desplegable de cálculo.

## Distribución y navegación

A partir de 1024 px, `LavaNav` ocupa un raíl fijo de 80 px pegado al borde izquierdo y el shell deja 110 px para él. Los destinos tienen iconos, nombres accesibles y etiquetas visibles con hover o foco. La cabecera permanece arriba con contexto, temporizador, tema y usuario.

Por debajo de 1024 px se muestra navegación inferior con seis destinos: Inicio, Mi día, Proyectos, Mis tareas, Horas y Gastos. Equipo se abre desde el menú del avatar. No hay menú hamburguesa. El contenido reserva espacio para el dock, las áreas seguras y el temporizador activo.

Desde 768 px se aplican cuadrículas y espaciados compactos: Mi día distribuye prioridades, foco y daily; tareas y registros de horas se agrupan en columnas. En móvil se apilan las regiones y el equipo se presenta en filas. El contenido adicional debe poder crecer y desplazarse sin quedar recortado.

## Materiales y componentes

Las tarjetas y el daily usan cristal de base consistente, borde tenue y desenfoque de 16 px con saturación del 115 %. Los radios varían según el componente: las cards compactas usan 17 px y las móviles 18 px; el panel de acceso usa 28 px en escritorio y 24 px en móvil.

La inclinación de cards está limitada a 1,1 grados por eje con ratón. No hay reflejo que siga al cursor. El fondo usa trazos geométricos estáticos y un halo tenue. La navegación líquida conserva el borde ondulante y gotas planas. En oscuro, panel, curva y gotas comparten el color sólido #0e1115, sin degradado, luces ni sombra en el indicador activo. El acabado claro se mantiene.

Reutilizar `Button`, `Card`, `Field`, `Badge`, `Avatar`, `Meter`, `SegmentedBar`, `CountUp`, `Sheet` y `Toaster`. Las hojas de formulario conservan el comportamiento móvil y escritorio existente. Campos y controles deben mantener límites distinguibles, etiquetas, mensajes de error y foco visible.

## Movimiento

Los tokens generales usan 0,08 / 0,18 / 0,35 / 0,6 segundos para instantáneo, rápido, normal y lento. El acceso escalona sus regiones cada 0,08 segundos, eleva botones 2 px en hover y usa escala 0,97 al presionar.

La navegación líquida usa cinco emisores de gotas con radios variados de 6–16 unidades SVG, entre pequeñas, medianas y grandes. Los inicios se escalonan 800 ms; conserva duraciones de 1,8–3 segundos y pausas de 1–2,4 segundos para evitar saturación. Las animaciones de cifras y barras conservan su política de primera reproducción por sesión. `prefers-reduced-motion` desactiva inclinación, flotación y parpadeos automáticos y reduce el movimiento de las entradas.

## Mascota vigente

Única imagen de producción: `public/mascot/robot-concept-v3.png`. Cabeza gris hielo y azul acero, visor grafito y capa verde VEXA como cuerpo, sin cuello, torso ni pies. `RobotIdleArtwork` separa cabeza y capa mediante recortes SVG y dibuja el visor y los ojos alineados sobre la ilustración.

Cabeza y capa flotan en ciclos independientes de 4,4 y 5,6 segundos. Los ojos cierran en el visor cada 3,5–6,5 segundos. Solo existe reposo animado; tocar o pasar el cursor no cambia la pose.

`MascotCompanion` permite arrastrar con ratón o dedo y mover con flechas (16 px; Shift reduce el paso a 4 px). Guarda posición y estado oculto bajo `vexa-studio.mascot` en localStorage. Conserva controles para dormir y despertar, límites de pantalla y separación de navegación y temporizador. El acceso reutiliza la ilustración en reposo.

Las imágenes de zorro y los conceptos robot v1/v2 se eliminaron por estar sin uso. No conservar variantes descartadas dentro de `public`, ya que Vite las copia al build.

## Acceso

Cabecera con logo oficial y selector de tema, presentación tipográfica y mascota junto a un panel de cristal. Dos columnas en escritorio; una columna por debajo de 768 px. Los cuatro perfiles de demo se muestran en una cuadrícula de dos columnas, con carga, error y último perfil recordado. Elegir un perfil vuelve a la ruta solicitada.

El formulario visual de correo/contraseña permite mostrar contraseña y abrir recuperación. Todavía no autentica ni envía correos: al enviarlo informa que las cuentas se conectarán más adelante. El acceso funcional actual es la selección de perfiles simulados sin contraseña.

## Accesibilidad y mantenimiento

- Mantener etiquetas asociadas, foco visible, objetivos táctiles y estados de carga, error y vacío.
- Conservar texto junto a estados y cifras tabulares en métricas.
- Comprobar contraste sobre la composición real del cristal en ambos temas; los tokens aislados no garantizan el resultado.
- Revisar móvil y escritorio y la preferencia de movimiento reducido tras cambios visuales.
- Mantener logos, iconos PWA y la imagen activa de mascota. Retirar variantes sin referencias.
- No presentar datos simulados como actividad real del estudio.

Las capturas y scripts de revisión local viven en `design-preview/`, ignorado por Git. Las mediciones de propuestas previas no certifican la implementación vigente; cualquier auditoría nueva debe indicar las vistas y estados que comprobó.

## Verificación del 02/10/2026

- Typecheck y compilación de producción completados; 55 pruebas de Vitest aprobadas.
- Lint sin errores, con nueve advertencias existentes de accesibilidad en componentes compartidos y formularios.
- Acceso revisado en claro y oscuro a 320, 390, 768 y 1366 px: cuatro perfiles y sin desbordamiento horizontal. Formulario, recuperación visual y retorno a `/horas` comprobados, sin errores JavaScript.
- Mascota comprobada en escritorio y móvil: cabeza/capa independientes, parpadeo, posición anclada y alternativa estática con movimiento reducido. Sin errores JavaScript.
- Build con una sola imagen en `dist/mascot/`: robot v3. La limpieza retiró aproximadamente 3,96 MB de imágenes descartadas del directorio público.

## Dashboard operativo

Actualizado el 02/10/2026. Inicio presenta primero tus horas y participación; después el resumen operativo y el contexto del equipo.

1. Contexto personal: dos tarjetas destacadas con iconos contenidos, cifras grandes, unidades pequeñas y reflejo azul acero tenue. Horas agrupa el mínimo junto a la cifra, muestra el anillo de cumplimiento y reserva el pie para saldo, compromiso semanal y acceso a Horas. Participación separa el porcentaje de los puntos propios y totales; el reparto se representa con una barra fina y etiquetas por socio. Se conserva la explicación desplegable de puntos.
2. Accesos complementarios «También en el estudio»: enlaces pequeños a tareas, proyectos, gastos por revisar y Mi día, con contadores junto a las etiquetas. La franja no tiene contenedor de tarjeta ni ocupa todo el ancho; se adapta mediante salto de línea. Identifica el borrador diario local si existe.
3. Tareas por atender: hasta tres tareas de proyectos activos, filtro Equipo/Mías y acceso al tablero o Mis tareas. Se ordenan por cierre del sprint, después revisión, en progreso y pendientes; las tareas sin sprint se muestran después. Se excluyen tareas terminadas y sprints cerrados. Las fechas visibles son cierres de sprint, no plazos individuales de tareas; el modelo actual no contiene prioridad ni fecha límite de tarea.
4. Gastos por revisar: concepto, importe, votos a favor y si el usuario ya votó, con enlace al detalle del gasto. Las renovaciones vencidas o de los próximos 30 días aparecen cuando existen. Se mantiene visible que emitir votos no está habilitado en la demo.
5. Contexto del estudio: proyectos en marcha con tareas hechas/total y cierre de sprint; el equipo en un panel secundario de media anchura, con cuatro filas de nombre, horas/mínimo y cumplimiento. El detalle de puntos, área y participación de los demás se consulta en Equipo.

`DashboardOperations.tsx` usa los hooks de tareas, resúmenes de proyectos y gastos, con carga y error independientes. `attention.ts` define el orden de atención y tiene pruebas para cierres, estados, proyectos pausados y filtro personal. `useExpenseOverview` comparte los gastos y votos persistidos entre el dashboard y Gastos; la pantalla de Gastos dejó de regenerar un seed independiente. Sus enlaces usan `filter=pending` y `expense=<id>` para abrir directamente el detalle. Los servicios de lectura de gastos están implementados; las escrituras permanecen pendientes.

La navegación y tarjetas conservan los tokens de ambos temas. Inicio aprovecha el ancho disponible hasta 1680 px. Horas y participación encabezan dos columnas iguales con altura natural y composición compacta. Desde 768 px los accesos complementarios ocupan una columna lateral sin tarjeta, de 160 px en tablet y 192 px desde 1280 px. El título queda como texto suelto sobre los botones, con objetivos táctiles de 44 px en tablet. En móvil estos accesos se ocultan; los módulos siguen disponibles en la navegación principal. El área operativa usa columnas independientes: tareas y proyectos a la izquierda; gastos y equipo a la derecha. Gastos conserva altura natural. En móvil se apilan métricas, tareas, gastos, proyectos y equipo. Se mantiene el desplazamiento natural bajo la navegación fija.

Verificación: tipos y compilación aprobados; 60 pruebas aprobadas; lint sin errores y con las nueve advertencias anteriores. Revisado en ambos temas a 320, 390, 768 y 1366 px sin desbordamiento horizontal ni errores JavaScript. Comprobados filtro Mías, apertura directa de gasto y coherencia entre ambos módulos al modificar el estado en un navegador aislado. Auditoría de texto a 1366 × 768: 100 muestras por tema, mínimos 6,62:1 en oscuro y 5,48:1 en claro, sin fallos detectados. Esta muestra no certifica todos los estados posibles.

Revisión de distribución del 02/10/2026: comprobados 320, 390, 768, 1024, 1366 y 1920 px en ambos temas. Las métricas aparecen antes del resumen operativo; a 1920 px se usan 1680 px de contenido y Gastos mide aproximadamente 257 px frente a 407 px de Tareas. Sin desbordamiento horizontal ni errores JavaScript; accesos, filtro Mías y detalle de gasto comprobados. Tipos, compilación y 60 pruebas aprobados; lint conserva las nueve advertencias previas.

Acabado visual del 02/10/2026: las tarjetas principales mantienen cifras, contrastes y navegación; los accesos de módulos pasan de una superficie ancha de unos 80 px a enlaces compactos de 38 px. Revisados ambos temas de 320 a 1920 px, sin desbordamiento horizontal. Auditoría de 104 muestras de texto por tema: mínimos calculados 6,62:1 en oscuro y 5,48:1 en claro, sin fallos. Compilación, tipos y 60 pruebas aprobados; lint conserva las nueve advertencias previas.

Ajuste de densidad del 02/10/2026: se retira «¿Cómo se calcula?» de Inicio y su consulta de ajustes. Las métricas reducen cifras, anillo, separaciones y relleno, sin alturas fijas. Desde 768 px los accesos «También en el estudio» ocupan una columna lateral junto al resumen personal, sin contenedor de tarjeta. En móvil se ocultan para evitar repetir la navegación. Tareas sigue inmediatamente a las métricas.

Verificación del ajuste de densidad: ambos temas de 320 a 1920 px sin desbordamiento ni errores JavaScript. En laptop de 1366 px el resumen personal mide unos 231 px y Tareas comienza a unos 417 px del borde superior. Tipos, compilación y 60 pruebas aprobados; lint conserva nueve advertencias previas.

Acabado sutil de tarjetas: superficies uniformes con opacidad del 88 % en ambos temas, desenfoque de 12 px, borde fino uniforme y sombra corta y tenue. Las métricas de Inicio no usan degradado diagonal, reflejo interior ni línea luminosa superior. Se conserva la inclinación de 1,1 grados y su desactivación con movimiento reducido.

Jerarquía del resumen personal: las dos métricas principales usan un tinte sólido azul gris suave (#edf2f6 en claro y #202830 en oscuro), borde ligeramente más definido y títulos de peso 600. Los paneles secundarios conservan superficies neutras. Esta distinción no añade degradados, líneas luminosas ni reflejos.

## Horas: registro, historial y análisis

Actualización autorizada el 02/10/2026. La navegación interna contiene Registro (vista inicial), Historial, Resumen mensual y Revisión (socios/admin). Las vistas se enlazan con `?vista=` y conservan navegación atrás/adelante. Registro muestra el temporizador por actividad y acceso al formulario manual, con registros recientes debajo. No se requiere tarea: proyecto y tarea son opcionales; la descripción es obligatoria y el respaldo admite un enlace HTTP/HTTPS.

Historial presenta todos los registros propios, fechas de actividad y creación, hora de inicio/fin cuando existe, duración, estado, revisión, respaldo y anulación. Filtra por fechas, texto y estado. El resumen permite elegir mes; separa registradas/aprobadas/sin aprobar/días activos y muestra barras diarias y por hora de Lima, con tablas textuales desplegables. Los intervalos se distribuyen entre horas/días y se recortan al mes. Los registros anteriores sin horario fiable suman al total diario pero no al gráfico horario.

Revisión muestra entradas finalizadas de otros miembros, con aprobar o pedir aclaración con motivo. La modificación de un registro aprobado reciente lo devuelve a pendiente; los pagados/anulados no se editan. Una aclaración pendiente habilita corrección sin el límite de antigüedad. Superficies uniformes, navegación discreta y controles de 44 px; las columnas se apilan en tablet/móvil. Persistencia exclusivamente mock/local, compatible con datos anteriores sin borrar el historial.

Verificación de Horas: ciclo completo de registro manual sin tarea, historial filtrado, aclaración, corrección y aprobación entre dos socios, más inicio/parada del temporizador. Cuarenta combinaciones de vista/tema/ancho (320, 390, 768, 1366, 1920 px) sin desbordamientos ni errores JavaScript. Tipos, producción y 71 pruebas en ocho archivos aprobados; lint mantiene únicamente las nueve advertencias previas.

### Refinamiento de Horas — 02/10/2026

El campo de sesión comienza con dos líneas (64 px), no admite estiramiento manual y crece al escribir o pulsar Enter. Registro manual ocupa una tarjeta de altura natural con tinte discreto, pasos breves y acción clara. La sesión activa y el temporizador global muestran tiempo tabular, actividad y control de finalizar compacto.

Las filas de Registro, Historial y Revisión distribuyen actividad, proyecto/persona, fecha/horario, estado y tiempo en columnas, con altura aproximada de 68 px en escritorio. Al abrir una fila se consulta el detalle completo en un modal: fechas de actividad/creación, origen, tarea, proyecto, respaldo y revisión. Solo queda Aprobar como acción en filas de revisión; Pedir aclaración y su formulario están dentro del detalle.

Los selectores de proyecto, tarea, estado, fechas y mes en Horas usan menús propios con tokens del tema, cierre con Escape/clic exterior y devolución del foco al seleccionar. Los controles nativos restantes respetan `color-scheme`. En móvil, el botón + queda junto al título, la navegación Registro/Historial/Resumen/Revisión ocupa una fila y las acciones se integran a filas compactas. El detalle usa una superficie sólida para mantener legibilidad.

El gráfico horario identifica el mes elegido y explica cuánto tiempo carece de horario cuando está vacío. Cambio comprobado entre septiembre (15–17 h) y octubre (9–11 h) usando datos aislados con horario conocido; no se atribuyen horarios a registros históricos. Verificados crecimiento del campo, registro manual con nuevos selectores, filtros y aprobación/aclaración desde modal. Pruebas: 71 aprobadas; producción/tipos sin errores y solo nueve advertencias previas de lint.

Modales oscuros: todos los componentes Sheet comparten superficie sólida #171a1f, campos #22272d y bordes neutros #3b424b. Se elimina la línea luminosa interior y la transparencia del panel; divisores y contorno externo usan un 9 % de blanco. El foco y los errores conservan su señalización. El tema claro se mantiene. Los tokens se limitan al modal y sus menús.

