# @vexa/domain

Código independiente de interfaz y almacenamiento. Importar por módulo, por ejemplo `import { timerElapsed } from "@vexa/domain/timer"`.

Incluye tipos, reglas, fechas/formatos del negocio, actividad mensual, prioridad de tareas y validación de foco. No depende de React, Vite, DOM ni localStorage. Las dependencias de fechas son explícitas y sus pruebas viven junto al código.

Se consume como TypeScript fuente dentro del workspace; cada aplicación lo transpila. No es un paquete publicado ni un backend que aplique permisos. Ver [arquitectura](../../docs/arquitectura.md).
