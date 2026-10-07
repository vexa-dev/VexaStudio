import { beforeEach, describe, expect, it, vi } from "vitest";
import { limaWeekMonday } from "@vexa/domain/meetings";
import { getDb, resetMock, setSessionUserId } from "./db";
import { createMockServices } from "./index";

beforeEach(() => {
  resetMock();
  // Sin retraso artificial: la prueba solo mira reglas.
  vi.useRealTimers();
});
const services = createMockServices();

const HOUR = 3_600_000;
/** Dos horarios futuros dentro de la semana en curso o de la siguiente (siempre válidos). */
function validSlots() {
  // Martes y miércoles de la semana siguiente a las 3:00 p. m. de Lima (20:00 UTC).
  const monday = Date.parse(`${limaWeekMonday(new Date())}T20:00:00Z`);
  return [new Date(monday + 8 * 24 * HOUR).toISOString(), new Date(monday + 9 * 24 * HOUR).toISOString()];
}
/** Quita la convocatoria sembrada para convocar desde cero. */
function clearSeed() {
  const db = getDb();
  db.meetings.length = 0;
  db.meetingSlots.length = 0;
  db.slotVotes.length = 0;
}

describe("mock meetings", () => {
  it("shows studio roles the seeded convocatoria and a collaborator nothing", async () => {
    setSessionUserId("u-rober");
    const detail = await services.meetings.getCurrent();
    expect(detail?.meeting.status).toBe("polling");
    expect(detail?.slots).toHaveLength(3);
    setSessionUserId("u-demo-collaborator");
    expect(await services.meetings.getCurrent()).toBeNull();
  });

  it("lets only the admin propose 2 or 3 valid slots, once per week, and notifies the studio", async () => {
    clearSeed();
    const slots = validSlots();
    setSessionUserId("u-rober");
    await expect(services.meetings.propose(slots)).rejects.toThrow("product owner");
    setSessionUserId("u-jhony");
    await expect(services.meetings.propose([slots[0]])).rejects.toThrow("2 o 3");
    const before = getDb().notifications.length;
    const detail = await services.meetings.propose(slots);
    expect(detail.slots).toHaveLength(2);
    expect(detail.meeting.status).toBe("polling");
    const created = getDb().notifications.slice(before);
    expect(created.every((n) => n.type === "meeting")).toBe(true);
    expect(created.map((n) => n.userId).sort()).toEqual(["u-diego", "u-jose", "u-rober"]);
    await expect(services.meetings.propose(slots)).rejects.toThrow("Ya hay una convocatoria");
  });

  it("votes once per slot, changes the vote and refuses collaborators", async () => {
    setSessionUserId("u-jose");
    const { slots } = (await services.meetings.getCurrent())!;
    await services.meetings.vote(slots[0].id, true);
    const changed = await services.meetings.vote(slots[0].id, false);
    expect(changed.votes.filter((v) => v.userId === "u-jose" && v.slotId === slots[0].id)).toEqual([
      { slotId: slots[0].id, userId: "u-jose", available: false },
    ]);
    setSessionUserId("u-demo-collaborator");
    await expect(services.meetings.vote(slots[0].id, true)).rejects.toThrow("Tu rol");
  });

  it("confirms with an https link, notifies everyone but the admin and closes the voting", async () => {
    setSessionUserId("u-jhony");
    const { meeting, slots } = (await services.meetings.getCurrent())!;
    await expect(services.meetings.confirm(meeting.id, slots[0].id, "http://meet.google.com/x")).rejects.toThrow("https");
    await expect(services.meetings.confirm(meeting.id, "nope", "https://meet.google.com/abc-defg-hij")).rejects.toThrow(
      "no pertenece",
    );
    setSessionUserId("u-rober");
    await expect(services.meetings.confirm(meeting.id, slots[0].id, "https://meet.google.com/abc-defg-hij")).rejects.toThrow(
      "product owner",
    );
    setSessionUserId("u-jhony");
    const before = getDb().notifications.length;
    const confirmed = await services.meetings.confirm(meeting.id, slots[1].id, " https://meet.google.com/abc-defg-hij ");
    expect(confirmed.meeting).toMatchObject({ status: "confirmed", confirmedSlotId: slots[1].id, meetLink: "https://meet.google.com/abc-defg-hij" });
    const created = getDb().notifications.slice(before);
    expect(created.map((n) => n.userId).sort()).toEqual(["u-diego", "u-jose", "u-rober"]);
    expect(created[0].payload.meetLink).toBe("https://meet.google.com/abc-defg-hij");
    setSessionUserId("u-rober");
    await expect(services.meetings.vote(slots[0].id, true)).rejects.toThrow("votación ya terminó");
  });

  it("marks attendance only by the admin, only after the slot started and only for studio members", async () => {
    setSessionUserId("u-jhony");
    const { meeting, slots } = (await services.meetings.getCurrent())!;
    await services.meetings.confirm(meeting.id, slots[0].id, "https://meet.google.com/abc-defg-hij");
    await expect(services.meetings.markAttendance(meeting.id, ["u-jhony"])).rejects.toThrow("ya empezó");
    getDb().meetingSlots.find((s) => s.id === slots[0].id)!.startsAt = new Date(Date.now() - HOUR).toISOString();
    setSessionUserId("u-rober");
    await expect(services.meetings.markAttendance(meeting.id, ["u-rober"])).rejects.toThrow("product owner");
    setSessionUserId("u-jhony");
    await expect(services.meetings.markAttendance(meeting.id, ["u-demo-collaborator"])).rejects.toThrow("socios activos");
    const held = await services.meetings.markAttendance(meeting.id, ["u-jhony", "u-rober", "u-jhony"]);
    expect(held.meeting).toMatchObject({ status: "held", attendeeIds: ["u-jhony", "u-rober"] });
    await expect(services.meetings.markAttendance(meeting.id, ["u-jhony"])).rejects.toThrow("no está permitida");
  });
});
