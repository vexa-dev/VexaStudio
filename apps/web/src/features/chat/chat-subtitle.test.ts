import { describe, expect, it } from "vitest";
import { chatSubtitle } from "./chat-subtitle";

const direct = {
  kind: "direct" as const,
  working: null,
  online: false,
  status: "",
  memberCount: 2,
};

describe("chatSubtitle", () => {
  it("shows project and task when the person is working", () => {
    expect(
      chatSubtitle({
        ...direct,
        working: { source: "timer", projectName: "Fivuza", taskTitle: "Login" },
      }),
    ).toBe("Desarrollando Fivuza · Login");
  });
  it("omits the task when there is none", () => {
    expect(
      chatSubtitle({
        ...direct,
        working: { source: "manual", projectName: "Vantage", taskTitle: null },
      }),
    ).toBe("Desarrollando Vantage");
  });
  it("falls back to presence and status without a project", () => {
    expect(
      chatSubtitle({
        ...direct,
        working: { source: "timer", projectName: null, taskTitle: "Suelta" },
        online: true,
        status: "Disponible",
      }),
    ).toBe("En línea · Disponible");
    expect(chatSubtitle({ ...direct, status: "Ocupado" })).toBe(
      "Sin conexión · Ocupado",
    );
  });
  it("omits the status separator when the status is empty", () => {
    expect(chatSubtitle({ ...direct, online: true })).toBe("En línea");
  });
  it("counts group members with singular form", () => {
    expect(chatSubtitle({ ...direct, kind: "group", memberCount: 4 })).toBe(
      "4 integrantes",
    );
    expect(chatSubtitle({ ...direct, kind: "group", memberCount: 1 })).toBe(
      "1 integrante",
    );
  });
});
