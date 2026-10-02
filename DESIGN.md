---
name: VEXA Studio
description: Observatorio de cristal ahumado y luz hielo para el trabajo del estudio.
colors:
  bg-dark: "#0b1210"
  text-dark: "#eef4f0"
  muted-dark: "#a0b6aa"
  surface-dark: "#14211b"
  raised-dark: "#1b2d24"
  glass-dark: "rgba(22, 31, 44, 0.72)"
  line-dark: "rgba(172, 200, 232, 0.12)"
  accent-dark: "#a2d6bc"
  accent-ink-dark: "#10242e"
  hover-dark: "#203041"
  input-dark: "#111924"
  bg-light: "#edf3ef"
  text-light: "#182f27"
  muted-light: "#536a60"
  surface-light: "#f7faf8"
  raised-light: "#e3ede7"
  glass-light: "rgba(249, 252, 255, 0.76)"
  line-light: "rgba(31, 65, 95, 0.14)"
  accent-light: "#28694f"
  accent-ink-light: "#fff"
  hover-light: "#dfeaf0"
  input-light: "#fff"
  done-dark: "#9fd2b9"
  done-light: "#276447"
  error-dark: "#efaaaa"
  error-light: "#a32929"
typography:
  display:
    fontFamily: "Sora Variable, sans-serif"
    fontSize: "clamp(28px, 3.3vw, 46px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Sora Variable, sans-serif"
    fontSize: "clamp(24px, 2.5vw, 35px)"
    fontWeight: 500
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Sora Variable, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    letterSpacing: "-0.03em"
  body:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  numeric:
    fontFamily: "Sora Variable, sans-serif"
    fontSize: "clamp(26px, 3vw, 42px)"
    fontWeight: 400
    letterSpacing: "-0.02em"
rounded:
  tag: "5px"
  field: "8px"
  button: "9px"
  navigation: "10px"
  surface: "14px"
  hero: "16px"
  shell: "18px"
spacing:
  control-gap: "8px"
  inline-gap: "10px"
  control-inset: "12px"
  row-gap: "15px"
  grid-gap: "20px"
  card-inset: "23px"
  section-inset: "24px"
  panel-inset: "30px"
components:
  button-primary:
    backgroundColor: "{colors.accent-dark}"
    textColor: "{colors.accent-ink-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "12px 17px"
  button-primary-light:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.accent-ink-light}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "12px 17px"
  button-secondary:
    backgroundColor: "{colors.raised-dark}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.button}"
    padding: "12px 17px"
  button-secondary-light:
    backgroundColor: "{colors.raised-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.button}"
    padding: "12px 17px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.muted-dark}"
    rounded: "{rounded.field}"
    size: "36px"
  field:
    backgroundColor: "{colors.input-dark}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.field}"
    padding: "12px"
  field-light:
    backgroundColor: "{colors.input-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.field}"
    padding: "12px"
  nav-link:
    textColor: "{colors.muted-dark}"
    rounded: "{rounded.navigation}"
    padding: "14px"
  category-tag:
    backgroundColor: "{colors.raised-dark}"
    rounded: "{rounded.tag}"
    padding: "5px 8px"
  project-card:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.surface}"
    padding: "23px"
---

# Design System: VEXA Studio

## Overview

**Creative North Star: "Observatorio"**

Observatorio es un estudio con perspectiva: grafito profundo, luz hielo y cristal ahumado enmarcan una V reconocible. La alternativa clara transforma el mismo vocabulario en superficies minerales, con tinta azul y acento petróleo.

Tras integrar `main`, el sistema se aplica a la aplicación de socios conservando sus componentes funcionales. `src/index.css` traduce sus tokens semánticos (`fg`, `primary-solid`, `primary-text`, `surface-2`) a Observatorio; la demo de `/observatorio/` usa los alias documentados aquí en `src/observatorio.css`, aislados mediante `@scope`. La aplicación principal conserva sus tamaños de controles, tablas y hojas; la escala que sigue describe los patrones de la demo. Ambos comparten Sora, IBM Plex Sans, tema y núcleo 3D.

El vidrio pertenece a la navegación, al panorama y al temporizador flotante. Listas, tablas y formularios mantienen superficies sólidas para leer y trabajar con estabilidad. Sora aporta carácter a títulos y números; IBM Plex Sans sostiene la interfaz compacta. El movimiento queda cerca del elemento que cambia y respeta la preferencia del sistema y el control manual.

**Key Characteristics:**
- Cristal ahumado con reflejos suaves, no bordes pesados.
- Superficies sólidas para el trabajo diario.
- Luz hielo y su traducción mineral clara.
- V geométrica, tipografía local y cifras tabulares.
- Movimiento local breve con alternativa estática.

## Colors

La paleta combina grafito, hielo y minerales azules; los tokens terminados en dark y light registran los dos temas reales. Las variables CSS sin sufijo son el enlace vivo entre tema y componente.

### Primary

- **Luz hielo / petróleo mineral:** accent-dark y accent-light marcan acciones principales, navegación activa, foco, progreso y la V de la marca. accent-ink conserva una tinta legible sobre cada acento.

### Neutral

- **Grafito / mineral:** bg es el fondo; surface sostiene áreas de trabajo; raised sostiene controles secundarios y etiquetas.
- **Cristal ahumado / cristal claro:** glass aporta transparencia solo en las superficies expresivas.
- **Tinta / bruma:** text sostiene información principal y muted información secundaria. line dibuja separaciones suaves; hover comunica respuesta; input conserva un fondo sólido.
- **Estados:** done usa verde contextual y error rojo contextual en ambos temas. No son acentos de marca adicionales.

### Named Rules

**The Theme Pair Rule.** Cada superficie funcional usa las variables semánticas del tema; el tema claro cambia también tinta, acento, campos, bordes y estados.

## Typography

**Display Font:** Sora Variable (sans-serif).
**Body Font:** IBM Plex Sans (sans-serif), pesos locales 400, 500 y 600.

**Character:** Títulos geométricos de peso moderado junto a una voz de lectura compacta y estable. Los títulos equilibran sus líneas y usan tracking negativo.

### Hierarchy

- **Display:** título expresivo del panorama, token display; en móvil pasa a (31px).
- **Headline:** título de página, token headline; en móvil pasa a (25px).
- **Title:** títulos de sección, token title; tarjetas de proyecto usan (19px), paneles (20px).
- **Body:** texto explicativo, token body. El panorama usa (12px, 1.75) y (11px) en móvil. El estado vacío limita el texto a (42ch).
- **Label:** controles principales y etiquetas de campos, token label. La navegación usa (13px); etiquetas de categoría y estados usan (10px). No convertir estos metadatos en encabezados decorativos.
- **Numeric:** reloj principal, token numeric; las métricas emplean Sora de peso (450) y cifras tabulares.

### Named Rules

**The Working Type Rule.** Sora se reserva a títulos, marca y cifras principales; IBM Plex Sans sostiene controles, filas y explicaciones.

## Layout

La navegación de escritorio flota a (20px) del borde, mide (220px) de ancho y deja el contenido con márgenes izquierdo (270px) y derecho (30px). El área de trabajo y la barra superior tienen máximo (1450px); la barra mide (85px) y el contenido comienza con (35px) de aire. La cuadrícula de proyectos usa tres columnas con separación (20px); el resumen combina columnas (1.5fr / 1fr) con separación (25px). No existe una escala universal de espaciado: los tokens registran pasos recurrentes observados.

A (1150px) la navegación mide (190px) y los proyectos pasan a dos columnas. A (850px) se reduce a un raíl de iconos de (76px) y el resumen pasa a una columna. A (640px) la navegación se fija abajo: altura (64px), inset (12px), cuatro destinos; contenido con margen (20px) y espacio inferior (90px). Proyectos pasa a una columna. El panorama móvil conserva acción y V mediante una composición propia, no una simple reducción. Las tablas mantienen ancho mínimo (610px), desplazamiento horizontal y aviso; el temporizador flotante se sitúa a (90px) del fondo. A partir de (1600px) aumentan los márgenes y la altura del panorama.

## Elevation & Depth

El sistema combina capas tonales sólidas con profundidad óptica en el vidrio. El cristal usa desenfoque (22px), saturación (125%) y reflejos interiores de un píxel. Las sombras son difusas y siguen el objeto; el claro reduce su densidad. El fondo añade dos halos radiales tenues.

### Shadow Vocabulary

- **Vidrio oscuro:** (0 18px 55px -20px rgba(0, 0, 0, 0.62)).
- **Vidrio claro:** (0 18px 55px -20px rgba(37, 69, 95, 0.22)).
- **Panel lateral:** (-15px 0 60px -20px rgba(0, 0, 0, 0.4)).
- **Acción primaria:** halo (0 5px 15px -8px rgba(95, 222, 244, 0.35)) y reflejo interior (inset 0 1px 0 rgba(255, 255, 255, 0.4)).
- **Tarjeta activa por hover:** (inset 0 1px 0 rgba(185, 227, 244, 0.35), 0 12px 28px -16px rgba(0, 0, 0, 0.5)).

### Named Rules

**The Material Boundary Rule.** Usa vidrio en la navegación, el panorama y el temporizador flotante; conserva superficies sólidas para listas, tablas y campos.

## Shapes

Esquinas suavizadas y diferenciadas por escala: campo, botón, navegación, superficie, panorama y shell usan los tokens de rounded. No hay un radio único aplicado a todo. Avatares de equipo e indicadores son circulares; la V se mantiene angulosa. Separadores funcionales de (1px), pistas de progreso de (4px) y órbitas elípticas finas conectan el lenguaje con el observatorio.

## Components

### Buttons

Acciones compactas, tranquilas y claras. Primaria en accent con accent-ink; secundaria en raised con text. Radio button, padding (12px 17px), gap (9px), altura mínima (42px). Hover primario mezcla el acento con blanco (15%); secundario usa hover. Los botones de icono tienen radio field y mínimo (36px). Deshabilitados reducen opacidad a (0.45). Foco visible global: contorno de acento (2px), separación (4px).

### Chips

La categoría es una etiqueta sólida en raised: radio tag, padding (5px 8px), tipo (10px). Los estados se expresan con punto circular (5px) y texto: muted pendiente, accent activo, done completado. No son botones de filtro.

### Cards / Containers

Superficie sólida con radio surface. Tarjetas de proyecto usan padding (23px) y reflejo interior fino; hover cambia a hover y añade la sombra de tarjeta. Las listas sostienen filas separadas por line; las tablas mantienen textos y números legibles dentro de una región horizontal desplazable.

### Inputs / Fields

Fondo input, texto text, borde line de (1px), radio field y padding (12px); tamaño (13px). Etiqueta visible asociada por id, error enlazado mediante aria-describedby y anuncio de alerta. Error de campo cambia el borde a (#db9292); el mensaje usa los tokens error por tema. Foco visible comparte el contorno global. Selectores usan altura mínima (40px).

### Navigation

Flotante y translúcida. Destinos con icono SVG y texto; activo usa accent, una base de gradiente hielo tenue y señal vertical. Hover usa hover y text; el indicador compartido cambia en (0.25s) cuando hay movimiento. El raíl intermedio conserva nombres accesibles; el dock móvil devuelve etiquetas visibles.

### Panel lateral

Dialog nativo sólido de ancho (min(540px, 100vw)) y altura (100dvh), borde izquierdo tenue y sombra difusa. Cabecera (27px 30px), cuerpo (30px); móvil usa (23px). Fondo modal (rgba(4, 10, 18, 0.55)) con blur (4px). Apertura local desde (30px) a la derecha durante (0.3s), easing (cubic-bezier(0.16, 1, 0.3, 1)); Escape cierra y devuelve foco.

### Cristal V y movimiento

V extruida real, profundidad (0.4), bisel (0.11), seis segmentos. Material físico hielo (#9dd5e8), transmisión (0.94), rugosidad (0.06), grosor (1.2), índice óptico (1.5) y clearcoat (1). Reflejos de entorno y luces frías sostienen su lectura. Oscilación suave y respuesta al puntero solo mientras el núcleo es visible. Entrada (0.8s) con el easing del panel. SVG estático conserva silueta y facetas si no hay efectos o falla WebGL.

Las páginas hacen una transición local de (0.2s), con desplazamiento de entrada (8px) y salida (-4px); progreso usa (0.3s), controles (0.15s). Preferencia manual apaga entradas y progreso; prefers-reduced-motion elimina animaciones y reduce transiciones a (0.01ms).

## Do's and Don'ts

### Do:

- **Do** usar las variables semánticas del tema para superficies, texto, bordes y controles.
- **Do** conservar sólidos los campos y las áreas de lectura prolongada.
- **Do** mantener foco visible y etiquetas asociadas a cada campo.
- **Do** usar cifras tabulares en tiempo, importes y métricas.
- **Do** respetar movimiento reducido y mantener disponible la V estática.
- **Do** reservar espacio final suficiente bajo la navegación móvil fija.

### Don't:

- **Don't** extender el vidrio a todas las filas o campos de trabajo.
- **Don't** sustituir la V reconocible por una ilustración genérica.
- **Don't** presentar los ejemplos locales como actividad real del equipo.
- **Don't** hacer que los efectos 3D bloqueen las acciones de la interfaz.

## Actualización de cristal VEXA

Logos oficiales: `vexa-fondo-blanco.svg` y `vexa-fondo-negro.svg`. Verde de marca: `#498974`. Las superficies usan cristal translúcido, bordes iluminados y esquinas de 18–26 px. El objeto 3D es una escultura abstracta, no un logo. Mi día contiene prioridades personales, foco 25/5 y borrador de daily local. Gastos y Equipo muestran los datos del seed como vistas de ejemplo. Se respetan las preferencias de movimiento reducido.

## Distribución compacta y paleta neutra

Desde 768 px se usa una distribución compacta: Mi día en tres columnas, tarjetas y portadas de menor altura, tareas por estado y registros de horas en columnas. El contenido puede seguir creciendo sin quedar recortado. La paleta base pasa a gris claro (#eef0f4) y grafito (#101115), con superficies #191b22 y reflejos plateados. El verde se reserva para la marca y acentos puntuales.


### Liquid space
La navegación de escritorio usa una superficie azul acero continua pegada al borde izquierdo, con un borde derecho ondulante y gotas que se desprenden y desaparecen,
iconos con etiquetas accesibles al foco y un indicador activo que conserva continuidad.
Las superficies transparentes revelan un fondo de luces móviles. Reflejos localizados
siguen el cursor y las tarjetas se inclinan suavemente. Una escultura de cristal WebGL
rota y flota en todas las vistas del espacio de trabajo. Se conserva la composición
compacta y se respeta la preferencia del sistema de reducir movimiento.


### Paleta unificada de marca
Fondo blanco (#ffffff) en modo claro y negro (#050505) en modo oscuro.
Verde oficial #498974 con variantes de contraste para controles y texto.
La barra líquida usa variables del tema: cristal blanco o negro con reflejos
verdes suaves, compartiendo colores con tarjetas, cabecera y navegación móvil.
Las superficies translúcidas conservan bordes luminosos, desenfoque y reflejos.

Las gotas del sidebar son figuras 2D de color plano, sin iluminación ni sombra.
Cada emisión elige otra altura, velocidad, tamaño y trayectoria ascendente o descendente;
se conserva la unión líquida al borde y la desaparición gradual.

La barra conserva su degradado horizontal original. Las gotas toman el tono
del punto de origen de ese degradado y se adaptan a sus reflejos al ondular
el borde, sin iluminación radial propia ni sombras que les den volumen 3D.


### Superficies tranquilas
Cards transparentes con desenfoque fijo, sin inclinación, brillo al cursor ni efecto de hover.
Fondo con contornos y trazos geométricos estáticos de bajo contraste.
Los objetos 3D se retiraron de la cabecera, Inicio y Observatorio.
Se conserva la navegación líquida con sus colores y velocidad aprobados.


Las cards tienen una base translúcida consistente y un desenfoque de 16 px.
La inclinación se limita a 0,65 grados por eje en dispositivos con ratón;
no hay reflejo que siga el cursor. Se desactiva con movimiento reducido.


### Retiro de la demo independiente
La demo Observatorio se eliminó, junto con sus rutas, navegación y archivos exclusivos.
Inicio conserva su banner de trabajo bajo el componente WorkspaceHero.
Las referencias anteriores a la demo describen la evolución histórica del diseño.


### Revisión con color-expert
Skill instalada desde https://github.com/meodai/skill.color-expert en `.agents/skills/color-expert`.
La referencia de marca continúa siendo #498974. `src/colors.css` define escalas OKLCH
con matiz derivado de esa referencia; `src/glass.css` asigna los roles de ambos temas.
Los botones principales usan variantes de contraste; éxito, advertencia y error
usan tonos y fondos propios. Los controles esenciales tienen bordes más distinguibles.
Los fondos negro/blanco, el difuminado y la inclinación mínima se conservan.

La comprobación de las ocho vistas en ambos modos revisó 482 muestras de texto,
componiendo los fondos CSS translúcidos. El menor contraste calculado fue 5,48:1,
sin pares por debajo de 4,5:1 en esa muestra. Esta comprobación no equivale a una
certificación de toda la interfaz: no evalúa cada estado, textura o composición posible.


### Paleta grafito y blanco hielo
Ambos temas usan ahora neutros fríos: fondo #08090B en oscuro y #F7F8FA en claro.
El acento de interfaz es azul acero #7B97AD, con variantes OKLCH para botones y texto.
Las superficies, sombras, sidebar y gotas comparten esta paleta; el logo conserva
su verde oficial #498974 y los estados de éxito mantienen su significado verde.
Se conservaron el glass de 16 px, la inclinación y los tamaños/frecuencia de gotas.
La auditoría de ocho vistas en ambos modos revisó 482 muestras de texto visible:
contraste mínimo calculado 5,26:1, sin fallos ni desbordamiento a 1366 × 768.
Compilación de producción verificada. Esta muestra no cubre todos los estados posibles.


### Cabeceras y jerarquía funcional
Inicio y Mi día usan una cabecera compacta: título, fecha y una sola frase secundaria
en el tono muted de cada tema, sin banners ni etiquetas decorativas repetidas.
Inicio muestra primero las horas personales, después participación y el equipo.
Los desgloses de puntos se consultan en «¿Cómo se calcula?».
En móvil, el equipo se presenta como filas de nombre, participación y progreso.
El menú hamburguesa se retiró; Equipo está en el menú del avatar móvil.
Revisadas ambas vistas a 320, 390, 768 y 1366 px en claro/oscuro: sin scroll horizontal;
a 768/1366 × 768, sin scroll de documento. Textos secundarios con contraste verificado.
