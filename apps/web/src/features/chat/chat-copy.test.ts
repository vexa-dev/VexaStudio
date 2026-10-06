import { describe, expect, it } from "vitest";
import { chatCopy } from "./chat-copy";

describe("chat source copy", () => {
  it("does not describe persisted actions or presence as demo data", () => {
    expect(chatCopy.send).toBe("Enviar mensaje");
    expect(chatCopy.presence(true)).toBe("En línea");
    expect(chatCopy.presence(false)).toBe("Sin conexión");
    expect(chatCopy.deleteGroup).toBe("¿Eliminar este grupo y sus mensajes?");
  });
});
