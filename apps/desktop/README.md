# VEXA desktop

Directorio reservado para la futura aplicación con React + Tauri. Todavía no contiene una aplicación ejecutable ni participa en los comandos de build.

Al implementarla:

1. Crear aquí su `package.json` privado y su interfaz propia.
2. Consumir `@vexa/domain` y `@vexa/services` mediante dependencias de workspace (`"*"`).
3. Implementar almacenamiento, sesión, notificaciones y permisos según la plataforma. No importar archivos de `apps/web` ni copiar su mock como backend compartido.
4. Compartir recursos/componentes mediante paquetes solo cuando exista compatibilidad real. React Native requiere componentes propios.
5. Definir build, firma, distribución y actualizaciones independientes.

Ver [arquitectura](../../docs/arquitectura.md) y [propuesta multiplataforma](../../docs/propuesta-multiplataforma.md).
