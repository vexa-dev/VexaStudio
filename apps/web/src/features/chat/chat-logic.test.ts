import { describe, expect, it } from "vitest";
import type { ChatMessage, ChatThread } from "@vexa/domain/chat";
import {
  applyReaction,
  attachmentStage,
  needsMyAnswer,
  pendingDownloads,
  shouldMarkDownload,
  incomingNotice,
  countUnread,
  incomingMessages,
  isReadByOthers,
  messageStatus,
  needsDelivery,
  noticeBody,
  noticeTitle,
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

describe("título del aviso de mensaje", () => {
  it("en un chat directo es el nombre de quien escribe", () => {
    expect(noticeTitle("Jhony Rivera", thread({ id: "t" }))).toBe(
      "Jhony Rivera",
    );
  });
  it("en un grupo suma el nombre del grupo", () => {
    expect(
      noticeTitle("Jhony Rivera", thread({ id: "g", kind: "group", name: "Equipo" })),
    ).toBe("Jhony Rivera · Equipo");
  });
  it("sin nombre conocido usa Integrante", () => {
    expect(noticeTitle(undefined, undefined)).toBe("Integrante");
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

describe("estado del mensaje propio", () => {
  const m = message({ id: "a", authorId: "ana", sentAt: 200 });
  it("está enviado sin marcas de otros", () => {
    const t = thread({ id: "t", messages: [m] });
    expect(messageStatus(t, m, "ana")).toBe("sent");
  });
  it("está recibido si otro integrante recibió en o después del envío", () => {
    const t = thread({ id: "t", messages: [m], deliveredAt: { beto: 200 } });
    expect(messageStatus(t, m, "ana")).toBe("delivered");
  });
  it("sigue enviado si la entrega fue antes del envío", () => {
    const t = thread({ id: "t", messages: [m], deliveredAt: { beto: 199 } });
    expect(messageStatus(t, m, "ana")).toBe("sent");
  });
  it("leído implica recibido aunque no haya marca de entrega", () => {
    const t = thread({ id: "t", messages: [m], readAt: { beto: 250 } });
    expect(messageStatus(t, m, "ana")).toBe("read");
  });
  it("leído gana sobre recibido", () => {
    const t = thread({
      id: "t",
      messages: [m],
      readAt: { beto: 300 },
      deliveredAt: { beto: 250 },
    });
    expect(messageStatus(t, m, "ana")).toBe("read");
  });
  it("mi propia entrega o lectura no cuenta", () => {
    const t = thread({
      id: "t",
      messages: [m],
      readAt: { ana: 999 },
      deliveredAt: { ana: 999 },
    });
    expect(messageStatus(t, m, "ana")).toBe("sent");
  });
  it("quien no es integrante no cuenta", () => {
    const t = thread({
      id: "t",
      messages: [m],
      deliveredAt: { admin: 999 },
      readAt: { admin: 999 },
    });
    expect(messageStatus(t, m, "ana")).toBe("sent");
  });
  it("en un grupo basta con que uno reciba o lea", () => {
    const g = thread({
      id: "g",
      kind: "group",
      members: ["ana", "beto", "cleo"],
      messages: [m],
      deliveredAt: { cleo: 210 },
    });
    expect(messageStatus(g, m, "ana")).toBe("delivered");
    expect(messageStatus({ ...g, readAt: { beto: 220 } }, m, "ana")).toBe(
      "read",
    );
  });
});

describe("entrega pendiente", () => {
  const theirs = message({ id: "a", authorId: "beto", sentAt: 200 });
  it("hay entrega pendiente con un mensaje ajeno posterior a mi marca", () => {
    const t = thread({ id: "t", messages: [theirs] });
    expect(needsDelivery(t, "ana")).toBe(200);
  });
  it("no hay pendiente si ya recibí o leí", () => {
    expect(
      needsDelivery(
        thread({ id: "t", messages: [theirs], deliveredAt: { ana: 200 } }),
        "ana",
      ),
    ).toBeNull();
    expect(
      needsDelivery(
        thread({ id: "t", messages: [theirs], readAt: { ana: 250 } }),
        "ana",
      ),
    ).toBeNull();
  });
  it("mis propios mensajes no generan entrega", () => {
    const mine = message({ id: "b", authorId: "ana", sentAt: 300 });
    expect(
      needsDelivery(thread({ id: "t", messages: [mine] }), "ana"),
    ).toBeNull();
  });
});

describe("ciclo de vida de un adjunto", () => {
  const file = { name: "plan.pdf", type: "application/pdf", data: "blob:x" };
  const group = (messageOverrides: Partial<ChatMessage> = {}) => {
    const sent = message({
      id: "f",
      authorId: "ana",
      attachment: file,
      attachmentLife: { downloadedAt: {}, keep: {} },
      ...messageOverrides,
    });
    return {
      sent,
      room: thread({
        id: "t",
        members: ["ana", "beto", "caro"],
        messages: [sent],
      }),
    };
  };

  it("quien envía cuenta como descarga implícita; faltan los demás", () => {
    const { sent, room } = group();
    expect(pendingDownloads(room, sent)).toEqual(["beto", "caro"]);
    expect(attachmentStage(room, sent)).toBe("downloading");
  });
  it("sin respuesta nadie decide hasta que todos descargaron", () => {
    const { sent, room } = group({
      attachmentLife: { downloadedAt: { beto: 1 }, keep: {} },
    });
    expect(pendingDownloads(room, sent)).toEqual(["caro"]);
    expect(needsMyAnswer(room, sent, "beto")).toBe(false);
  });
  it("con todas las descargas se pregunta a cada integrante, emisor incluido, una sola vez", () => {
    const { sent, room } = group({
      attachmentLife: {
        downloadedAt: { beto: 1, caro: 2 },
        keep: { beto: false },
      },
    });
    expect(attachmentStage(room, sent)).toBe("asking");
    expect(needsMyAnswer(room, sent, "ana")).toBe(true);
    expect(needsMyAnswer(room, sent, "caro")).toBe(true);
    expect(needsMyAnswer(room, sent, "beto")).toBe(false);
  });
  it("quien no es integrante (admin de un grupo) no responde", () => {
    const { sent, room } = group({
      attachmentLife: { downloadedAt: { beto: 1, caro: 2 }, keep: {} },
    });
    expect(needsMyAnswer(room, sent, "admin")).toBe(false);
    expect(shouldMarkDownload(room, sent, "admin")).toBe(false);
  });
  it("conservar gana: con un solo 'conservar' ya no se pregunta a nadie", () => {
    const { sent, room } = group({
      attachmentLife: {
        downloadedAt: { beto: 1, caro: 2 },
        keep: { beto: true, ana: false },
      },
    });
    expect(attachmentStage(room, sent)).toBe("kept");
    expect(needsMyAnswer(room, sent, "caro")).toBe(false);
  });
  it("se puede retirar solo cuando todos los integrantes liberaron", () => {
    const answers = { ana: false, beto: false };
    const { sent, room } = group({
      attachmentLife: { downloadedAt: { beto: 1, caro: 2 }, keep: answers },
    });
    expect(attachmentStage(room, sent)).toBe("asking");
    const ready = {
      ...sent,
      attachmentLife: {
        downloadedAt: { beto: 1, caro: 2 },
        keep: { ...answers, caro: false },
      },
    };
    expect(attachmentStage(room, ready)).toBe("ready");
  });
  it("quien nunca responde equivale a conservar", () => {
    const { sent, room } = group({
      attachmentLife: {
        downloadedAt: { beto: 1, caro: 2 },
        keep: { ana: false, beto: false },
      },
    });
    expect(attachmentStage(room, sent)).not.toBe("ready");
  });
  it("marca mi descarga solo si soy integrante, no soy el emisor y no descargué", () => {
    const { sent, room } = group({
      attachmentLife: { downloadedAt: { beto: 1 }, keep: {} },
    });
    expect(shouldMarkDownload(room, sent, "ana")).toBe(false);
    expect(shouldMarkDownload(room, sent, "beto")).toBe(false);
    expect(shouldMarkDownload(room, sent, "caro")).toBe(true);
  });
  it("sin ciclo: un solo integrante, mensaje anulado o sin archivo", () => {
    const { sent } = group();
    const solo = thread({ id: "s", members: ["ana"], messages: [sent] });
    expect(attachmentStage(solo, sent)).toBe("none");
    const { room } = group();
    expect(attachmentStage(room, { ...sent, deleted: true })).toBe("none");
    expect(attachmentStage(room, { ...sent, attachment: undefined })).toBe(
      "none",
    );
    expect(needsMyAnswer(solo, sent, "ana")).toBe(false);
  });
  it("un archivo retirado queda como marcador y no se pregunta ni se descarga", () => {
    const { sent, room } = group();
    const purged = {
      ...sent,
      attachment: undefined,
      purgedAttachment: {
        name: "plan.pdf",
        type: "application/pdf",
        size: 10,
        purgedAt: 5,
      },
    };
    expect(attachmentStage(room, purged)).toBe("purged");
    expect(shouldMarkDownload(room, purged, "beto")).toBe(false);
    expect(needsMyAnswer(room, purged, "beto")).toBe(false);
  });
});
