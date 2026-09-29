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
