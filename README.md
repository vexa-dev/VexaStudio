# VEXA Studio

Interfaz del espacio de trabajo del equipo, con datos simulados y temas claro/oscuro.
Usa los logos oficiales, paleta grafito/blanco hielo con acento azul acero, superficies de cristal, fondo lineal sutil, navegación líquida y la mascota robot v3.

## Desarrollo

Requiere Node.js 22.12 o superior y npm.

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

```powershell
npm run lint
npm test
npm run build
npm run preview
```

## Vistas

- Inicio: tareas por atender, gastos pendientes, proyectos activos, horas personales, participación y avance compacto del equipo.
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

## Diseño y acceso

El sistema vigente se documenta en `DESIGN.md` y los compromisos de producto en `PRODUCT.md`.
Solo se conserva la imagen activa de mascota en `public/mascot/robot-concept-v3.png`.
Para explorar la aplicación, entra desde uno de los cuatro perfiles de demo.
El formulario de correo/contraseña y recuperación muestra avisos de conexión pendiente.

Horas incluye registro sin tarea (actividad, proyecto y respaldo), temporizador, historial con filtros, resumen mensual con gráficos en Lima y revisión por otro socio. Las correcciones reabren la revisión y se auditan. El historial previo permanece intacto; sus entradas sin horario fiable se excluyen del gráfico horario. Todo funciona en los servicios mock y localStorage.
