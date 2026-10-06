import { describe, expect, it } from "vitest";
import type { ChatMessage, ChatThread } from "@vexa/domain/chat";
import {
  applyReaction,
  incomingNotice,
  countUnread,
  incomingMessages,
  isReadByOthers,
  noticeBody,
  unreadByThread,
} from "./chat-logic";

function message(
  overrides: Partial<ChatMessage> & { id: string },
): ChatMessage {
  return {
    authorId: "ana",
    text: "Hola",
    sentAt: 100,
    reactions: {},
    ...overrides,
  };
}
function thread(overrides: Partial<ChatThread> & { id: string }): ChatThread {
  return {
    kind: "direct",
    name: "",
    description: "",
    members: ["ana", "beto"],
    messages: [],
    readAt: {},
    ...overrides,
  };
}

describe("no leídos", () => {
  const threads = [
    thread({
      id: "t1",
      messages: [
        message({ id: "a", authorId: "ana", sentAt: 100 }),
        message({ id: "b", authorId: "beto", sentAt: 200 }),
        message({ id: "c", authorId: "beto", sentAt: 300 }),
      ],
      readAt: { ana: 150 },
    }),
    thread({
      id: "t2",
      messages: [message({ id: "d", authorId: "beto", sentAt: 50 })],
      readAt: {},
    }),
    thread({ id: "t3", messages: [] }),
  ];
  it("cuenta solo mensajes ajenos posteriores a mi lectura", () => {
    expect(unreadByThread(threads, "ana")).toEqual({ t1: 2, t2: 1, t3: 0 });
    expect(countUnread(threads, "ana")).toBe(3);
  });
  it("mis propios mensajes nunca cuentan", () => {
    expect(countUnread(threads, "beto")).toBe(1);
  });
  it("un mensaje enviado en el mismo instante de la lectura ya está leído", () => {
    const t = thread({
      id: "t",
      messages: [message({ id: "x", authorId: "beto", sentAt: 100 })],
      readAt: { ana: 100 },
    });
    expect(countUnread([t], "ana")).toBe(0);
  });
  it("sin conversaciones no hay no leídos", () => {
    expect(countUnread([], "ana")).toBe(0);
  });
});

describe("mensajes entrantes", () => {
  const threads = [
    thread({
      id: "t1",
      messages: [
        message({ id: "a", authorId: "beto" }),
        message({ id: "b", authorId: "beto" }),
        message({ id: "c", authorId: "ana" }),
      ],
    }),
  ];
  it("devuelve los nuevos de otras personas", () => {
    const incoming = incomingMessages(new Set(["a"]), threads, "ana");
    expect(incoming.map((m) => m.id)).toEqual(["b"]);
  });
  it("ignora los míos aunque sean nuevos", () => {
    expect(
      incomingMessages(new Set(), threads, "ana").map((m) => m.id),
    ).toEqual(["a", "b"]);
  });
  it("no devuelve nada si ya se conocían todos", () => {
    expect(incomingMessages(new Set(["a", "b", "c"]), threads, "ana")).toEqual(
      [],
    );
  });
});

describe("cuerpo del aviso", () => {
  it("recorta el texto a 100 caracteres", () => {
    expect(noticeBody(message({ id: "a", text: "x".repeat(150) }))).toBe(
      "x".repeat(100),
    );
  });
  it("usa Archivo adjunto cuando no hay texto", () => {
    expect(
      noticeBody(
        message({
          id: "a",
          text: "",
          attachment: { name: "a.png", type: "image/png", data: "d" },
        }),
      ),
    ).toBe("Archivo adjunto");
  });
  it("conserva el texto corto", () => {
    expect(noticeBody(message({ id: "a", text: "Hola" }))).toBe("Hola");
  });
});

describe("lectura por otros integrantes", () => {
  const m = message({ id: "a", authorId: "ana", sentAt: 200 });
  it("está leído si otro integrante leyó en o después del envío", () => {
    const t = thread({ id: "t", messages: [m], readAt: { beto: 200 } });
    expect(isReadByOthers(t, m, "ana")).toBe(true);
  });
  it("no está leído si el otro leyó antes", () => {
    const t = thread({ id: "t", messages: [m], readAt: { beto: 199 } });
    expect(isReadByOthers(t, m, "ana")).toBe(false);
  });
  it("mi propia lectura no cuenta", () => {
    const t = thread({ id: "t", messages: [m], readAt: { ana: 999 } });
    expect(isReadByOthers(t, m, "ana")).toBe(false);
  });
  it("la lectura de quien no es integrante no cuenta", () => {
    const t = thread({
      id: "t",
      messages: [m],
      readAt: { admin: 999 },
    });
    expect(isReadByOthers(t, m, "ana")).toBe(false);
  });
});

describe("reacción optimista", () => {
  it("agrega, quita al repetir y reemplaza al cambiar", () => {
    const added = applyReaction({}, "ana", "👍");
    expect(added).toEqual({ ana: "👍" });
    expect(applyReaction(added, "ana", "👍")).toEqual({});
    expect(applyReaction(added, "ana", "❤️")).toEqual({ ana: "❤️" });
  });
  it("no modifica el objeto original", () => {
    const original = { ana: "👍" };
    applyReaction(original, "beto", "👍");
    expect(original).toEqual({ ana: "👍" });
  });
});

describe("aviso de mensaje entrante", () => {
  const incoming = [
    message({ id: "a", text: "Primero" }),
    message({ id: "b", text: "Último" }),
  ];
  const on = { notifications: true, sound: "soft" } as const;
  it("un solo aviso con el último mensaje y el sonido elegido", () => {
    expect(incomingNotice(incoming, on)).toEqual({
      body: "Último",
      sound: "soft",
    });
  });
  it("no avisa sin mensajes nuevos o con los avisos desactivados", () => {
    expect(incomingNotice([], on)).toBeNull();
    expect(
      incomingNotice(incoming, { notifications: false, sound: "bell" }),
    ).toBeNull();
  });
  it("con sonido ninguno avisa sin sonar", () => {
    expect(
      incomingNotice(incoming, { notifications: true, sound: "none" }),
    ).toEqual({ body: "Último", sound: null });
  });
});
