# Propuesta: VEXA en web, escritorio y móvil

**Fecha:** 3 de octubre de 2026

**Estado:** borrador para discusión.

**Alcance:** propuesta de evolución; la estructura base del repositorio fue autorizada el 03/10/2026 y se detalla en [arquitectura.md](./arquitectura.md). Las aplicaciones nativas y la integración del backend siguen siendo propuestas; no modifican el alcance vigente del [PRD](./PRD.md).

## 1. Qué queremos lograr

Ofrecer VEXA en el navegador, como programa de escritorio y como aplicación para Android e iOS. Cada versión puede tener pantallas y navegación propias, manteniendo las mismas cuentas, tareas, proyectos, horas y permisos.

La intención es adaptar la experiencia al dispositivo y compartir el trabajo que realmente es común. Una tarea creada en la web debe poder consultarse en el celular y actualizarse desde escritorio, siempre según los permisos del usuario.

Hoy tenemos un frontend React con datos simulados locales. La web publicada en Vercel y conectada a Supabase es el escenario futuro de esta propuesta, no el estado actual del proyecto. Empaquetar la aplicación no conecta ni sincroniza automáticamente esos datos locales.

## 2. Experiencias distintas para el mismo producto

| Versión | Tecnología propuesta | Experiencia a explorar |
| --- | --- | --- |
| Web | React + Vite, publicada en Vercel | Administración y consulta completa: proyectos, tareas, horas y módulos del estudio según el rol. |
| Escritorio | React + Tauri | Trabajo diario: tareas, temporizador, atajos, notificaciones y acceso desde un icono junto al reloj. |
| Móvil | React Native + Expo | Consulta y acciones rápidas: tareas asignadas, registro de horas, organización del día y avisos. |

Estas prioridades son propuestas para discutir. No implican eliminar funciones de ninguna versión ni ampliar el acceso de un colaborador.

El diseño conserva la identidad de VEXA —colores, tipografía, iconos y lenguaje visual—, pero la distribución de las pantallas puede cambiar. Por ejemplo, escritorio podría abrir un temporizador en una ventana pequeña mientras la web mantiene el panel completo.

Tauri permite construir un programa con una interfaz React propia. No exige que esa interfaz sea una copia de la web ni que abra el sitio de Vercel. Proponemos incluir la interfaz de escritorio en el instalador y conectarla al backend compartido.

## 3. Organización del código

Proponemos mantener inicialmente **un repositorio en GitHub con tres aplicaciones**. Esta organización se conoce como monorepo.

```text
VexaStudio/
├── apps/
│   ├── web/              Interfaz React para navegador
│   ├── desktop/          Interfaz React para escritorio + Tauri
│   └── mobile/           Interfaz React Native + Expo
├── packages/
│   ├── domain/           Tipos, cálculos y validaciones compartidas
│   ├── services/         Contratos y acceso a datos reutilizable
│   ├── design/           Tokens visuales y recursos de marca
│   └── ui-web/           Componentes React compatibles con web/escritorio
└── supabase/             Configuración y migraciones futuras del backend
```

La base ya está organizada con `apps/web`, `packages/domain` y `packages/services`. Escritorio y móvil tienen directorios reservados. `design`, `ui-web` y `supabase` se crearán cuando exista una implementación que los necesite; no están implementados en esta etapa.

### Qué compartiríamos

- Tipos de tareas, proyectos, perfiles y registros de horas.
- Cálculos, validaciones y reglas comunes del producto.
- Contratos de servicios y las implementaciones compatibles entre plataformas.
- Identidad visual, imágenes y recursos de la mascota.
- Componentes web que también sirvan en escritorio, como botones, cards y formularios.

### Qué tendría una implementación propia

- Pantallas y navegación de cada aplicación.
- Almacenamiento de sesiones y datos locales.
- Notificaciones, enlaces de acceso y permisos del dispositivo.
- Integraciones con ventanas, bandeja del sistema, cámara y archivos.
- Interacciones y animaciones que dependan del navegador o de herramientas nativas.

React Native no utiliza directamente nuestros componentes HTML y CSS. Podemos reproducir el diseño y reutilizar la lógica compatible, pero sus pantallas requieren adaptación. Compartir una regla no significa que una modificación visual llegue automáticamente a las tres aplicaciones.

Repositorios separados también son válidos si aparecen equipos, permisos de desarrollo o ciclos de mantenimiento independientes. En ese caso, habría que distribuir y versionar los paquetes compartidos para evitar copiar código y mantener reglas divergentes.

## 4. Un backend compartido

Las tres aplicaciones utilizarían el mismo backend de producción en Supabase, con cuentas, datos y archivos comunes. Vercel seguiría publicando la web; no sería necesario que el programa de escritorio o la app móvil pasaran por esa web para acceder a los servicios.

El backend debe aplicar los permisos y las operaciones críticas. Ocultar un botón o compartir una validación entre aplicaciones no reemplaza esa protección. Las credenciales privilegiadas del servidor no se incluyen en los instaladores ni en los clientes.

Cada dispositivo conserva su sesión: usar la misma cuenta no implica iniciar sesión automáticamente en todos ellos. Debemos configurar la autenticación, recuperación de acceso y enlaces de retorno según la plataforma.

Los cambios se reflejarían mediante consultas actualizadas y, donde aporte valor, suscripciones en tiempo real. Para desarrollo y pruebas utilizaríamos un entorno separado del de producción.

### Temporizador y trabajo sin conexión

El estado del temporizador debe ser común a todos los dispositivos, basado en inicio, pausas y finalización. El backend debe impedir que dos dispositivos creen sesiones activas incompatibles para el mismo usuario.

Hay que acordar qué ocurre al suspender o apagar la computadora, cerrar la aplicación o perder conexión. Propuesta inicial: recuperar el tiempo mediante fechas y pedir confirmación cuando exista un período dudoso; los detalles siguen pendientes.

El funcionamiento sin internet sería un alcance explícito. Requeriría una cola de operaciones pendientes, identificación para evitar duplicados y reglas para resolver cambios simultáneos. Una aplicación instalada no obtiene estas funciones automáticamente.

## 5. Cómo llegarían las actualizaciones

Cada aplicación tendría su propia versión y publicación, aunque el código viva en el mismo repositorio.

| Destino | Publicación propuesta | Qué recibe el usuario |
| --- | --- | --- |
| Web | Despliegue en Vercel | La nueva interfaz al cargar la versión publicada. Si hay caché PWA o una sesión abierta, debemos gestionar el aviso y la activación. |
| Escritorio | Instaladores y paquetes firmados, publicados en un servidor o repositorio de versiones | La aplicación comprueba si hay una versión nueva, la descarga y ofrece instalarla. |
| Android/iOS | Google Play/App Store, TestFlight durante pruebas o distribución directa de APK en Android | Una nueva versión instalada mediante el canal elegido. |
| Móvil: cambios compatibles | EAS Update, si adoptamos Expo y configuramos este mecanismo | Algunos cambios de JavaScript, estilos y recursos, compatibles con la versión instalada y las políticas de distribución. |

### Escritorio

Tauri dispone de un actualizador que verifica firmas. Debemos configurar la publicación de paquetes, la comprobación de versiones y la experiencia de instalación. La firma para el actualizador y la firma del programa para el sistema operativo son aspectos distintos que hay que preparar.

Propuesta de experiencia: mostrar «Hay una nueva versión» y ofrecer actualizar al salir o en un momento elegido. No interrumpir una sesión activa ni perder operaciones pendientes. Las claves de firma deben conservarse de forma segura para poder publicar versiones futuras.

### Móvil

EAS Update no reemplaza todas las actualizaciones de la tienda. Si cambiamos dependencias nativas, permisos o funcionalidades que requieren una nueva parte nativa, debemos generar otra versión instalada. Los cambios enviados directamente deben respetar la compatibilidad y las políticas de Apple y Google.

Si distribuimos Android mediante APK, hay que definir cómo avisar de una versión nueva y guiar su instalación; no se actualiza automáticamente por subir el archivo a GitHub. TestFlight sigue siendo un canal de pruebas y cada compilación tiene un plazo de hasta 90 días.

### Backend y versiones anteriores

Actualizar Supabase no actualiza las pantallas instaladas. Puede haber personas usando versiones anteriores de escritorio o móvil, por lo que los cambios de datos y servicios deben mantener compatibilidad durante la transición.

Proponemos probar las publicaciones en un canal interno antes de producción, conservar una estrategia de recuperación y definir cuándo una versión antigua dejaría de ser compatible.

## 6. Camino de implementación propuesto

La preparación inicial del repositorio ya está realizada: workspaces, dominio compartido y contratos separados. Las siguientes etapas continúan pendientes.

1. **Cerrar el flujo web y conectar el backend.** Confirmar permisos, autenticación y reglas de tareas/horas antes de multiplicar clientes.
2. **Validar escritorio con una pantalla piloto.** Probar Tauri con tareas y temporizador, definiendo las diferencias respecto a la web.
3. **Ampliar los paquetes compartidos según necesidades reales.** Extraer recursos y componentes compatibles al implementar otra interfaz, sin trasladar dependencias del navegador a móvil.
4. **Preparar una primera versión de escritorio.** Como opción inicial, Windows; probar instalación, suspensión, notificaciones y actualización.
5. **Validar móvil con React Native + Expo.** Construir una pantalla de tareas y comprobar navegación, gestos, sesión y registro de horas.
6. **Ampliar plataformas y funciones.** Incorporar macOS, distribución móvil y trabajo sin conexión según las necesidades del equipo.

Cada etapa requiere un alcance y validación propios. No se estiman plazos hasta definir las pantallas e integraciones de la primera versión.

## 7. Decisiones para discutir

| Decisión | Propuesta inicial | Pregunta pendiente |
| --- | --- | --- |
| Código | Un repositorio con aplicaciones separadas | ¿Todo lo mantiene el mismo equipo? |
| Escritorio | React + Tauri, empezando por Windows | ¿Necesitamos macOS o Linux desde el primer lanzamiento? |
| Móvil | React Native + Expo | ¿La experiencia móvil propia justifica adaptar las pantallas, o preferimos Capacitor para reutilizar más interfaz? |
| Pantallas | Diseño propio por plataforma, identidad común | ¿Qué tres acciones deben ser más rápidas en escritorio y móvil? |
| Cerrar escritorio | Posibilidad de mantenerlo en la bandeja durante una sesión | ¿Cerrar la ventana debe salir del programa o minimizarlo? |
| Temporizador | Estado compartido y recuperación por fechas | ¿Cómo tratamos suspensión, períodos largos y cambios de dispositivo? |
| Sin conexión | Alcance limitado por definir | ¿Solo consultar, o también modificar tareas y preparar horas? |
| Actualizaciones | Aviso y actualización en un momento seguro | ¿Qué cambios justificarían exigir una versión nueva? |
| Distribución | Pruebas internas antes de publicación | ¿Uso exclusivo del equipo o producto que se distribuirá a otras organizaciones? |

## 8. Referencias para profundizar

- [Tauri con Vite](https://tauri.app/start/frontend/vite/): integración con el frontend actual.
- [Actualizador de Tauri](https://tauri.app/plugin/updater/): publicación y verificación de actualizaciones.
- [Monorepos con Expo](https://docs.expo.dev/guides/monorepos/): aplicaciones y paquetes compartidos.
- [Supabase Auth con React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native): autenticación móvil.
- [EAS Update](https://docs.expo.dev/eas-update/introduction/): actualizaciones compatibles de la aplicación móvil.
- [Versiones de ejecución en Expo](https://docs.expo.dev/eas-update/runtime-versions/): compatibilidad entre actualizaciones y aplicaciones instaladas.
- [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/): distribución para pruebas en iOS.

Los requisitos de tiendas, firmas y herramientas deben verificarse nuevamente al implementar. Esta propuesta documenta la dirección discutida; las decisiones de la sección anterior siguen abiertas.
