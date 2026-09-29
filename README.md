# VEXA Studio

Plataforma interna de trabajo para el equipo de VEXA: sprints y tareas, registro de horas, gastos con aprobación, comunicación asíncrona y dashboard de cumplimiento y participación. La fuente de verdad del alcance es [`docs/PRD.md`](docs/PRD.md).

## Etapa actual

Solo frontend, con **datos simulados** (`VITE_DATA_SOURCE=mock`). Los datos se guardan en `localStorage` y se siembran con los 4 socios, 3 proyectos y un sprint activo. Supabase se integra en la etapa 2 del PRD.

## Stack

- React, Vite y TypeScript (strict)
- Tailwind CSS 4
- React Router, TanStack Query, react-hook-form + zod, @dnd-kit
- PWA con `vite-plugin-pwa`
- Vitest para las reglas de negocio, oxlint para el análisis estático
- Despliegue en Vercel (`vercel.json` reescribe todas las rutas a `index.html`)

## Requisitos

- Node.js 22.12 o superior
- npm

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # en PowerShell: Copy-Item .env.example .env.local
npm run dev
```

El archivo `.env.local` está excluido por Git. Con `VITE_DATA_SOURCE=mock` (valor por defecto) no necesitas credenciales.

En la pantalla de acceso eliges uno de los 4 socios, sin contraseña. Para probar permisos puedes cambiar de usuario desde el menú del avatar (arriba a la derecha).

Para volver a los datos iniciales, ejecuta en la consola del navegador:

```js
localStorage.removeItem('vexa-studio.mock.db'); location.reload()
```

## Comandos

```bash
npm run dev          # servidor local
npm run build        # compilación de producción
npm run preview      # vista previa de producción
npm run lint         # oxlint
npm run typecheck    # tsc -b --noEmit
npm run test         # Vitest
```

Antes de dar una tarea por terminada: `npm run typecheck && npm run lint && npm run test && npm run build`.

## Estructura

```text
src/
  app/          layout (sidebar y barra inferior), tema y menú de usuario
  features/     un módulo por dominio: auth, projects, tasks, time, expenses…
  components/ui componentes reutilizables sin lógica de negocio
  domain/       tipos y reglas de negocio puras (con tests)
  services/     interfaces de datos y su implementación simulada (mock/)
  lib/          fechas de Lima, formato de montos y utilidades
```

Las pantallas nunca importan datos simulados directamente: pasan por `src/services`. Más detalle de convenciones en [`CLAUDE.md`](CLAUDE.md).

## Documentos del proyecto

| Documento | Para qué sirve |
| --- | --- |
| [`docs/PRD.md`](docs/PRD.md) | Fuente de verdad del alcance y las reglas. |
| [`docs/acuerdo-socios.md`](docs/acuerdo-socios.md) | Acuerdo de socios del que salen las reglas de negocio. |
| [`CLAUDE.md`](CLAUDE.md) | Convenciones de código, capa de datos y cómo trabajar en el repo. |
| [`PRODUCT.md`](PRODUCT.md) | Contexto de producto: usuarios, propósito, restricciones y principios. |
| [`DESIGN.md`](DESIGN.md) | Sistema visual: colores, tipografía, componentes y movimiento. |

## Avance del frontend

- F1 Base: hecho (rutas, layout responsive, tema claro y oscuro, servicios simulados, login con los 4 socios, PWA).
- Sistema visual y pantalla de Inicio (reparto de participación y cumplimiento del mes): hecho.
- F2 Trabajo (kanban, temporizador y horas), F3 Control y F4 Equipo: pendientes.

## Herramientas de diseño

El repositorio incluye skills de diseño y código en `.claude/skills` (registro en `skills-lock.json`). El detector de Impeccable revisa la interfaz:

```bash
.claude/skills/impeccable/scripts/impeccable detect src   # debe devolver []
```
