# @vexa/services

Contratos TypeScript para autenticación, proyectos, tareas, horas y los demás módulos. Importar con `import type { Services } from "@vexa/services"`.

Solo depende de `@vexa/domain`. No crea clientes, sesiones, mocks ni conexiones. La aplicación web selecciona e implementa los servicios en `apps/web/src/services`.

Antes de conectar el backend hay que revisar autenticación real y operaciones pendientes; `signIn(userId)` y `listLoginProfiles` corresponden al acceso de demo actual. Las apps futuras no deben usarlos como diseño definitivo de autenticación. Ver [arquitectura](../../docs/arquitectura.md).
