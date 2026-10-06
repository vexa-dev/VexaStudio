/** Neutral action copy works for both persisted chat and the separate mock preview. */
export const chatCopy = {
  send: "Enviar mensaje",
  presence: (online: boolean) => (online ? "En línea" : "Sin conexión"),
  deleteGroup: "¿Eliminar este grupo y sus mensajes?",
};

/** Keep-or-release question shown under a file once every member downloaded it. */
export const attachmentCopy = {
  question: "¿Debe quedarse este archivo en el chat?",
  keep: "Conservar",
  release: "Liberar espacio",
  answeredKeep: "Pediste conservarlo",
  answeredRelease: "Liberaste el espacio",
  purged: "Archivo eliminado para liberar espacio",
  keptToast: "Listo: el archivo se conserva en el chat.",
  releasedToast: "Listo: pediste liberar el espacio de este archivo.",
};
