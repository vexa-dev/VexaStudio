import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetMock, setSessionUserId } from "./db";
import { time } from "./work";

beforeEach(() => {
  resetMock();
  setSessionUserId("u-rober");
  getDb().auditLog = [];
});

describe("actividad del reloj", () => {
  it("pausar y continuar dejan su evento con el estado del reloj", async () => {
    await time.start("t-5");
    await time.pause();
    const paused = getDb().auditLog.at(-1);
    expect(paused?.eventType).toBe("timer.paused");
    expect(paused?.changes.map((c) => c.field)).toContain("timerState");
    await time.resume();
    expect(getDb().auditLog.at(-1)?.eventType).toBe("timer.resumed");
  });

  it("pausar de nuevo un reloj ya pausado no agrega actividad", async () => {
    await time.start("t-5");
    await time.pause();
    const count = getDb().auditLog.length;
    await time.pause();
    expect(getDb().auditLog).toHaveLength(count);
  });
});
