# Vexa Studio

Plataforma interna de VEXA (4 socios): tablero de sprints y tareas, registro de horas con temporizador, gastos con aprobación, comunicación asíncrona (daily, comentarios, anuncios), convocatoria de reunión semanal y dashboard de cumplimiento, puntos y participación (equity dinámico).

**Fuente de verdad:** `docs/PRD.md`. Ante cualquier duda de alcance o reglas, léelo antes de implementar. Si algo no está en el PRD, pregunta; no lo inventes.

## Etapa actual: solo frontend (datos simulados)

- Se construye **todo el frontend primero**, con datos simulados. Supabase se integra después (etapa 2 del PRD).
- **No** instalar `@supabase/supabase-js`, no crear migraciones SQL ni carpeta `supabase/` en esta etapa.
- Las pantallas **nunca** importan datos simulados directamente: siempre pasan por la capa de servicios (ver "Capa de datos"). Así, en la etapa 2 solo se agrega la implementación de Supabase sin tocar la UI.

## Stack

- React + Vite + TypeScript (strict) + Tailwind CSS 4 + React Router. Tailwind se integra con `@tailwindcss/vite` (sin `tailwind.config`); los colores viven como tokens en `src/index.css`.
- Iconos: lucide-react. Alias de imports: `@/` apunta a `src/`.
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
npm run typecheck    # tsc -b --noEmit
npm run test         # Vitest (una pasada)
npm run test:watch   # Vitest en modo watch
npm run preview      # sirve el build de producción
```

Antes de dar una tarea por terminada: `npm run typecheck && npm run lint && npm run test && npm run build` sin errores.

## Estructura

```
docs/                       PRD.md, acuerdo-socios.md
src/
  app/                      router, layout (sidebar/bottom-nav), providers
  features/<modulo>/        auth, projects, tasks, time, expenses, dashboard,
                            daily, comments, announcements, meetings, notifications
                            (cada uno: components/, hooks/, pages/)
  components/ui/            componentes reutilizables sin lógica de negocio
                            (Button, Card, Field/SelectField/TextareaField, Badge, Avatar, Meter, SegmentedBar,
                            CountUp, Sheet, ReasonSheet, Toaster…)
  domain/
    types.ts                tipos del dominio (reflejan el modelo de datos del PRD)
    rules.ts                funciones puras: puntos, participación, cumplimiento,
                            aprobación de gastos, ventana de edición (con tests)
  services/
    types.ts                interfaces de cada servicio (TaskService, TimeService…)
    index.ts                elige la implementación según VITE_DATA_SOURCE
    mock/                   implementación simulada + seed.ts
    supabase/               (vacío hasta la etapa 2)
  lib/                      dates.ts (helpers America/Lima), format.ts (montos y cifras), labels.ts,
                            utils.ts, useFirstPlay.ts y useReducedMotion.ts (política de movimiento)
public/                     vexa-mark.svg (logo y favicon) e íconos PWA
vercel.json                 rewrite de la SPA y caché de /assets
PRODUCT.md, DESIGN.md       contexto de producto y sistema visual (los usa Impeccable)
```

## Capa de datos

- Cada módulo tiene una interfaz en `services/types.ts` con métodos asíncronos (devuelven `Promise`), como si hablaran con una API real.
- `services/mock/` implementa esas interfaces con datos en memoria, persistidos en `localStorage` para que sobrevivan al recargar, y con un pequeño retraso artificial (150–300 ms) para probar estados de carga.
- `services/index.ts` exporta la implementación según `VITE_DATA_SOURCE` (`mock` por defecto; `supabase` en la etapa 2).
- Estado del mock: implementados Auth, Settings, Members, Projects, Dashboard (resumen mensual y puntos, con `domain/rules.ts`) y, en `mock/work.ts`, Sprints (listar, activo, crear), Tasks (listar, crear, editar, mover) y Time (temporizador único, registro manual, editar, anular con motivo), con permisos y `auditLog`. Con F3 también están Expenses (crear, votar con `resolveExpenseStatus`, anular con motivo, recurrentes), la validación de horas ajenas (`TimeService.validate`), `SprintService.getReview`/`close` (solo el admin cierra) y Comments (listar y agregar; las @menciones llegan en F4). Los helpers compartidos (`currentUser`, `currentAdmin`, `audit`, `newId`) están en `mock/context.ts`. Con F4 se completan Daily (un daily por persona y día, "autocompletar" con las horas desde el último), Announcements (el admin fija), Meetings (convocatoria, disponibilidad, confirmación con Meet, asistencia e historial) y Notifications: los avisos por eventos (menciones, votos, resultado de gastos, reunión) se guardan en `db.notifications` con `notify()`, y los recordatorios programados (daily lun/mié/vie 9 p. m., horas el domingo 8 p. m., renovaciones a 30 y 7 días, convocatoria sin responder) se materializan al pedir la bandeja en `mock/notifications.ts` con ids fijos. Ya no queda ningún servicio sin implementar en el mock; `notImplemented` y `pending` quedan como utilidades para futuros servicios.
- Los hooks de `features/*/hooks` usan TanStack Query sobre los servicios. Los componentes solo usan hooks.
- Los cálculos de equity y cumplimiento viven en `domain/rules.ts`. El mock los usa para generar el resumen; en la etapa 2 el cálculo pasa a vistas SQL y el frontend solo lo lee, con el mismo tipo de resultado.
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
- Login simulado: pantalla para elegir uno de los 4 socios (sin contraseña). Debe haber una forma rápida de cambiar de usuario para probar permisos.

## Reglas de negocio (resumen del PRD)

- Puntos: 20 por hora no pagada y validada; 2 por S/ 1 de gasto aprobado, no reembolsado y no previo a la firma.
- Participación = puntos del socio / puntos totales.
- Mínimo mensual = horas_semana × 4 × 0.8. Cumple si horas del mes (Lima) ≥ mínimo, descontando ausencias justificadas.
- Gasto > S/ 50: pendiente hasta 3 votos a favor. ≤ S/ 50: aprobado automáticamente.
- Un solo temporizador abierto por usuario: iniciar uno detiene el anterior.
- Cada usuario crea y edita solo sus propios registros; edición permitida 7 días o hasta que se validen. Nadie borra: se anula con motivo.
- Horas validadas en el cierre de sprint quedan bloqueadas.
- Reunión semanal sin día fijo: el PO propone 2–3 horarios, los socios marcan disponibilidad, el PO confirma (con enlace de Meet) y marca asistencia.
- Notificaciones: en esta etapa solo in-app. Web Push llega en la etapa 2.

## UI

- Mobile first: todo debe funcionar bien en un celular. Navegación inferior en móvil, sidebar en escritorio.
- Textos de la UI en español (Perú). Montos en soles con formato `S/ 1,234.50`; fechas `dd/mm/yyyy`.
- Modo claro y oscuro. Estados de carga, vacío y error en toda pantalla con datos.
- Accesible: labels en formularios, foco visible, contraste suficiente.
- Identidad visual tomada de vexa.space: verde de marca `#548d7b`, fondo oscuro `#0a0a0a`, superficie `#1a1a1a`; fuentes Inter (texto) y Plus Jakarta Sans (títulos), autoalojadas con `@fontsource-variable` para que la PWA funcione sin conexión. El modo claro es una derivación con variantes que cumplen contraste AA. Usa los tokens (`bg-primary-solid`, `text-primary-text`, `bg-surface`, `text-muted`, `shadow-card`…), no colores fijos. El detalle del sistema está en `DESIGN.md`; el contexto de producto, en `PRODUCT.md`.
- Cifras de datos (horas, puntos, %, montos) con la clase `.num` (tabulares, sin saltos al animar). El estado nunca depende solo del color: siempre va acompañado de texto.
- Componentes de datos ya disponibles en `components/ui/`: `Meter` (progreso con marca de umbral), `SegmentedBar` (reparto entre personas), `CountUp` (cifra que cuenta), `Card` (tonos `default`, `raised`, `accent`). `Sheet` es la hoja modal para formularios y confirmaciones, y `ReasonSheet` la que pide un motivo por escrito (anular, objetar) (abajo en el celular, centrada en escritorio) y `Toaster` (Sonner) muestra los avisos con `toast.success`/`toast.error`. Las @menciones se extraen con `domain/mentions.ts` (`extractMentions`, ignora tildes y mayúsculas) y se escriben con `MentionTextarea`. Reutilízalos antes de crear otros.
- Movimiento: solo `transform`, `opacity` y `clip-path`; curva `--ease-out`; entradas escalonadas de 60 ms con `.enter` y `stagger(i)`. Las animaciones de datos (barras, contadores) se reproducen solo la primera vez por sesión (`useFirstPlay`). Nada de animación en acciones frecuentes o de teclado. Con `prefers-reduced-motion` se conserva el cambio de estado (opacidad) y se quita el desplazamiento.
- Nativo en móvil: objetivos táctiles de 44 px, `dvh`, áreas seguras, `touch-action: manipulation`, sin resaltado de toque; los estilos `hover` solo con puntero fino.
- Formularios con react-hook-form + zod (esquemas junto a cada módulo en `schemas.ts`); campos con `Field`, `SelectField` o `TextareaField`. Las mutaciones de cada módulo viven en `hooks/` y muestran su aviso de éxito o error con Sonner. Cada pantalla se carga de forma diferida (`lazy` en `App.tsx`).
- Temporizador: la barra móvil (`TimerBar`) va sobre la navegación inferior y el chip (`TimerChip`) en el encabezado de escritorio; ambos solo aparecen con un temporizador activo. Nadie borra registros: se anulan con motivo.
- Tras cualquier cambio de UI, el hook de Impeccable revisa el archivo; el detector completo se corre con `.claude/skills/impeccable/scripts/impeccable detect src` y debe devolver `[]`.

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
