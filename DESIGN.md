---
name: Vexa Studio
description: Plataforma interna de 4 socios, pensada para el celular, con verde de marca sobre neutros sobrios y cifras que se leen de un vistazo.
colors:
  primary: "#548d7b"
  primary-solid-light: "#3f6f5f"
  primary-text-light: "#3f6f5f"
  primary-text-dark: "#7fb5a2"
  primary-fg-light: "#ffffff"
  primary-fg-dark: "#0a0a0a"
  bg-light: "#f8fafc"
  surface-light: "#ffffff"
  surface-2-light: "#f1f5f9"
  fg-light: "#0f172a"
  muted-light: "#475569"
  border-light: "#d3dbe6"
  segment-light: "#cbd5e1"
  danger-light: "#b91c1c"
  warning-light: "#92400e"
  success-light: "#166534"
  bg-dark: "#0a0a0a"
  surface-dark: "#1a1a1a"
  surface-2-dark: "#232323"
  fg-dark: "#f1f5f9"
  muted-dark: "#94a3b8"
  danger-dark: "#f87171"
  warning-dark: "#fbbf24"
  success-dark: "#4ade80"
typography:
  display:
    fontFamily: "Plus Jakarta Sans Variable, Plus Jakarta Sans, Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "Plus Jakarta Sans Variable, Plus Jakarta Sans, Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Plus Jakarta Sans Variable, Plus Jakarta Sans, Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  body:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  figure:
    fontFamily: "Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
    fontFeature: "'tnum', 'cv11'"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.primary-solid-light}"
    textColor: "{colors.primary-fg-light}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.fg-light}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "{colors.danger-light}"
    textColor: "{colors.bg-light}"
    rounded: "{rounded.lg}"
    height: "44px"
  card:
    backgroundColor: "{colors.surface-light}"
    rounded: "{rounded.xl}"
    padding: "16px"
  card-accent:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    padding: "16px"
  badge-primary:
    textColor: "{colors.primary-text-light}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  field:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.fg-light}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 12px"
  sheet:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.fg-light}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  timer-bar:
    backgroundColor: "{colors.primary-solid-light}"
    textColor: "{colors.primary-fg-light}"
    rounded: "{rounded.2xl}"
    padding: "10px 10px 10px 16px"
  task-card:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.fg-light}"
    rounded: "{rounded.xl}"
    padding: "14px"
---

# Design System: Vexa Studio

## Overview

**Creative North Star: "El tablero de bolsillo"**

Es una herramienta de operación para cuatro socios que la abren en segundos, en el celular, a menudo con poca luz o al aire libre. El sistema es sobrio: neutros fríos, un solo verde de marca (el de vexa.space) y cifras grandes y ordenadas que responden dos preguntas sin hacer cuentas: cuánto llevo del mes y cuánto del reparto me toca. La marca fue fijada por el product owner (verde `#548d7b`, fondo oscuro `#0a0a0a`, superficie `#1a1a1a`, Inter y Plus Jakarta Sans); el modo claro es una derivación que conserva la misma familia y cumple contraste AA.

La densidad es media y el movimiento es corto: las entradas de datos se revelan una sola vez por sesión y las acciones frecuentes responden en 140 ms. El color comunica marca y "esto es tuyo", nunca reprobación: el estado siempre se dice también con texto.

**Key Characteristics:**
- Un solo acento (verde), con cuatro roles separados para cumplir AA en cada tema.
- Capas tonales: fondo, superficie, superficie-2; sombra solo en claro.
- Cifras siempre tabulares (`.num`), en frases legibles ("Tienes el 31 % del reparto").
- Móvil primero: objetivos de 44 px, barra inferior, áreas seguras, `dvh`.
- Movimiento con propósito: `ease-out` fuerte, `clip-path` y opacidad; nada en acciones de teclado o de uso repetido.

## Colors

Paleta neutra fría con un verde de marca apagado; los estados usan tonos distintos por tema para mantener contraste.

### Primary
- **Verde Vexa** (`primary`, #548d7b): el verde de marca tal cual. Rellenos decorativos y de datos (relleno del `Meter`, segmento propio de `SegmentedBar`, anillo de foco, `accent-color`, cursor de inputs). No sirve como fondo de texto ni como texto en claro: no alcanza 4.5:1.
- **Verde sólido** (`primary-solid`): fondo de botón primario y del indicador activo. En claro es #3f6f5f (`primary-solid-light`, con `primary-fg` blanco); en oscuro vuelve a #548d7b con `primary-fg` #0a0a0a. Existe porque el verde de marca con texto blanco no llega a AA en claro.
- **Verde de texto** (`primary-text`): texto y iconos de acento sobre `bg`/`surface`/`primary-soft`. En claro #3f6f5f; en oscuro se aclara a #7fb5a2 (`primary-text-dark`) porque el verde de marca sobre #1a1a1a queda corto.
- **Verde suave** (`primary-soft`): tinte translúcido de #548d7b (12 % en claro, 20 % en oscuro). Fondo de avatares, badge primario, ítem de navegación activo, `Card` de tono accent y selección de texto. No tiene token hex propio en el frontmatter porque es alfa.

### Neutral
- **Fondo** (`bg`): #f8fafc claro, #0a0a0a oscuro. Página y cabecera translúcida (`bg/90` con blur).
- **Superficie** (`surface`): #ffffff / #1a1a1a. Tarjetas, sidebar, barra inferior, menús, inputs.
- **Superficie 2** (`surface-2`): #f1f5f9 / #232323. Hover, pista del `Meter`, fondo de badges de estado, skeletons.
- **Texto** (`fg`): #0f172a / #f1f5f9. **Texto atenuado** (`muted`): #475569 / #94a3b8, para apoyo y etiquetas.
- **Borde** (`border`): #d3dbe6 claro; blanco al 10 % en oscuro. **Segmento** (`segment`): #cbd5e1 claro; blanco al 16 % en oscuro. Es el neutro de los segmentos ajenos y del anillo del `Meter`.

### Estados
- **Peligro** (`danger`): #b91c1c / #f87171. Errores de formulario, botón destructivo y badge de peligro.
- **Advertencia** (`warning`): #92400e / #fbbf24. **Éxito** (`success`): #166534 / #4ade80. Solo como color de texto sobre `surface-2` dentro de `Badge`, siempre acompañado de una palabra.

### Named Rules
**The Four Greens Rule.** `primary` rellena, `primary-solid` sostiene texto de botón, `primary-text` escribe y `primary-soft` tiñe. No se usa uno en el rol del otro.

**The Own-Segment Rule.** Lo tuyo va en verde (segmento "Tú", cifra del reparto); lo de los demás va en `segment` neutro. El verde señala pertenencia, no aprobación.

**The Tokens Only Rule.** Ningún componente usa hex, `rgb()` ni utilidades de paleta de Tailwind; solo los tokens de `src/index.css`.

## Typography

**Display Font:** Plus Jakarta Sans Variable (con Inter Variable y sans del sistema como respaldo). Aplicada por regla base a `h1`, `h2`, `h3`, y por clase `font-display` a marca, avatares y frases de cifra.
**Body Font:** Inter Variable (con `ui-sans-serif, system-ui`). Ambas fuentes se sirven autoalojadas con `@fontsource-variable`.

**Character:** Plus Jakarta aporta calidez en títulos; Inter mantiene neutras la interfaz y las cifras.

### Hierarchy
- **Headline** (700, `text-3xl` 1.875rem, leading tight): título de la pantalla de ingreso.
- **Display** (700, `text-2xl` 1.5rem, sube a `sm:text-3xl` en la frase del reparto): título de página (`PageHeader`) y la frase con `CountUp`.
- **Title** (600, `text-base` 1rem, `text-lg` en tarjetas de proyecto): títulos de sección dentro de tarjetas y estados vacíos.
- **Body** (400/500, `text-sm` 0.875rem): texto corrido, filas, botones, campos. Los inputs fuerzan 16 px para evitar el zoom de iOS.
- **Label** (500, `text-xs` 0.75rem): apoyo, encabezados de tabla, badges y etiquetas de la barra inferior. Sin mayúsculas ni tracking especial.
- **Figure** (`.num`: 600, tabulares, `letter-spacing: -0.02em`): toda cifra de dato (horas, puntos, porcentajes), del tamaño de su contexto (`text-xs` a `text-lg`).

### Named Rules
**The Tabular Figures Rule.** Toda cifra que se compara o se anima lleva `.num` (`tnum`, `cv11`, Inter). Así las columnas se alinean y el `CountUp` no sacude el texto.

**The Sentence Number Rule.** La cifra principal vive dentro de una frase ("Llevas 32 h de las 48 h mínimas"), no como estadística suelta.

## Layout

Móvil primero, con un ancho mínimo de 320 px. El contenido va en `main` con `max-w-6xl`, padding de 16 px (`lg:px-8`) y `pb-28` en móvil para librar la barra inferior. Desde `lg` aparece un sidebar fijo de 15 rem (`w-60`) y el contenido se desplaza con `lg:pl-60`. La cabecera sticky mide 3.5 rem más el área segura superior; la barra inferior suma `env(safe-area-inset-bottom)`. Alturas de pantalla con `min-h-dvh`. El viewport usa `viewport-fit=cover` e `interactive-widget=resizes-content`; `theme-color` es #0a0a0a. Para la app instalada, `index.html` añade `apple-touch-icon`, `mobile-web-app-capable`, `apple-mobile-web-app-capable` y `apple-mobile-web-app-title` ("VEXA").

Las pantallas se cargan por ruta con `lazy` y `Suspense`; mientras llega el código se muestra un `Skeleton` de 16 rem dentro del layout. Cuando hay un temporizador abierto, `main` sube su relleno inferior de `pb-28` a `pb-44` para que la `TimerBar` no tape contenido.

La navegación tiene 6 destinos; la barra inferior muestra 5 (`grid-cols-5`, todos menos Proyectos, que se alcanza por el menú de usuario) y el sidebar muestra los 6. Las rejillas de contenido son de una columna en móvil y pasan a `sm:grid-cols-2`, `lg:grid-cols-3` (proyectos) o `lg:grid-cols-[1.5fr_1fr]` (Inicio). Ritmo: `gap-4` entre tarjetas, `gap-5` dentro de la tarjeta principal, `p-4` que sube a `sm:p-5`. Tu propia fila va primero en las listas del equipo.

Objetivos táctiles de 44 px (`h-11`, `size-11`, `min-h-11`). Los botones `sm` también miden 44 px (`h-11`) y solo se distinguen por el relleno horizontal. Las excepciones son mayores, nunca menores: el botón de detener de la `TimerBar` (48 px) y las pestañas del tablero móvil (`min-h-12`).

El tablero de tareas usa una rejilla horizontal en escritorio (`auto-cols-[minmax(16rem,1fr)]`, una columna por estado, con desplazamiento lateral si no caben) y, por debajo de `lg` (64 rem), una sola columna a la vez.

## Elevation & Depth

Híbrido tonal. La profundidad viene de capas (`bg`, `surface`, `surface-2`) y bordes de 1 px. En claro, la tarjeta de tono `raised` añade una sombra mínima; en oscuro esa sombra es nula y el borde blanco translúcido hace el trabajo.

### Shadow Vocabulary
- **Card** (`--shadow-card`: `0 1px 2px rgb(15 23 42 / 0.06), 0 1px 1px rgb(15 23 42 / 0.04)`; nula en oscuro): `Card tone="raised"`, `TaskCard` y la pestaña activa del tablero móvil.
- **Pop** (`--shadow-pop`: claro `0 12px 28px -10px rgb(15 23 42 / 0.28), 0 2px 6px rgb(15 23 42 / 0.08)`; oscuro `0 16px 36px -12px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.06)`): menús flotantes (`UserMenu`), `Sheet`, `TimerBar`, avisos del `Toaster` y la `TaskCard` mientras se arrastra.

### Named Rules
**The Flat In Dark Rule.** En oscuro las tarjetas no llevan sombra; se separan por tono y borde.

## Shapes

Esquinas suaves y consistentes: 6 px en segmentos de barra (`rounded-md`), 8 px en botones y campos (`rounded-lg`), 12 px en tarjetas, menús, columnas del tablero y estados vacíos (`rounded-xl`), 16 px en la `Sheet` y la `TimerBar` (`rounded-2xl`; la `Sheet` solo redondea arriba en móvil), y forma de píldora (`rounded-full`) en badges, avatares, medidor y anillos. Bordes de 1 px en `border`; el estado vacío usa borde discontinuo. Los rellenos de barra se recortan con `clip-path` redondeado.

## Components

### Buttons
Cuatro variantes; altura 44 px en ambos tamaños (`md` con más relleno horizontal que `sm`), radio 8 px, `text-sm font-medium`, ícono y texto con `gap-2`.
- **Primary:** `primary-solid` con `primary-fg`; hover baja la opacidad a 0.9.
- **Secondary:** `surface` con borde; hover `surface-2`. **Ghost:** texto `muted`, hover `surface-2`. **Danger:** `danger` con texto `bg`.
- **Comportamiento:** transición de 140 ms con `ease-out`; al pulsar `scale(0.97)`; deshabilitado a 50 % de opacidad. Con movimiento reducido no hay escala.

### Cards / Containers
Radio 12 px, borde de 1 px, `p-4`/`sm:p-5`. Tonos: `default` (superficie), `raised` (con sombra card) y `accent` (borde `primary/30` sobre `primary-soft`).

### Badge
Píldora `text-xs font-medium`. `primary` usa `primary-soft` con `primary-text`; `neutral`, `success`, `warning` y `danger` van sobre `surface-2` y solo cambian el color del texto. El estado se lee por la palabra (en gastos: pendiente `warning`, aprobado `success`, rechazado `danger`, anulado `neutral`).

### Inputs / Fields
`Field`, `SelectField` y `TextareaField` comparten cáscara: label visible `text-sm font-medium`, control de `min-h-11`, borde `border`, fondo `surface`, radio 8 px. La textarea añade `min-h-24`. Error: borde `danger`, `aria-invalid` y mensaje `text-danger` enlazado con `aria-describedby`; la ayuda (`muted`) se muestra solo si no hay error. Foco por el anillo global de 2 px. Los formularios usan react-hook-form con zod y validan al enviar (`noValidate`).

### Navigation
Barra inferior móvil (5 columnas, `text-xs`, ícono 20 px): el activo va en `primary-text` con una marca de 2 px en `primary-solid` sobre el borde superior. Sidebar en `lg`: ítems de `rounded-lg`, activo con `primary-soft` y `primary-text`, inactivo `muted`. Enlace "Saltar al contenido" al inicio. Cabecera con marca (móvil), `NotificationBell`, `ThemeToggle` y `UserMenu`.

### UserMenu
Menú de 18 rem, `pop-in` de 160 ms desde arriba a la derecha, `shadow-pop`. El foco entra al primer ítem, flechas/Inicio/Fin navegan, Esc cierra y devuelve el foco, Tab cierra. Contiene el cambio rápido de socio (modo de pruebas) y, solo cuando el navegador ofrece la instalación, el ítem "Instalar la app" (ícono `Download`, `lib/install.ts`); en iOS, que no lanza ese evento, el ítem no aparece.

### Sheet (hoja modal)
`<dialog>` nativo con `showModal()`: atrapa el foco, cierra con Esc o al tocar el fondo y devuelve el foco. En móvil se ancla abajo, a todo el ancho, con esquinas superiores de 16 px y alto máximo de 92 dvh; desde `sm` se centra con `max-w-lg` y 16 px en todas las esquinas. Cabecera con título `text-lg font-semibold`, descripción `muted` y botón "Cerrar" de 44 px, separada del cuerpo por un borde; el cuerpo desplaza y respeta el área segura inferior. Fondo `black/50`, `shadow-pop`. Entra con `sheet-up` (260 ms, sube 24 px, `--ease-drawer`) en móvil y `sheet-in` (200 ms, escala 0.97, `--ease-out`) desde `sm`; con movimiento reducido solo hace fundido. Las variantes con formulario o confirmación (`ReasonSheet`, comprobante, cierre de sprint) reutilizan esta misma hoja.

### ReasonSheet (hoja con motivo obligatorio)
Una `Sheet` con un solo campo: `TextareaField` "Motivo" (o la etiqueta que se le pase, p. ej. "Qué no cuadra"), descripción `muted` encima y dos botones abajo, "Cancelar" (secundario) y el de confirmar. El motivo es obligatorio (react-hook-form + zod, mínimo 3 caracteres, mensaje "Escribe el motivo (al menos 3 caracteres)", validado al enviar). Con la variante `danger` el botón de confirmar se pinta con `Button` `danger`; sin ella usa `primary`. En móvil los botones se apilan con el de confirmar al pie (`flex-col-reverse`); desde `sm` van en fila a la derecha. Se usa para anular horas y gastos ("Anular gasto", danger) y para objetar un registro de horas ("Enviar objeción", primario, porque no destruye nada).

### Chips de filtro
Píldoras de `min-h-11` con `px-4`, `text-sm font-medium` y cifra en `.num`, expuestas como botones con `aria-pressed`. Activa: borde `primary`, fondo `primary-soft`, texto `primary-text`. Inactiva: borde `border`, fondo `surface`, texto `muted`. Ejemplo: "Todos" y "Por votar · n". El conteo va dentro de la etiqueta.

### Gastos (ExpensesPage y ExpenseCard)
Encabezado con "Registrar gasto" (primario, ícono `Plus`). Dos secciones con título `text-sm font-semibold muted`: "Gastos recurrentes" (rejilla `sm:grid-cols-2` de `Card` por defecto, ícono `CalendarClock` en `primary-text`, monto en `.num font-bold`, "Renueva el dd/mm/yyyy · cada año/mes") y "Gastos" con los chips de filtro y una rejilla `md:grid-cols-2` de `ExpenseCard`. El `Badge` de renovación cambia de tono según los días que faltan: 7 o menos `warning`, 30 o menos `primary`, más `neutral`; el texto lo dice siempre ("Renueva en N días", "Renueva hoy", "Vencido"). Un gasto previo a la firma añade el badge "Previo a la firma: no suma puntos".

La `ExpenseCard` es una `Card` `raised`: concepto (`text-base font-semibold`, tachado y `muted` si está anulado), línea de apoyo con quién pagó, fecha y categoría, y el monto en `.num text-lg font-bold`. Debajo, `Badge` de estado (pendiente `warning`, aprobado `success`, rechazado `danger`, anulado `neutral`), más "Previo a la firma" y "Reembolsado" en neutro. Si está aprobado, una línea `muted` dice en palabras cuántos puntos da ("Suma N puntos a Nombre.") o por qué no ("No suma puntos (previo a la firma / fue reembolsado / solo cuentan los gastos en soles)"). Si está pendiente, un bloque `surface-2` con la frase "n de 3 votos a favor" (y "· n en contra" si hay), un `Meter` fino (`h-2`) con esa escala y dos botones de 44 px en dos columnas, "A favor" y "En contra", con `aria-pressed`; el voto propio pinta su botón (A favor en `primary`, En contra en `danger`), siempre con la palabra y el ícono de pulgar. Al pie, "Ver comprobante" (abre el comprobante en una `Sheet`) y "Anular" (abre el `ReasonSheet`, solo el dueño y mientras no esté anulado ni reembolsado), ambos fantasma `sm`.

### ExpenseFormSheet
`Sheet` "Registrar gasto" con monto y moneda en una rejilla (`1fr` y `7rem`), concepto, categoría, comprobante y la casilla "Es previo a la firma del acuerdo (no suma puntos)" de `min-h-11` con casilla de 20 px. Al escribir un monto que necesita votos aparece un aviso `role="status"` sobre `primary-soft` con `primary-text` ("Supera S/ 50.00: quedará pendiente hasta tener 3 votos a favor", o el equivalente para dólares). El comprobante es una zona de borde discontinuo de `min-h-11` ("Tomar o elegir una foto"; la imagen se comprime con `lib/image.ts`), que tras elegir la foto muestra una vista previa de 64 px con "Foto lista para adjuntar" y un botón para quitarla; su error va en `text-danger`.

### Cierre de sprint (SprintClosePage)
Ruta `/proyectos/:projectId/cierre`, con enlace "Tablero" de 44 px arriba; se llega desde el botón secundario "Cierre de sprint" (ícono `Flag`) del encabezado del tablero. Tres bloques con título `text-sm font-semibold muted`, en orden:
- **Comprometido y entregado:** una `Card` sin relleno con una fila por socio (avatar, nombre, "n de m tareas" en `.num`), un `Meter` fino de horas entregadas frente a estimadas y una línea `text-xs muted` con estimadas, registradas y validadas.
- **Horas por validar:** una `Card` sin relleno por socio (nunca el propio) con cabecera "Validar las N" (secundario `sm`) y filas con casilla de 20 px dentro de una etiqueta de `min-h-11`, tarea, fecha y horas en `.num`, más "Objetar" (fantasma `sm`, abre el `ReasonSheet`). Con casillas marcadas aparece "Validar N seleccionadas" (primario `sm`) junto al título. Sin pendientes, un `EmptyState`.
- **Cerrar el sprint:** `Card` de tono `accent` que dice en palabras cuántos registros quedan sin validar y que sin validar no suman puntos. Solo el admin ve el botón "Cerrar sprint"; los demás leen que el cierre lo hace el product owner. El botón abre una `Sheet` de confirmación que explica que las horas validadas se bloquean y que el proyecto queda sin sprint activo; ahí "Cerrar sprint" es primario, no `danger`.

### Para ti ahora (Inicio)
`Card` de tono `accent` sin relleno, a todo el ancho de la rejilla de Inicio (`lg:col-span-2`) y primera en aparecer; solo existe si hay pendientes. Título `text-base font-semibold` y una lista de filas-enlace de `min-h-12` con la frase completa ("Tienes 2 gastos por votar", "Hay N registros de horas por validar en Proyecto") y un chevron en `primary-text`; el hover (`primary-soft`) es el de la fila. Las filas llevan a `/gastos` y a la página de cierre del proyecto.

### NotificationBell y NotificationList
Campana en la cabecera: botón fantasma de 44 px (`h-11 w-11`) con ícono `Bell` de 20 px. Con avisos sin leer suma una insignia numérica en `primary-solid` con `primary-fg`, `.num`, `text-xs font-bold` (muestra "9+" a partir de 10) y el `aria-label` dice la cuenta ("Notificaciones, 3 sin leer"); la insignia es decorativa. Al tocarla abre una `Sheet` "Notificaciones" con los 8 más recientes, "Ver todas" (enlace `primary-text` de 44 px a `/notificaciones`) y, si hay pendientes, "Marcar todas como leídas" (secundario `sm`). Sin avisos dice "No tienes avisos por ahora."

La `NotificationList` es una lista con `divide-border`; cada aviso es un botón de ancho completo (`min-h-14`, hover `surface-2`) que lo marca como leído y lleva a la pantalla que lo resuelve. Sin leer: punto de 10 px en `primary`, título `font-semibold` y prefijo `sr-only` "No leída: "; leído: punto transparente y título en `muted`. Debajo, detalle `muted` (2 líneas) y fecha en `.num text-xs`. La página `/notificaciones` (`NotificationsPage`) pone la misma lista en una `Card`, con "Marcar todas como leídas" en el encabezado y `EmptyState` "Todo al día". `notificationText.ts` traduce cada tipo (mención, voto de gasto, resultado de gasto, daily pendiente, horas faltantes, renovación, reunión) a un título en español llano, un detalle opcional y su destino (`/equipo?tab=daily`, `/equipo?tab=reunion`, `/gastos`, `/horas`, la tarea o el proyecto).

### MentionTextarea, MentionText y CommentThread
`MentionTextarea` comparte la cáscara de `TextareaField` (label visible, `min-h-24`, radio 8 px, error `danger`, ayuda "Escribe @ para mencionar a alguien del equipo.") pero con semántica de combobox. Al escribir `@` ofrece debajo píldoras `@Nombre` de `min-h-11` (`rounded-full`, `text-sm font-medium`); la activa va con borde `primary`, fondo `primary-soft` y texto `primary-text`, las demás con `border` y `surface`. Flechas recorren, Enter o Tab eligen, Esc cierra; con toque se elige la píldora sin quitar el foco de la textarea. `MentionText` resalta solo las menciones que corresponden a un socio real, con `font-semibold text-primary-text`; el resto queda como texto.

`CommentThread` es una lista de comentarios (avatar `sm`, nombre de pila en `font-semibold`, fecha en `.num text-xs muted`, texto `text-sm` con saltos de línea) seguida de un compositor con `MentionTextarea` "Comentar" y botón "Comentar" a la derecha. Vive dentro de la `Sheet` de edición de tarea. Estado vacío en una línea: "Aún no hay comentarios."

### Equipo (TeamPage)
Ruta `/equipo` con `PageHeader` y un `tablist` de tres pestañas (Daily, Anuncios, Reunión) en una pista `surface-2` de `rounded-xl` con `p-1` y `grid-cols-3` (`sm:max-w-md`). Cada pestaña mide `min-h-11`; la activa va en `surface` con `shadow-card` y `font-semibold`, las demás en `muted`. Flechas izquierda y derecha cambian de pestaña. La pestaña vive en la URL (`?tab=daily|anuncios|reunion`) para que los avisos lleven directo a ella. El panel es un `tabpanel` enlazado a la pestaña.

- **Daily:** `Card` `raised` "Tu daily de hoy" con tres campos ("¿Qué hiciste?", "¿Qué harás?" y "¿Qué te bloquea?", este último con `MentionTextarea`), un botón secundario `sm` "Autocompletar con mis tareas" bajo el primero y "Enviar daily" / "Actualizar daily" a la derecha. Si falta alguien, una línea `muted` dice "Aún sin daily hoy: Rober, Diego y José." Debajo, "Últimos daily del equipo" agrupado por día: encabezado `text-sm font-semibold` y una `Card` sin relleno con una fila por socio (nombre `font-semibold` y una lista de definición `dt`/`dd` en rejilla de 4.5 rem: Hizo, Hará, Bloqueos; los bloqueos pasan por `MentionText`).
- **Anuncios:** `Card` `raised` con el compositor "Nuevo anuncio" y "Publicar"; debajo, una `Card` por anuncio con autor y fecha (`.num`) en `text-xs muted`. El anuncio fijado lleva un `Badge` `primary` con ícono `Pin` y la palabra "Fijado". Solo el admin ve el botón fantasma `sm` "Fijar arriba" / "Quitar fijado".
- **Reunión:** sin convocatoria, un `EmptyState` (el admin ve "Convocar reunión"; los demás leen que el product owner propondrá horarios). En votación, una `Card` por horario con el horario en `.num text-base font-semibold`, el `Badge` `primary` "Más disponibilidad" (y borde `primary`) en el que más socios pueden, una frase con la cuenta y los nombres ("2 de 4 pueden: Rober, Diego. No pueden: José."), y dos botones de 44 px en dos columnas, "Puedo" y "No puedo", con `aria-pressed` (el elegido pasa a primario, siempre con la palabra). Sobre las tarjetas, una línea `muted` con quién no ha respondido. El admin ve el botón fantasma `sm` "Confirmar este horario", que abre una `Sheet` "Confirmar horario" con el enlace de Meet (`Field` `type="url"`) y "Confirmar reunión". Confirmada, una `Card` de tono `accent` con `Badge` "Confirmada" (o "Realizada", `success`), el horario en `.num text-lg font-bold`, el enlace "Abrir Meet" (`rounded-lg`, `primary-solid`, `min-h-11`, íconos `Video` y `ExternalLink`) y, para el admin, "Marcar asistencia" (secundario), que abre una `Sheet` "Asistencia" con casillas de 20 px en filas de `min-h-11`. Cierra con "Reuniones anteriores" (`Card` sin relleno, una fila por semana con "Asistieron: … Faltaron: …") y, si alguien faltó a las últimas 2, una nota factual `text-sm muted` ("Rober faltó a las últimas 2 reuniones. Según el acuerdo, dos ausencias seguidas cuentan como incumplimiento."), sin `danger` ni ícono.

### Toaster
Sonner con los tokens del proyecto (`surface`, `fg`, `border`, `shadow-pop`, fuente sans; la acción usa `primary-solid`). Aparece arriba al centro con desplazamiento de 72 px para no chocar con la `TimerBar` ni la barra inferior.

### TimerBar y TimerChip (firma: temporizador)
En móvil, la `TimerBar` aparece solo con un temporizador abierto: barra fija con `primary-solid` y `primary-fg`, `rounded-2xl`, `shadow-pop`, a 4.25 rem sobre el borde inferior más el área segura, es decir, justo encima de la navegación. Muestra el tiempo transcurrido en `.num` `text-2xl font-bold` (`role="timer"`), el título de la tarea truncado y un botón "Detener" de 48 px con relleno `primary-fg` y texto `primary-solid`. En `lg` desaparece y el `TimerChip` ocupa la cabecera: píldora con borde, tiempo, tarea truncada y botón "Detener" `sm`. Ambos entran con `.enter`; el estado se dice con la palabra "Detener" y el ícono de cuadrado.

### TaskCard
Tarjeta de 12 px con borde, `p-3.5` y `shadow-card`; con el temporizador de esa tarea corriendo el borde pasa a `primary`. Título como botón de 44 px que abre el detalle; debajo, avatar pequeño con nombre de pila o "Sin responsable", estimación en `.num` y enlace en `primary-text`. Al pie, un selector "Mover a" de 44 px (etiqueta solo para lectores) y, si la tarea es tuya, "Iniciar" (secundario) o "Detener" (primario) de 44 px. En escritorio suma un asa de arrastre de 44 px de alto con ícono de agarre.

### KanbanBoard
Cuatro estados fijos (por hacer, en curso, en revisión, hecho).
- **Escritorio (`lg`):** una columna por estado sobre `surface-2/50` con borde, título `text-sm font-semibold` y conteo `.num`; al pasar una tarjeta por encima la columna toma borde `primary` y fondo `primary-soft`. Las columnas vacías dicen "Suelta aquí una tarea". Arrastre con @dnd-kit: el puntero arranca tras 6 px y solo el asa arrastra; con teclado, Espacio toma la tarjeta, las flechas izquierda y derecha saltan de columna y Espacio suelta; Esc cancela. Los anuncios para lectores están en español ("Tomaste «…»", "Soltaste «…» en …"). La tarjeta original baja a 40 % de opacidad mientras se arrastra.
- **Móvil:** sin arrastre. Un `tablist` de cuatro pestañas de `min-h-12` sobre `surface-2` con nombre del estado y conteo `.num`; la activa va en `surface` con `shadow-card`, las demás en `muted`. Muestra una columna a la vez (en curso si tiene tareas) y las flechas cambian de pestaña. El cambio de estado se hace con el selector "Mover a" de cada tarjeta. El estado vacío usa borde discontinuo.

### Registro de horas (TimePage)
Navegador de semana con dos botones secundarios de 44 px y el rango en `.num` ("Esta semana · dd/mm/yyyy al dd/mm/yyyy"; no se puede avanzar más allá de la semana actual). Una `Card` con el total en `.num text-2xl font-bold` dentro de la frase "de N comprometidas" y un `Meter` con el compromiso semanal como umbral. Debajo, una tarjeta sin relleno por día (encabezado `text-sm font-semibold muted`, filas separadas por `divide-border`); cada fila muestra tarea, proyecto, badges y horas en `.num`. Badges: "En curso" (`primary`), "Validada" (`success`), "Pagada" (`neutral`) y "Anulada" (`danger`, con la tarea tachada y "Motivo: …" debajo). Editar (lápiz) y anular (círculo tachado) son botones fantasma de 44 px con `aria-label`, visibles solo mientras el registro es editable.

### Meter (medidor con mínimo)
Pista de `surface-2` con anillo `segment`, relleno `primary` revelado con `clip-path` en 500 ms, y una marca vertical de 3 px en `fg` en el umbral. Usa `role="meter"` con `aria-valuetext`. La escala deja 25 % de holgura sobre el mínimo. El relleno no cambia de color al no cumplir; el estado va en texto ("faltan 6 h").

### SegmentedBar (firma: reparto de participación)
Barra de 20 px con segmentos proporcionales separados por 4 px (mínimo 2.75 rem y 2 % del total). El segmento propio va en `primary`; los demás en `segment`. Debajo, cada segmento se nombra con nombre corto y porcentaje `.num`. Se revela de izquierda a derecha con `clip-path`.

### CountUp
Cifra que cuenta hasta su valor en 500 ms con curva exponencial de salida; expone el valor final a lectores de pantalla desde el inicio. Con movimiento reducido muestra el valor final.

### Avatar, Skeleton, Spinner, EmptyState, ErrorState, PageHeader
Avatar circular de iniciales en Plus Jakarta (`primary-soft` / `primary-text`; 32, 40 o 56 px). Skeleton de `surface-2` con pulso. `EmptyState`: borde discontinuo, ícono en círculo `primary-soft`, título, descripción y acción. `PageHeader`: `h1` `text-2xl font-bold` con descripción `muted` y acciones a la derecha.

### Motion
- **Curva:** `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`; `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`.
- **`.enter`:** 360 ms, sube 10 px y aparece; retardo `--i × 60 ms` (`stagger(n)`). **`.pop-in`:** 160 ms, escala de 0.96.
- **Datos:** `Meter` y `SegmentedBar` se revelan con `clip-path` en 500 ms; `useFirstPlay` los anima solo la primera vez por sesión.
- **Hoja:** `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` para la subida de la `Sheet` en móvil; `backdrop-in` de 200 ms para el fondo.
- **Movimiento reducido:** se conserva la opacidad (200 ms) y se elimina el desplazamiento, la escala y los recorridos.

## Do's and Don'ts

### Do:
- **Do** usar tokens (`bg-primary-solid`, `text-primary-text`, `bg-surface`, `text-muted`), nunca colores fijos.
- **Do** acompañar todo estado con texto ("cumple el mínimo", "faltan 6 h"); el color solo refuerza.
- **Do** mostrar a quien está por debajo del mínimo mensual con el mismo tono neutro y verde que a los demás, con la cifra que falta; el sistema no castiga con rojo.
- **Do** poner `.num` en toda cifra de dato y escribirla dentro de una frase.
- **Do** mantener objetivos táctiles de 44 px, respetar áreas seguras y usar `dvh`.
- **Do** animar solo la primera vez por sesión (`useFirstPlay`), con `ease-out` y solo `opacity`, `transform` o `clip-path`.
- **Do** hacer los formularios con react-hook-form y zod, con `Field`/`SelectField`/`TextareaField` (label visible, ayuda y error enlazados) dentro de una `Sheet`.
- **Do** ofrecer "anular con motivo" en lugar de borrar: la acción destructiva usa `Button` `danger`, explica que el registro queda en el historial y pide el motivo.
- **Do** pedir siempre un motivo en las acciones destructivas o de rechazo (anular horas o gastos, objetar un registro) con el `ReasonSheet`; el motivo queda visible en el historial ("Motivo: …").
- **Do** mostrar un rechazo o un estado de pocas horas con texto además del color: "En contra", "Rechazado", "faltan 6 h"; el color de peligro nunca es la única señal.
- **Do** decir con palabras los puntos de un gasto ("Suma N puntos a Nombre." o el motivo por el que no suma) y los votos ("n de 3 votos a favor"), en vez de solo íconos o colores.
- **Do** mantener el orden del equipo en el reparto (no el de tu fila) y llevar tu propia fila primero en las listas del equipo, para que cada persona conserve su lugar.
- **Do** mostrar el trabajo pendiente en Inicio como filas tocables de `min-h-12` dentro de "Para ti ahora", con la frase completa y un chevron, no como insignias numéricas en la navegación.
- **Do** dejar la `TimerBar` móvil encima de la navegación inferior y añadir relleno inferior extra a la página (`pb-44`) mientras corra un temporizador.
- **Do** dar a cada acción de arrastre una alternativa sin arrastre: el selector "Mover a" en móvil y el teclado en escritorio.
- **Do** dar el mismo ancho proporcional a cada segmento y nombrarlo debajo.
- **Do** redactar notificaciones y recordatorios con palabras llanas ("Hay un gasto que necesita tu voto", "Tu daily de hoy está pendiente") y llevarlos a la pantalla que los resuelve (`/gastos`, `/equipo?tab=daily`, `/equipo?tab=reunion`, `/horas`).
- **Do** confirmar cada mención con una píldora `@Nombre` visible y resaltar las válidas con `font-semibold text-primary-text`.
- **Do** guardar la pestaña activa de Equipo en la URL (`?tab=`) y marcar el voto de la reunión con `aria-pressed` y la palabra ("Puedo", "No puedo").

### Don't:
- **Don't** usar `primary` (#548d7b) para texto ni para fondo de texto blanco en modo claro; usa `primary-text` o `primary-solid`.
- **Don't** usar rojo, ámbar o verde de estado como único indicador ni para señalar a una persona por su cumplimiento.
- **Don't** animar acciones frecuentes o de teclado (abrir con teclado, cambio de tema, temporizador, arrastre con teclado), ni animar `width`, `height` o `top`.
- **Don't** añadir sombras a tarjetas en modo oscuro.
- **Don't** repetir la animación de datos en cada visita a una pantalla de uso diario.
- **Don't** borrar registros ni ofrecer una acción de eliminar; se anulan con motivo.
- **Don't** usar `danger` como relleno de una acción de cierre o de validación: cerrar el sprint y validar horas son primarios; `danger` queda para anular y para el voto "En contra" ya elegido.
- **Don't** ofrecer una acción destructiva sin pedir motivo, ni mostrar el botón de cerrar sprint a quien no es admin.
- **Don't** indicar pendientes con puntos o números sueltos en la navegación; van en "Para ti ahora".
- **Don't** mostrar avisos abajo en móvil: el `Toaster` va arriba para no tapar la `TimerBar`.
- **Don't** dejar una cifra sin `.num` en una lista o columna.
- **Don't** marcar un aviso sin leer solo con color o punto: lleva título en `font-semibold` y prefijo `sr-only` "No leída".
- **Don't** pintar en `danger` la ausencia a reuniones: la nota es factual, en `muted`, con nombres y la regla del acuerdo.
- **Don't** ocultar una mención ni insertarla sin que se vea la píldora `@Nombre` elegida.

