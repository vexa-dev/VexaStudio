import { describe, expect, it } from "vitest";
import type { Profile } from "@vexa/domain/types";
import {
  canOpenThread,
  changeMessage,
  deleteGroup,
  directThread,
  emptyChatStore,
  reactToMessage,
  saveGroup,
  sendMessage,
} from "./chat-store";
const admin: Profile = {
  id: "admin",
  name: "Admin",
  role: "admin",
  area: "technical",
  weeklyHours: 15,
  active: true,
};
const member: Profile = { ...admin, id: "member", role: "collaborator" };
const outsider: Profile = { ...member, id: "outsider" };
describe("permisos del chat local", () => {
  it("solo administradores gestionan grupos", () => {
    const store = emptyChatStore();
    const input = { name: "Equipo", description: "", members: [member.id] };
    expect(() => saveGroup(store, member, input)).toThrow();
    const id = saveGroup(store, admin, input);
    expect(() => saveGroup(store, member, { ...input, id })).toThrow();
    expect(() => deleteGroup(store, member, id)).toThrow();
    deleteGroup(store, admin, id);
    expect(store.threads).toHaveLength(0);
  });
  it("bloquea grupos no asignados y revoca acceso al quitar integrantes", () => {
    const store = emptyChatStore();
    const id = saveGroup(store, admin, {
      name: "Equipo",
      description: "",
      members: [member.id],
    });
    const thread = store.threads[0];
    expect(canOpenThread(thread, member)).toBe(true);
    expect(canOpenThread(thread, outsider)).toBe(false);
    sendMessage(store, member, id, { text: "Hola" });
    expect(() => sendMessage(store, outsider, id, { text: "Hola" })).toThrow();
    expect(() =>
      reactToMessage(store, outsider, id, thread.messages[0].id, "👍"),
    ).toThrow();
    saveGroup(store, admin, {
      id,
      name: "Equipo",
      description: "",
      members: [outsider.id],
    });
    expect(canOpenThread(thread, member)).toBe(false);
    expect(() => sendMessage(store, member, id, { text: "Ya salí" })).toThrow();
  });
  it("permite mensajes directos privados y reutiliza la conversación", () => {
    const store = emptyChatStore();
    const id = directThread(store, member, outsider.id);
    expect(directThread(store, outsider, member.id)).toBe(id);
    expect(store.threads).toHaveLength(1);
    expect(canOpenThread(store.threads[0], admin)).toBe(false);
    sendMessage(store, member, id, { text: "Hola" });
    expect(() => sendMessage(store, admin, id, { text: "Hola" })).toThrow();
  });
  it("permite moderación pero impide editar mensajes ajenos", () => {
    const store = emptyChatStore();
    const id = saveGroup(store, admin, {
      name: "Equipo",
      description: "",
      members: [member.id],
    });
    sendMessage(store, member, id, {
      text: "Original",
      attachment: {
        name: "foto.png",
        type: "image/png",
        data: "data:image/png;base64,x",
      },
    });
    const message = store.threads[0].messages[0];
    expect(() =>
      changeMessage(store, admin, id, message.id, "Editado"),
    ).toThrow();
    changeMessage(store, member, id, message.id, "Editado");
    expect(message.text).toBe("Editado");
    reactToMessage(store, admin, id, message.id, "👍");
    changeMessage(store, admin, id, message.id, null);
    expect(message.deleted).toBe(true);
    expect(message.attachment).toBeUndefined();
    expect(message.reactions).toEqual({});
    expect(() => reactToMessage(store, member, id, message.id, "👍")).toThrow();
  });
  it("valida respuestas y texto y admite adjuntos y reacciones", () => {
    const store = emptyChatStore();
    const id = directThread(store, member, outsider.id);
    expect(() => sendMessage(store, member, id, { text: " " })).toThrow();
    expect(() =>
      sendMessage(store, member, id, { text: "x".repeat(4001) }),
    ).toThrow();
    expect(() =>
      sendMessage(store, member, id, { text: "Hola", replyTo: "missing" }),
    ).toThrow();
    sendMessage(store, member, id, { text: "Hola 👋" });
    const original = store.threads[0].messages[0];
    sendMessage(store, outsider, id, {
      text: "Respuesta",
      replyTo: original.id,
    });
    expect(store.threads[0].messages[1].replyTo).toBe(original.id);
    reactToMessage(store, outsider, id, original.id, "👍");
    reactToMessage(store, outsider, id, original.id, "👍");
    expect(original.reactions).toEqual({});
    sendMessage(store, member, id, {
      text: "",
      attachment: {
        name: "nota.txt",
        type: "text/plain",
        data: "data:text/plain;base64,eA==",
      },
    });
    expect(store.threads[0].messages).toHaveLength(3);
  });
});
