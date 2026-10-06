/** Neutral action copy works for both persisted chat and the separate mock preview. */
export const chatCopy = {
  send: "Enviar mensaje",
  presence: (online: boolean) => (online ? "En línea" : "Sin conexión"),
  deleteGroup: "¿Eliminar este grupo y sus mensajes?",
};
