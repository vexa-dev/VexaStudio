# VEXA Studio

Interfaz del espacio de trabajo del equipo, con datos simulados y temas claro/oscuro.
Usa los logos oficiales, superficies de cristal, fondo lineal sutil y navegación líquida.

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

## Vistas

- Inicio: resumen mensual de horas, cumplimiento y participación.
- Mi día: prioridades, temporizador de foco y daily guardado en este navegador.
- Proyectos y tablero: organización de proyectos, sprints y tareas.
- Mis tareas y Horas: trabajo asignado, registros y temporizador global.
- Gastos y Equipo: vistas interactivas con datos de ejemplo.
- Perfil: información del socio que inició la sesión simulada.

## Arquitectura

React, TypeScript, React Router, Vite y Tailwind. Componentes compartidos en
`src/components/ui`, funcionalidades en `src/features` y servicios simulados en
`src/services/mock`. Las escalas de color de marca se definen en `src/colors.css`; los roles visuales y
los temas, en `src/glass.css`.
Los tokens de movimiento están en `src/lib/motion-tokens.ts`.

La configuración opcional de Supabase está en `src/lib/supabase.ts`; usa
`.env.local` con las variables públicas indicadas en `.env.example`.
La implementación actual trabaja con datos simulados; no hay despliegue realizado.
