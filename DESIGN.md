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

Móvil primero, con un ancho mínimo de 320 px. El contenido va en `main` con `max-w-6xl`, padding de 16 px (`lg:px-8`) y `pb-28` en móvil para librar la barra inferior. Desde `lg` aparece un sidebar fijo de 15 rem (`w-60`) y el contenido se desplaza con `lg:pl-60`. La cabecera sticky mide 3.5 rem más el área segura superior; la barra inferior suma `env(safe-area-inset-bottom)`. Alturas de pantalla con `min-h-dvh`. El viewport usa `viewport-fit=cover` e `interactive-widget=resizes-content`; `theme-color` es #0a0a0a.

La navegación tiene 6 destinos; la barra inferior muestra 5 (`grid-cols-5`, todos menos Proyectos, que se alcanza por el menú de usuario) y el sidebar muestra los 6. Las rejillas de contenido son de una columna en móvil y pasan a `sm:grid-cols-2`, `lg:grid-cols-3` (proyectos) o `lg:grid-cols-[1.5fr_1fr]` (Inicio). Ritmo: `gap-4` entre tarjetas, `gap-5` dentro de la tarjeta principal, `p-4` que sube a `sm:p-5`. Tu propia fila va primero en las listas del equipo.

Objetivos táctiles de 44 px (`h-11`, `size-11`, `min-h-11`). Los botones `sm` también miden 44 px y solo se distinguen por el relleno horizontal.

## Elevation & Depth

Híbrido tonal. La profundidad viene de capas (`bg`, `surface`, `surface-2`) y bordes de 1 px. En claro, la tarjeta de tono `raised` añade una sombra mínima; en oscuro esa sombra es nula y el borde blanco translúcido hace el trabajo.

### Shadow Vocabulary
- **Card** (`--shadow-card`: `0 1px 2px rgb(15 23 42 / 0.06), 0 1px 1px rgb(15 23 42 / 0.04)`; nula en oscuro): solo `Card tone="raised"`.
- **Pop** (`--shadow-pop`: claro `0 12px 28px -10px rgb(15 23 42 / 0.28), 0 2px 6px rgb(15 23 42 / 0.08)`; oscuro `0 16px 36px -12px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.06)`): menús flotantes (`UserMenu`).

### Named Rules
**The Flat In Dark Rule.** En oscuro las tarjetas no llevan sombra; se separan por tono y borde.

## Shapes

Esquinas suaves y consistentes: 6 px en segmentos de barra (`rounded-md`), 8 px en botones y campos (`rounded-lg`), 12 px en tarjetas, menús y estados vacíos (`rounded-xl`), y forma de píldora (`rounded-full`) en badges, avatares, medidor y anillos. Bordes de 1 px en `border`; el estado vacío usa borde discontinuo. Los rellenos de barra se recortan con `clip-path` redondeado.

## Components

### Buttons
Cuatro variantes; altura 44 px en ambos tamaños (`md` con más relleno horizontal que `sm`), radio 8 px, `text-sm font-medium`, ícono y texto con `gap-2`.
- **Primary:** `primary-solid` con `primary-fg`; hover baja la opacidad a 0.9.
- **Secondary:** `surface` con borde; hover `surface-2`. **Ghost:** texto `muted`, hover `surface-2`. **Danger:** `danger` con texto `bg`.
- **Comportamiento:** transición de 140 ms con `ease-out`; al pulsar `scale(0.97)`; deshabilitado a 50 % de opacidad. Con movimiento reducido no hay escala.

### Cards / Containers
Radio 12 px, borde de 1 px, `p-4`/`sm:p-5`. Tonos: `default` (superficie), `raised` (con sombra card) y `accent` (borde `primary/30` sobre `primary-soft`).

### Badge
Píldora `text-xs font-medium`. `primary` usa `primary-soft` con `primary-text`; `neutral`, `success`, `warning` y `danger` van sobre `surface-2` y solo cambian el color del texto. El estado se lee por la palabra.

### Inputs / Fields
`Field`: label visible `text-sm font-medium`, input de 44 px, borde `border`, fondo `surface`, radio 8 px. Error: borde `danger` y mensaje `text-danger` enlazado con `aria-describedby`; ayuda en `muted`. Foco por el anillo global de 2 px.

### Navigation
Barra inferior móvil (5 columnas, `text-xs`, ícono 20 px): el activo va en `primary-text` con una marca de 2 px en `primary-solid` sobre el borde superior. Sidebar en `lg`: ítems de `rounded-lg`, activo con `primary-soft` y `primary-text`, inactivo `muted`. Enlace "Saltar al contenido" al inicio. Cabecera con marca (móvil), `ThemeToggle` y `UserMenu`.

### UserMenu
Menú de 18 rem, `pop-in` de 160 ms desde arriba a la derecha, `shadow-pop`. El foco entra al primer ítem, flechas/Inicio/Fin navegan, Esc cierra y devuelve el foco, Tab cierra. Contiene el cambio rápido de socio (modo de pruebas).

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
- **Movimiento reducido:** se conserva la opacidad (200 ms) y se elimina el desplazamiento, la escala y los recorridos.

## Do's and Don'ts

### Do:
- **Do** usar tokens (`bg-primary-solid`, `text-primary-text`, `bg-surface`, `text-muted`), nunca colores fijos.
- **Do** acompañar todo estado con texto ("cumple el mínimo", "faltan 6 h"); el color solo refuerza.
- **Do** mostrar a quien está por debajo del mínimo mensual con el mismo tono neutro y verde que a los demás, con la cifra que falta; el sistema no castiga con rojo.
- **Do** poner `.num` en toda cifra de dato y escribirla dentro de una frase.
- **Do** mantener objetivos táctiles de 44 px, respetar áreas seguras y usar `dvh`.
- **Do** animar solo la primera vez por sesión (`useFirstPlay`), con `ease-out` y solo `opacity`, `transform` o `clip-path`.
- **Do** dar el mismo ancho proporcional a cada segmento y nombrarlo debajo.

### Don't:
- **Don't** usar `primary` (#548d7b) para texto ni para fondo de texto blanco en modo claro; usa `primary-text` o `primary-solid`.
- **Don't** usar rojo, ámbar o verde de estado como único indicador ni para señalar a una persona por su cumplimiento.
- **Don't** animar acciones frecuentes o de teclado (abrir con teclado, cambio de tema, temporizador), ni animar `width`, `height` o `top`.
- **Don't** añadir sombras a tarjetas en modo oscuro.
- **Don't** repetir la animación de datos en cada visita a una pantalla de uso diario.
- **Don't** dejar una cifra sin `.num` en una lista o columna.

