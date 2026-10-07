import { describe, expect, it } from "vitest";
import { argsOf, fakeClient, ok, profileRow } from "./fake-client";
import { createMeetingService } from "./meetings";
import { limaWeekMonday } from "@vexa/domain/meetings";

const meetingRow = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  week: limaWeekMonday(new Date()),
  status: "polling",
  confirmed_slot_id: null,
  meet_link: null,
  attendee_ids: [],
  created_by: "u1",
  created_at: "2026-10-07T15:00:00+00:00",
  ...over,
});
// El cliente falso responde igual a cualquier consulta de la tabla: una lista con una fila afectada que
// además se lee como la fila de la convocatoria (para el `update ... select` y el `single` posterior).
const updatedRows = () => Object.assign([{ id: "m1" }], meetingRow());
const slotRows = [
  { id: "s1", meeting_id: "m1", starts_at: "2026-10-08T20:00:00+00:00" },
  { id: "s2", meeting_id: "m1", starts_at: "2026-10-09T20:00:00+00:00" },
];
const voteRows = [{ slot_id: "s1", user_id: "u1", available: true, created_at: "2026-10-07T16:00:00+00:00" }];

const future = () => {
  // Martes y miércoles de la semana siguiente a las 3:00 p. m. de Lima (20:00 UTC): siempre válidos.
  const monday = Date.parse(`${limaWeekMonday(new Date())}T20:00:00Z`);
  const day = 24 * 3_600_000;
  return [new Date(monday + 8 * day).toISOString(), new Date(monday + 9 * day).toISOString()];
};

describe("MeetingService de Supabase", () => {
  it("devuelve la convocatoria vigente con horarios y votos", async () => {
    const { client, calls } = fakeClient({
      tables: {
        profiles: ok(profileRow("partner")),
        meetings: ok([meetingRow()]),
        meeting_slots: ok(slotRows),
        slot_votes: ok(voteRows),
      },
    });
    const detail = await createMeetingService(client).getCurrent();
    expect(detail?.meeting).toMatchObject({ id: "m1", status: "polling", createdAt: "2026-10-07T15:00:00.000Z" });
    expect(detail?.slots.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(detail?.votes).toEqual([{ slotId: "s1", userId: "u1", available: true }]);
    expect(argsOf(calls, "meetings", "gte")[0][0]).toBe("week");
  });

  it("sin convocatoria devuelve null (un colaborador recibe vacío por RLS)", async () => {
    const { client } = fakeClient({ tables: { profiles: ok(profileRow("collaborator")), meetings: ok([]) } });
    expect(await createMeetingService(client).getCurrent()).toBeNull();
  });

  it("convoca por RPC solo siendo admin y validando los horarios antes", async () => {
    const slots = future();
    const admin = fakeClient({
      tables: { profiles: ok(profileRow("admin")), meetings: ok(meetingRow()), meeting_slots: ok(slotRows), slot_votes: ok([]) },
      rpc: { propose_meeting: ok("m1") },
    });
    const detail = await createMeetingService(admin.client).propose(slots);
    expect(detail.meeting.id).toBe("m1");
    expect(argsOf(admin.calls, "rpc:propose_meeting", "call")[0]).toEqual([{ p_slots: slots }]);

    const partner = fakeClient({ tables: { profiles: ok(profileRow("partner")) } });
    await expect(createMeetingService(partner.client).propose(slots)).rejects.toThrow("product owner");
    expect(argsOf(partner.calls, "rpc:propose_meeting", "call")).toHaveLength(0);
    await expect(createMeetingService(admin.client).propose([slots[0]])).rejects.toThrow("2 o 3");
  });

  it("vota: cambia el voto propio o, si no existe, lo inserta", async () => {
    const changed = fakeClient({
      tables: {
        profiles: ok(profileRow("partner")),
        meeting_slots: ok(Object.assign([slotRows[0]], slotRows[0])),
        slot_votes: ok([{ slot_id: "s1" }]),
        meetings: ok(meetingRow()),
      },
    });
    await createMeetingService(changed.client).vote("s1", false);
    expect(argsOf(changed.calls, "slot_votes", "update")[0]).toEqual([{ available: false }]);
    expect(argsOf(changed.calls, "slot_votes", "insert")).toHaveLength(0);

    const created = fakeClient({
      tables: { profiles: ok(profileRow("partner")), meeting_slots: ok(Object.assign([slotRows[0]], slotRows[0])), slot_votes: ok([]), meetings: ok(meetingRow()) },
    });
    await createMeetingService(created.client).vote("s1", true);
    expect(argsOf(created.calls, "slot_votes", "insert")[0]).toEqual([{ slot_id: "s1", available: true }]);
  });

  it("un colaborador no vota", async () => {
    const { client, calls } = fakeClient({ tables: { profiles: ok(profileRow("collaborator")) } });
    await expect(createMeetingService(client).vote("s1", true)).rejects.toThrow("Tu rol");
    expect(argsOf(calls, "slot_votes", "insert")).toHaveLength(0);
  });

  it("confirma con un enlace https y solo siendo admin", async () => {
    const admin = fakeClient({
      tables: {
        profiles: ok(profileRow("admin")),
        meetings: ok(updatedRows()),
        meeting_slots: ok(slotRows),
        slot_votes: ok([]),
      },
    });
    await createMeetingService(admin.client).confirm("m1", "s2", " https://meet.google.com/abc-defg-hij ");
    expect(argsOf(admin.calls, "meetings", "update")[0]).toEqual([
      { status: "confirmed", confirmed_slot_id: "s2", meet_link: "https://meet.google.com/abc-defg-hij" },
    ]);
    await expect(createMeetingService(admin.client).confirm("m1", "s2", "http://x.com")).rejects.toThrow("https");
    const partner = fakeClient({ tables: { profiles: ok(profileRow("partner")) } });
    await expect(createMeetingService(partner.client).confirm("m1", "s2", "https://meet.google.com/a-b-c")).rejects.toThrow(
      "product owner",
    );
  });

  it("marca la asistencia sin repetidos y avisa si la convocatoria ya no admite cambios", async () => {
    const admin = fakeClient({
      tables: { profiles: ok(profileRow("admin")), meetings: ok(updatedRows()), meeting_slots: ok([]), slot_votes: ok([]) },
    });
    await createMeetingService(admin.client).markAttendance("m1", ["u1", "u2", "u1"]);
    expect(argsOf(admin.calls, "meetings", "update")[0]).toEqual([{ status: "held", attendee_ids: ["u1", "u2"] }]);
    const stale = fakeClient({ tables: { profiles: ok(profileRow("admin")), meetings: ok([]) } });
    await expect(createMeetingService(stale.client).markAttendance("m1", ["u1"])).rejects.toThrow("ya no admite");
  });
});
