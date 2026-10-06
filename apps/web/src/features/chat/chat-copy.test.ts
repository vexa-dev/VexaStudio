import { describe, expect, it } from "vitest";
import { attachmentCopy, chatCopy } from "./chat-copy";

describe("chat source copy", () => {
  it("does not describe persisted actions or presence as demo data", () => {
    expect(chatCopy.send).toBe("Enviar mensaje");
    expect(chatCopy.presence(true)).toBe("En línea");
    expect(chatCopy.presence(false)).toBe("Sin conexión");
    expect(chatCopy.deleteGroup).toBe("¿Eliminar este grupo y sus mensajes?");
  });
});

describe("attachment lifecycle copy", () => {
  it("asks the agreed question with the two agreed choices", () => {
    expect(attachmentCopy.question).toBe(
      "¿Debe quedarse este archivo en el chat?",
    );
    expect(attachmentCopy.keep).toBe("Conservar");
    expect(attachmentCopy.release).toBe("Liberar espacio");
    expect(attachmentCopy.answeredKeep).toBe("Pediste conservarlo");
    expect(attachmentCopy.answeredRelease).toBe("Liberaste el espacio");
    expect(attachmentCopy.purged).toBe(
      "Archivo eliminado para liberar espacio",
    );
  });
});
