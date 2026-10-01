# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Los 4 socios de VEXA (Jhony Rivera, admin y product owner; Rober Vasquez, líder técnico; José Gónzales, comercial; Diego Choque, diseño y marketing). Trabajan por horas comprometidas a la semana (15 a 25 h) y no comparten oficina: coordinan de forma asíncrona.

Situación de uso más frecuente: el celular, en segundos, entre otras tareas (iniciar o detener el temporizador, registrar horas, votar un gasto, responder el daily). El escritorio se usa para planificar sprints, revisar el tablero y el dashboard. En el futuro habrá colaboradores con acceso limitado (fase 3); hoy no son usuarios.

Trabajo esperado: registrar el trabajo en menos de 30 s, ver el propio cumplimiento del mes y saber cuánta participación se lleva cada socio sin hacer cuentas.

## Product Purpose

Vexa Studio es la plataforma interna única de VEXA. Reemplaza el Excel, los documentos sueltos, Discord y GitHub Projects (para tareas): sprints y kanban, registro de horas con temporizador, gastos con aprobación, daily asíncrono, comentarios, anuncios, convocatoria de la reunión semanal y dashboard de cumplimiento, puntos y participación.

Éxito: 4 de 4 socios registran horas cada semana, el cumplimiento mensual se ve sin cálculos manuales, el 100 % de los registros tiene historial y validación en el cierre de sprint, y ninguna herramienta externa se usa para tareas, horas, gastos ni avisos.

## Positioning

Vexa Studio convierte el trabajo diario de 4 socios (horas, gastos, sprints) en un equity dinámico calculado solo, sin Excel ni herramientas sueltas. El cálculo sale de las reglas del acuerdo de socios; ninguna herramienta genérica de tareas lo hace.

## Operating Context

- Documentos fuente: `docs/PRD.md` (fuente de verdad del alcance) y `docs/acuerdo-socios.md`.
- Zona horaria del negocio: `America/Lima` (UTC-5); cortes de semana y mes en hora de Lima.
- Ritmo: sprints de 2 semanas, cierre de sprint con validación de horas entre socios, daily lunes, miércoles y viernes a las 9:00 p. m., reunión semanal sin día fijo convocada por el product owner con enlace de Google Meet.
- Los repositorios siguen en GitHub; la plataforma solo reemplaza el tablero de tareas.
- Uso al aire libre y con poca luz es un escenario real que la interfaz debe soportar.

## Capabilities and Constraints

- Etapa actual: solo frontend con datos simulados (capa de servicios `mock` sobre `localStorage`); Supabase (Auth, Postgres, RLS, Storage, Realtime) llega en la etapa 2. Web Push también es etapa 2; en la etapa 1 las notificaciones son solo in-app.
- Reglas de negocio: 20 puntos por hora no pagada y validada; 2 puntos por S/ 1 de gasto aprobado, no reembolsado y no previo a la firma; mínimo mensual = horas/semana × 4 × 80 %; gasto mayor a S/ 50 pendiente hasta 3 votos a favor; un solo temporizador abierto por usuario; nadie borra, se anula con motivo; edición de un registro propio hasta 7 días o hasta su validación.
- Roles: admin, socio y colaborador (fase 3). El admin administra configuración y ejecuta lo votado; no tiene poder sobre los datos de otros.
- Idioma de la interfaz: español (Perú). Montos `S/ 1,234.50`, fechas `dd/mm/yyyy`.
- Sin registro público: acceso por invitación.
- Fuera de alcance: chat en tiempo real y videollamadas.
- Stack (ya en el repositorio): React, Vite, TypeScript strict, Tailwind CSS 4, React Router, TanStack Query, PWA, Vercel.

## Brand Commitments

- Nombre: VEXA Studio (VEXA es la marca del equipo).
- Logo: `public/vexa-mark.svg` (V reconocible con luz hielo sobre grafito), también favicon.
- El sistema visual vigente está documentado en `DESIGN.md`; PRODUCT.md solo guarda los compromisos de marca.
- La identidad visual adopta Observatorio, aprobado por el product owner: cristal ahumado, grafito, luz hielo, Sora e IBM Plex Sans locales. La demo independiente se conserva en `/observatorio/` sin reemplazar los servicios ni las reglas del producto principal.

## Evidence on Hand

- `docs/PRD.md` y `docs/acuerdo-socios.md`.
- Seed simulado con los 4 socios, 3 proyectos (Vexa Studio, Fivuza, Vantage) y datos de ejemplo en `src/services/mock/seed.ts`.
- No hay testimonios, clientes, métricas de uso ni datos reales de horas o gastos todavía; no se deben inventar.

## Product Principles

1. Registrar cuesta segundos: cada flujo diario se resuelve en una o dos pantallas y funciona con una mano en el celular.
2. Las reglas del acuerdo se aplican solas; el usuario ve el resultado (cumplimiento, puntos, participación), no la fórmula.
3. La confianza viene del historial: nadie borra, todo se anula con motivo y lo validado queda bloqueado.
4. Una sola plataforma para el trabajo del equipo; lo que ya existe gratis (chat, videollamada) no se reconstruye.
5. Se crece por bloques y se recorta alcance antes de estirar plazos.

## Accessibility & Inclusion

- Contraste suficiente (AA), foco visible y labels en formularios.
- Legible al aire libre y con poca luz: modo claro y modo oscuro cómodos en ambos extremos.
- Interfaz completa en español (Perú).
