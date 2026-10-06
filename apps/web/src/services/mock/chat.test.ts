import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatThread } from "@vexa/domain/chat";
import { CHAT_KEY } from "@/features/chat/chat-store";
import { activePresence } from "./chat";
import { resetMock, setSessionUserId } from "./db";
import { createMockServices } from "./index";

// The artificial latency is irrelevant to the rules under test.
vi.mock("./utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("./utils")>();
  return { ...original, delay: async <T>(value: T) => structuredClone(value) };
});

const JHONY = "u-jhony"; // admin
const ROBER = "u-rober";
const JOSE = "u-jose";
const DIEGO = "u-diego";

const { chat } = createMockServices();
const as = (id: string) => setSessionUserId(id);
const NO_ACCESS = "No tienes acceso a esta conversación.";
const photo = {
  name: "foto.png",
  type: "image/png",
  data: "data:image/png;base64,eA==",
};

let clock = 1_000_000;
const tick = (ms = 1000) => (clock += ms);

function installStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  });
  vi.stubGlobal("window", new EventTarget());
  return data;
}

let storage: Map<string, string>;
beforeEach(() => {
  storage = installStorage();
  resetMock();
  clock = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  as(JHONY);
});
afterEach(() => {
  chat.trackPresence(false);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function groupWith(...members: string[]) {
  as(JHONY);
  return chat.saveGroup({ name: "Equipo", description: "", members });
}
const thread = async (id: string) =>
  (await chat.listThreads()).find((entry) => entry.id === id) as ChatThread;

describe("regla 1: acceso", () => {
  it("un integrante abre su conversación y los demás no", async () => {
    as(ROBER);
    const id = await chat.directThread(JOSE);
    await chat.sendMessage(id, { text: "Hola" });
    as(JOSE);
    expect((await chat.listThreads()).map((t) => t.id)).toContain(id);
    as(DIEGO);
    expect(await chat.listThreads()).toHaveLength(0);
    await expect(chat.sendMessage(id, { text: "Hola" })).rejects.toThrow(
      NO_ACCESS,
    );
  });
  it("el admin no abre directos ajenos", async () => {
    as(ROBER);
    const id = await chat.directThread(JOSE);
    as(JHONY);
    expect(await chat.listThreads()).toHaveLength(0);
    await expect(chat.markRead(id)).rejects.toThrow(NO_ACCESS);
    await expect(chat.listSharedMessages(id)).rejects.toThrow(NO_ACCESS);
  });
  it("el admin abre cualquier grupo aunque no sea integrante", async () => {
    const store = {
      threads: [
        {
          id: "g1",
          kind: "group",
          name: "Sin admin",
          description: "",
          members: [ROBER, JOSE],
          messages: [],
          readAt: {},
        },
      ],
      settings: {},
    };
    storage.set(CHAT_KEY, JSON.stringify(store));
    as(JHONY);
    expect((await chat.listThreads()).map((t) => t.id)).toEqual(["g1"]);
    await chat.sendMessage("g1", { text: "Soy admin" });
    as(DIEGO);
    await expect(chat.sendMessage("g1", { text: "x" })).rejects.toThrow(
      NO_ACCESS,
    );
  });
  it("una conversación inexistente falla igual", async () => {
    await expect(chat.markRead("nope")).rejects.toThrow(NO_ACCESS);
  });
});

describe("regla 2: conversación directa", () => {
  it("rechaza vacío y a uno mismo", async () => {
    as(ROBER);
    await expect(chat.directThread("")).rejects.toThrow(
      "Selecciona a otra persona.",
    );
    await expect(chat.directThread(ROBER)).rejects.toThrow(
      "Selecciona a otra persona.",
    );
  });
  it("devuelve la misma conversación para la pareja", async () => {
    as(ROBER);
    const id = await chat.directThread(JOSE);
    expect(await chat.directThread(JOSE)).toBe(id);
    as(JOSE);
    expect(await chat.directThread(ROBER)).toBe(id);
    expect(await chat.listThreads()).toHaveLength(1);
  });
});

describe("regla 3: grupos", () => {
  it("solo el admin guarda y elimina", async () => {
    const input = { name: "Equipo", description: "", members: [ROBER] };
    as(ROBER);
    await expect(chat.saveGroup(input)).rejects.toThrow(
      "Solo los administradores pueden gestionar grupos.",
    );
    const id = await groupWith(ROBER);
    as(ROBER);
    await expect(chat.saveGroup({ ...input, id })).rejects.toThrow(
      "Solo los administradores pueden gestionar grupos.",
    );
    await expect(chat.deleteGroup(id)).rejects.toThrow(
      "Solo los administradores pueden gestionar grupos.",
    );
  });
  it("exige nombre tras recortar y al menos un integrante", async () => {
    await expect(
      chat.saveGroup({ name: "   ", description: "", members: [ROBER] }),
    ).rejects.toThrow("Escribe el nombre del grupo.");
    await expect(
      chat.saveGroup({ name: "Equipo", description: "", members: [] }),
    ).rejects.toThrow("Selecciona al menos un integrante.");
  });
  it("incluye al creador sin duplicados y recorta nombre y descripción", async () => {
    const id = await chat.saveGroup({
      name: "  Equipo  ",
      description: " Todos ",
      members: [ROBER, ROBER, JHONY],
    });
    const group = await thread(id);
    expect(group.members.sort()).toEqual([JHONY, ROBER].sort());
    expect(group.name).toBe("Equipo");
    expect(group.description).toBe("Todos");
  });
  it("solo edita y elimina grupos, no directos", async () => {
    as(ROBER);
    const direct = await chat.directThread(JHONY);
    as(JHONY);
    await expect(
      chat.saveGroup({
        id: direct,
        name: "X",
        description: "",
        members: [ROBER],
      }),
    ).rejects.toThrow("Esta conversación no es un grupo.");
    await expect(chat.deleteGroup(direct)).rejects.toThrow(
      "Solo se pueden eliminar grupos.",
    );
  });
  it("eliminar es real", async () => {
    const id = await groupWith(ROBER);
    await chat.deleteGroup(id);
    expect(await chat.listThreads()).toHaveLength(0);
    as(ROBER);
    expect(await chat.listThreads()).toHaveLength(0);
  });
  it("quitar a alguien le revoca el acceso", async () => {
    const id = await groupWith(ROBER);
    as(ROBER);
    await chat.sendMessage(id, { text: "Hola" });
    as(JHONY);
    await chat.saveGroup({
      id,
      name: "Equipo",
      description: "",
      members: [JOSE],
    });
    as(ROBER);
    await expect(chat.sendMessage(id, { text: "Ya salí" })).rejects.toThrow(
      NO_ACCESS,
    );
    expect(await chat.listThreads()).toHaveLength(0);
  });
});

describe("regla 4: enviar", () => {
  let id: string;
  beforeEach(async () => {
    as(ROBER);
    id = await chat.directThread(JOSE);
  });
  it("exige texto o adjunto", async () => {
    await expect(chat.sendMessage(id, { text: "  " })).rejects.toThrow(
      "Escribe un mensaje o adjunta un archivo.",
    );
    const sent = await chat.sendMessage(id, { text: "", attachment: photo });
    expect(sent.attachment).toEqual(photo);
  });
  it("admite 4000 caracteres sin recortar y rechaza 4001", async () => {
    await expect(
      chat.sendMessage(id, { text: "x".repeat(4001) }),
    ).rejects.toThrow("El mensaje puede tener hasta 4000 caracteres.");
    await expect(
      chat.sendMessage(id, { text: `${"x".repeat(3999)} ` }),
    ).resolves.toBeDefined();
    // The limit applies to the raw text: padding that trims away still counts.
    await expect(
      chat.sendMessage(id, { text: `${" ".repeat(10)}${"x".repeat(3995)}` }),
    ).rejects.toThrow("El mensaje puede tener hasta 4000 caracteres.");
  });
  it("la respuesta debe existir en la misma conversación", async () => {
    const first = await chat.sendMessage(id, { text: "Original" });
    const other = await chat.directThread(DIEGO);
    await expect(
      chat.sendMessage(other, { text: "Hola", replyTo: first.id }),
    ).rejects.toThrow("El mensaje original ya no está disponible.");
    await expect(
      chat.sendMessage(id, { text: "Hola", replyTo: "missing" }),
    ).rejects.toThrow("El mensaje original ya no está disponible.");
    const reply = await chat.sendMessage(id, { text: "Re", replyTo: first.id });
    expect(reply.replyTo).toBe(first.id);
  });
  it("guarda el texto recortado y actualiza la lectura del emisor", async () => {
    tick();
    const sent = await chat.sendMessage(id, { text: "  Hola  " });
    expect(sent.text).toBe("Hola");
    expect(sent.authorId).toBe(ROBER);
    expect(sent.sentAt).toBe(clock);
    const stored = await thread(id);
    expect(stored.messages.at(-1)?.text).toBe("Hola");
    expect(stored.readAt[ROBER]).toBe(clock);
  });
});

describe("regla 5: editar y anular", () => {
  let id: string;
  let messageId: string;
  beforeEach(async () => {
    id = await groupWith(ROBER, JOSE);
    as(ROBER);
    messageId = (
      await chat.sendMessage(id, { text: "Original", attachment: photo })
    ).id;
  });
  it("editar es solo del autor, recorta y marca editedAt", async () => {
    as(JHONY);
    await expect(chat.editMessage(id, messageId, "Editado")).rejects.toThrow(
      "Solo puedes editar o eliminar tus mensajes.",
    );
    as(ROBER);
    tick();
    await chat.editMessage(id, messageId, "  Editado  ");
    const edited = (await thread(id)).messages[0];
    expect(edited.text).toBe("Editado");
    expect(edited.editedAt).toBe(clock);
  });
  it("editar exige texto no vacío de hasta 4000 y no tiene ventana de tiempo", async () => {
    as(ROBER);
    await expect(chat.editMessage(id, messageId, "  ")).rejects.toThrow(
      "Escribe un mensaje de hasta 4000 caracteres.",
    );
    await expect(
      chat.editMessage(id, messageId, "x".repeat(4001)),
    ).rejects.toThrow("Escribe un mensaje de hasta 4000 caracteres.");
    tick(400 * 24 * 3600 * 1000);
    await expect(
      chat.editMessage(id, messageId, "Mucho después"),
    ).resolves.toBeUndefined();
  });
  it("anular es suave y el admin puede en un grupo", async () => {
    as(JOSE);
    await chat.reactToMessage(id, messageId, "👍");
    await expect(chat.deleteMessage(id, messageId)).rejects.toThrow(
      "Solo puedes editar o eliminar tus mensajes.",
    );
    as(JHONY);
    await chat.deleteMessage(id, messageId);
    const gone = (await thread(id)).messages[0];
    expect(gone.deleted).toBe(true);
    expect(gone.text).toBe("");
    expect(gone.attachment).toBeUndefined();
    expect(gone.reactions).toEqual({});
  });
  it("el admin no anula mensajes de un directo (ni lo ve)", async () => {
    as(ROBER);
    const direct = await chat.directThread(JOSE);
    const sent = await chat.sendMessage(direct, { text: "Privado" });
    as(JHONY);
    await expect(chat.deleteMessage(direct, sent.id)).rejects.toThrow(
      NO_ACCESS,
    );
  });
  it("no se toca un mensaje ya anulado", async () => {
    as(ROBER);
    await chat.deleteMessage(id, messageId);
    await expect(chat.deleteMessage(id, messageId)).rejects.toThrow(
      "El mensaje ya no está disponible.",
    );
    await expect(chat.editMessage(id, messageId, "x")).rejects.toThrow(
      "El mensaje ya no está disponible.",
    );
  });
});

describe("regla 6: reacciones", () => {
  let id: string;
  let messageId: string;
  beforeEach(async () => {
    id = await groupWith(ROBER, JOSE);
    as(ROBER);
    messageId = (await chat.sendMessage(id, { text: "Hola" })).id;
  });
  const reactions = async () => (await thread(id)).messages[0].reactions;
  it("un emoji por persona: repetir quita, otro reemplaza", async () => {
    await chat.reactToMessage(id, messageId, "👍");
    expect(await reactions()).toEqual({ [ROBER]: "👍" });
    await chat.reactToMessage(id, messageId, "❤️");
    expect(await reactions()).toEqual({ [ROBER]: "❤️" });
    await chat.reactToMessage(id, messageId, "❤️");
    expect(await reactions()).toEqual({});
  });
  it("cada persona reacciona por separado y no se reacciona a un mensaje anulado", async () => {
    await chat.reactToMessage(id, messageId, "👍");
    as(JOSE);
    await chat.reactToMessage(id, messageId, "👍");
    expect(await reactions()).toEqual({ [ROBER]: "👍", [JOSE]: "👍" });
    as(ROBER);
    await chat.deleteMessage(id, messageId);
    await expect(chat.reactToMessage(id, messageId, "👍")).rejects.toThrow(
      "El mensaje ya no está disponible.",
    );
  });
  it("quien no tiene acceso no reacciona", async () => {
    as(DIEGO);
    await expect(chat.reactToMessage(id, messageId, "👍")).rejects.toThrow(
      NO_ACCESS,
    );
  });
});

describe("regla 7: lectura", () => {
  it("abrir la conversación actualiza mi lectura y los demás ven el visto", async () => {
    as(ROBER);
    const id = await chat.directThread(JOSE);
    tick();
    await chat.sendMessage(id, { text: "Uno" });
    const sentAt = clock;
    as(JOSE);
    expect((await thread(id)).readAt[JOSE]).toBeUndefined();
    tick();
    await chat.markRead(id);
    const read = await thread(id);
    expect(read.readAt[JOSE]).toBe(clock);
    // Rober's message is now read by another member.
    expect(read.readAt[JOSE]).toBeGreaterThanOrEqual(sentAt);
  });
  it("markRead no escribe si ya está al día", async () => {
    as(ROBER);
    const id = await chat.directThread(JOSE);
    await chat.sendMessage(id, { text: "Uno" });
    const events = vi.fn();
    const stop = chat.subscribe(events);
    tick();
    await chat.markRead(id); // Rober already read his own message
    expect(events).not.toHaveBeenCalled();
    stop();
  });
});

describe("entrega", () => {
  it("marcar entregado deja la marca sin marcar leído", async () => {
    as(ROBER);
    const id = await chat.directThread(JOSE);
    tick();
    await chat.sendMessage(id, { text: "Uno" });
    as(JOSE);
    tick();
    await chat.markDelivered(id);
    const seen = await thread(id);
    expect(seen.deliveredAt?.[JOSE]).toBe(clock);
    expect(seen.readAt[JOSE]).toBeUndefined();
  });
  it("no escribe si ya está al día ni sin mensajes de otros", async () => {
    as(ROBER);
    const id = await chat.directThread(JOSE);
    await chat.sendMessage(id, { text: "Uno" });
    const events = vi.fn();
    const stop = chat.subscribe(events);
    await chat.markDelivered(id); // only my own message
    expect(events).not.toHaveBeenCalled();
    stop();
  });
  it("rechaza una conversación ajena", async () => {
    as(ROBER);
    const id = await chat.directThread(JOSE);
    as(DIEGO);
    await expect(chat.markDelivered(id)).rejects.toThrow(NO_ACCESS);
  });
});

describe("regla 8: reenviar", () => {
  it("antepone Reenviado:, copia el adjunto y no conserva la respuesta", async () => {
    as(ROBER);
    const from = await chat.directThread(JOSE);
    const to = await chat.directThread(DIEGO);
    const first = await chat.sendMessage(from, { text: "Base" });
    const original = await chat.sendMessage(from, {
      text: "Mira esto",
      attachment: photo,
      replyTo: first.id,
    });
    const forwarded = await chat.forwardMessage(from, original.id, to);
    expect(forwarded.text).toBe("Reenviado: Mira esto");
    expect(forwarded.attachment).toEqual(photo);
    expect(forwarded.replyTo).toBeUndefined();
    expect((await thread(to)).messages).toHaveLength(1);
  });
  it("sin texto solo copia el adjunto", async () => {
    as(ROBER);
    const from = await chat.directThread(JOSE);
    const to = await chat.directThread(DIEGO);
    const original = await chat.sendMessage(from, {
      text: "",
      attachment: photo,
    });
    const forwarded = await chat.forwardMessage(from, original.id, to);
    expect(forwarded.text).toBe("");
    expect(forwarded.attachment).toEqual(photo);
  });
  it("exige acceso a ambas conversaciones y un mensaje vigente", async () => {
    as(ROBER);
    const from = await chat.directThread(JOSE);
    const to = await chat.directThread(DIEGO);
    const original = await chat.sendMessage(from, { text: "Hola" });
    as(JOSE);
    await expect(chat.forwardMessage(from, original.id, to)).rejects.toThrow(
      NO_ACCESS,
    );
    as(ROBER);
    await chat.deleteMessage(from, original.id);
    await expect(chat.forwardMessage(from, original.id, to)).rejects.toThrow(
      "El mensaje ya no está disponible.",
    );
  });
});

describe("mensajes compartidos y mensajes antiguos", () => {
  it("lista los mensajes con adjunto o enlace de toda la historia", async () => {
    as(ROBER);
    const id = await chat.directThread(JOSE);
    await chat.sendMessage(id, { text: "Solo texto" });
    await chat.sendMessage(id, { text: "", attachment: photo });
    await chat.sendMessage(id, { text: "Mira https://vexa.pe/doc ahora" });
    const shared = await chat.listSharedMessages(id);
    expect(shared.map((m) => m.text)).toEqual([
      "",
      "Mira https://vexa.pe/doc ahora",
    ]);
  });
  it("loadOlder devuelve los anteriores en orden ascendente con límite", async () => {
    as(ROBER);
    const id = await chat.directThread(JOSE);
    const stamps: number[] = [];
    for (const text of ["a", "b", "c", "d"]) {
      tick();
      stamps.push((await chat.sendMessage(id, { text })).sentAt);
    }
    const older = await chat.loadOlder(id, stamps[3], 2);
    expect(older.map((m) => m.text)).toEqual(["b", "c"]);
  });
});

describe("regla 9: ajustes", () => {
  it("parte de los valores por defecto", async () => {
    expect(await chat.getSettings()).toEqual({
      status: "Disponible",
      notifications: true,
      sound: "soft",
      presence: true,
      wallpaper: { kind: "none" },
      currentProjectId: null,
    });
  });
  it("un parche conserva el resto, recorta el estado y normaliza fondo y proyecto", async () => {
    await chat.updateSettings({ sound: "bell", status: "Leyendo" });
    const next = await chat.updateSettings({
      status: "x".repeat(120),
      wallpaper: { kind: "preset", id: "zzz" },
      currentProjectId: "",
    });
    expect(next.status).toHaveLength(80);
    expect(next.sound).toBe("bell");
    expect(next.wallpaper).toEqual({ kind: "none" });
    expect(next.currentProjectId).toBeNull();
    const kept = await chat.updateSettings({
      wallpaper: { kind: "preset", id: "grid" },
    });
    expect(kept.wallpaper).toEqual({ kind: "preset", id: "grid" });
    expect(
      (await chat.updateSettings({ notifications: false })).wallpaper,
    ).toEqual({
      kind: "preset",
      id: "grid",
    });
  });
  it("los ajustes de una persona no afectan a otra", async () => {
    await chat.updateSettings({
      status: "Ocupado",
      presence: false,
      currentProjectId: "p-vexa",
    });
    as(ROBER);
    expect((await chat.getSettings()).status).toBe("Disponible");
    const status = await chat.listMemberStatus();
    expect(status[JHONY]).toEqual({
      status: "Ocupado",
      presence: false,
      currentProjectId: "p-vexa",
    });
    expect(status[ROBER]).toEqual({
      status: "Disponible",
      presence: true,
      currentProjectId: null,
    });
  });
  it("el fondo propio se guarda por persona y se valida", async () => {
    const image = "data:image/png;base64,iVBORw0KGgo=";
    expect(await chat.getWallpaperImage()).toBeNull();
    await expect(chat.saveWallpaperImage("nope")).rejects.toThrow(
      "La imagen es demasiado pesada para guardarla.",
    );
    await chat.saveWallpaperImage(image);
    expect(await chat.getWallpaperImage()).toBe(image);
    as(ROBER);
    expect(await chat.getWallpaperImage()).toBeNull();
    as(JHONY);
    await chat.removeWallpaperImage();
    expect(await chat.getWallpaperImage()).toBeNull();
  });
});

describe("regla 10: presencia", () => {
  it("está en línea con latido de menos de 45 s y se ignora lo viejo", () => {
    const now = 100_000;
    const entries = [
      { userId: "a", at: now - 44_999 },
      { userId: "a", at: now - 10_000 },
      { userId: "b", at: now - 45_000 },
      { userId: "c", at: now + 1 },
    ];
    expect(activePresence(entries, now)).toEqual({
      a: now - 10_000,
      c: now + 1,
    });
  });
  it("trackPresence(true) publica la señal y trackPresence(false) la quita", () => {
    const seen: Record<string, number>[] = [];
    const stop = chat.subscribePresence((online) => seen.push(online));
    chat.trackPresence(true);
    expect(Object.keys(seen.at(-1) ?? {})).toEqual([JHONY]);
    chat.trackPresence(false);
    expect(seen.at(-1)).toEqual({});
    stop();
  });
  it("sin presencia activada nadie ve a la persona", () => {
    const seen: Record<string, number>[] = [];
    const stop = chat.subscribePresence((online) => seen.push(online));
    chat.trackPresence(false);
    expect(seen.at(-1)).toEqual({});
    stop();
  });
});

describe("persistencia y eventos", () => {
  it("usa la misma clave de localStorage y avisa de los cambios", async () => {
    const events = vi.fn();
    const stop = chat.subscribe(events);
    as(ROBER);
    await chat.directThread(JOSE);
    expect(events).toHaveBeenCalled();
    stop();
    const stored = JSON.parse(storage.get(CHAT_KEY) ?? "null");
    expect(stored.threads).toHaveLength(1);
    const after = events.mock.calls.length;
    await chat.directThread(DIEGO);
    expect(events.mock.calls.length).toBe(after);
  });
  it("sin sesión el servicio falla con un mensaje claro", async () => {
    setSessionUserId(null);
    await expect(chat.listThreads()).rejects.toThrow(
      "Inicia sesión para usar el chat.",
    );
  });
});

describe("ciclo de vida de los adjuntos", () => {
  let id: string;
  let messageId: string;
  const find = async () =>
    (await thread(id)).messages.find((m) => m.id === messageId)!;
  beforeEach(async () => {
    as(ROBER);
    id = await chat.directThread(JOSE);
    messageId = (await chat.sendMessage(id, { text: "", attachment: photo }))
      .id;
  });

  it("no se responde antes de que todos descarguen; el emisor cuenta como descarga", async () => {
    await expect(chat.answerAttachmentKeep(messageId, false)).rejects.toThrow(
      "Todavía falta que todos descarguen el archivo.",
    );
    as(JOSE);
    await chat.markAttachmentDownloaded(messageId);
    await chat.markAttachmentDownloaded(messageId);
    const life = (await find()).attachmentLife!;
    expect(Object.keys(life.downloadedAt)).toEqual([JOSE]);
    expect(life.downloadedAt[JOSE]).toBe(clock);
  });
  it("solo integrantes descargan o responden", async () => {
    as(DIEGO);
    await expect(chat.markAttachmentDownloaded(messageId)).rejects.toThrow(
      "El mensaje ya no está disponible.",
    );
    await expect(chat.answerAttachmentKeep(messageId, false)).rejects.toThrow(
      "El mensaje ya no está disponible.",
    );
  });
  it("si todos liberan el archivo se retira y el mensaje queda como marcador", async () => {
    as(JOSE);
    await chat.markAttachmentDownloaded(messageId);
    await chat.answerAttachmentKeep(messageId, false);
    expect((await find()).attachment).toBeDefined();
    as(ROBER);
    await chat.answerAttachmentKeep(messageId, false);
    const purged = await find();
    expect(purged.attachment).toBeUndefined();
    expect(purged.purgedAttachment).toEqual({
      name: "foto.png",
      type: "image/png",
      size: 1,
      purgedAt: clock,
    });
    expect(purged.deleted).toBeFalsy();
    await expect(chat.answerAttachmentKeep(messageId, true)).rejects.toThrow(
      "El archivo ya fue eliminado para liberar espacio.",
    );
  });
  it("conservar gana: un solo 'conservar' mantiene el archivo", async () => {
    as(JOSE);
    await chat.markAttachmentDownloaded(messageId);
    await chat.answerAttachmentKeep(messageId, true);
    as(ROBER);
    await chat.answerAttachmentKeep(messageId, false);
    await chat.purgeReleasedAttachment(messageId);
    const kept = await find();
    expect(kept.attachment).toEqual(photo);
    expect(kept.purgedAttachment).toBeUndefined();
  });
  it("quien no responde equivale a conservar y no hay retiro automático", async () => {
    as(JOSE);
    await chat.markAttachmentDownloaded(messageId);
    await chat.answerAttachmentKeep(messageId, false);
    clock += 365 * 24 * 3600 * 1000;
    await chat.purgeReleasedAttachment(messageId);
    expect((await find()).attachment).toBeDefined();
  });
  it("se responde una sola vez", async () => {
    as(JOSE);
    await chat.markAttachmentDownloaded(messageId);
    await chat.answerAttachmentKeep(messageId, true);
    await expect(chat.answerAttachmentKeep(messageId, false)).rejects.toThrow(
      "Ya respondiste sobre este archivo.",
    );
  });
  it("un hilo con un solo integrante no tiene ciclo", async () => {
    as(JHONY);
    const solo = await chat.saveGroup({
      name: "Solo",
      description: "",
      members: [JHONY],
    });
    const sent = await chat.sendMessage(solo, { text: "", attachment: photo });
    await expect(chat.answerAttachmentKeep(sent.id, false)).rejects.toThrow(
      "Todavía falta que todos descarguen el archivo.",
    );
  });
});
