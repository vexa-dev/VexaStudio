# VEXA Studio

Plataforma interna de trabajo para el equipo de VEXA. Este repositorio parte del MVP descrito en el PRD: proyectos y sprints, tareas, registro de horas, gastos, seguimiento de participación y comunicación asíncrona.

## Stack

- React, Vite y TypeScript
- Tailwind CSS
- React Router
- Supabase (Auth, Postgres, Storage y Realtime)
- PWA con `vite-plugin-pwa`
- Despliegue previsto en Vercel

## Requisitos

- Node.js 22.12 o superior
- npm

## Desarrollo local

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Completa `.env.local` con las credenciales del proyecto Supabase:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

No agregues secretos al repositorio. El archivo `.env.local` está excluido por Git.

## Comandos

```bash
npm run dev       # servidor local
npm run build     # compilación de producción
npm run preview   # vista previa de producción
npm run lint      # análisis estático
```

## Estructura inicial

```text
src/
  lib/supabase.ts  cliente opcional de Supabase
  App.tsx          navegación y estructura inicial
  index.css        estilos globales y diseño adaptable
  main.tsx         punto de entrada React y registro PWA
```

Las pantallas iniciales son una base visual y de navegación; los datos y flujos de negocio se implementarán por módulos conforme avance el MVP. El PRD contempla tres sprints de dos semanas. La autenticación será por invitación, y las reglas de acceso y cálculos de participación deben vivir en Postgres con RLS y vistas.
