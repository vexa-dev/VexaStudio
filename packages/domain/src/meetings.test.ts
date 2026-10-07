import { describe, expect, it } from "vitest";
import {
  MAX_SLOTS,
  MIN_SLOTS,
  consecutiveAbsences,
  isVoteReminderDue,
  limaWeekMonday,
  pendingVoters,
  pickCurrentMeeting,
  slotAvailability,
  validateMeetLink,
  validateSlotStarts,
} from "./meetings";
import type { Meeting, MeetingSlot, SlotVote } from "./types";

// Miércoles 07/10/2026 12:00 en Lima (17:00 UTC). La semana de Lima empieza el lunes 05/10.
const NOW = new Date("2026-10-07T17:00:00Z");

describe("limaWeekMonday", () => {
  it("devuelve el lunes de Lima", () => {
    expect(limaWeekMonday(NOW)).toBe("2026-10-05");
    // Domingo 11/10 23:30 en Lima (04:30 UTC del lunes 12) sigue en la semana del 05/10.
    expect(limaWeekMonday("2026-10-12T04:30:00Z")).toBe("2026-10-05");
    expect(limaWeekMonday("2026-10-12T05:00:00Z")).toBe("2026-10-12");
  });
});

describe("validateSlotStarts", () => {
  const ok = ["2026-10-08T20:00:00Z", "2026-10-09T20:00:00Z"];
  it("acepta 2 o 3 horarios futuros de una misma semana", () => {
    expect(validateSlotStarts(ok, NOW)).toBeNull();
    expect(validateSlotStarts([...ok, "2026-10-10T15:00:00Z"], NOW)).toBeNull();
  });
  it("exige entre 2 y 3 horarios", () => {
    expect(MIN_SLOTS).toBe(2);
    expect(MAX_SLOTS).toBe(3);
    expect(validateSlotStarts([ok[0]], NOW)).toMatch(/2 o 3/);
    expect(validateSlotStarts([...ok, "2026-10-10T15:00:00Z", "2026-10-10T16:00:00Z"], NOW)).toMatch(/2 o 3/);
  });
  it("rechaza repetidos, inválidos y pasados", () => {
    expect(validateSlotStarts([ok[0], ok[0]], NOW)).toMatch(/distintos/);
    expect(validateSlotStarts([ok[0], "nope"], NOW)).toMatch(/válida/);
    expect(validateSlotStarts([ok[0], "2026-10-07T16:00:00Z"], NOW)).toMatch(/futuro/);
  });
  it("permite la semana siguiente pero no más lejos ni mezclar semanas", () => {
    expect(validateSlotStarts(["2026-10-13T20:00:00Z", "2026-10-14T20:00:00Z"], NOW)).toBeNull();
    expect(validateSlotStarts(["2026-10-20T20:00:00Z", "2026-10-21T20:00:00Z"], NOW)).toMatch(/esta semana o la siguiente/);
    expect(validateSlotStarts([ok[0], "2026-10-13T20:00:00Z"], NOW)).toMatch(/misma semana/);
  });
});

describe("validateMeetLink", () => {
  it("exige una URL https", () => {
    expect(validateMeetLink("https://meet.google.com/abc-defg-hij")).toBeNull();
    expect(validateMeetLink("https://zoom.us/j/123")).toBeNull();
    expect(validateMeetLink("http://meet.google.com/abc")).toMatch(/https/);
    expect(validateMeetLink("meet.google.com/abc")).toMatch(/https/);
    expect(validateMeetLink("javascript:alert(1)")).toMatch(/https/);
    expect(validateMeetLink("   ")).toMatch(/enlace/);
    expect(validateMeetLink(`https://x.com/${"a".repeat(600)}`)).toMatch(/500/);
  });
});

const slots: MeetingSlot[] = [
  { id: "s2", meetingId: "m", startsAt: "2026-10-09T20:00:00Z" },
  { id: "s1", meetingId: "m", startsAt: "2026-10-08T20:00:00Z" },
  { id: "s3", meetingId: "m", startsAt: "2026-10-10T20:00:00Z" },
];
const votes: SlotVote[] = [
  { slotId: "s1", userId: "a", available: true },
  { slotId: "s2", userId: "a", available: true },
  { slotId: "s3", userId: "a", available: false },
  { slotId: "s2", userId: "b", available: true },
  { slotId: "s1", userId: "b", available: false },
];

describe("slotAvailability", () => {
  it("ordena por más disponibilidad y, en empate, el más temprano", () => {
    const ranked = slotAvailability(slots, votes);
    expect(ranked.map((r) => r.slotId)).toEqual(["s2", "s1", "s3"]);
    expect(ranked[0]).toMatchObject({ yes: 2, no: 0 });
    expect(ranked[1]).toMatchObject({ yes: 1, no: 1 });
    expect(ranked[2]).toMatchObject({ yes: 0, no: 1 });
  });
  it("el más temprano gana el empate", () => {
    const tie = slotAvailability(slots, [
      { slotId: "s2", userId: "a", available: true },
      { slotId: "s1", userId: "a", available: true },
    ]);
    expect(tie.map((r) => r.slotId)).toEqual(["s1", "s2", "s3"]);
  });
  it("ignora votos de otros horarios", () => {
    expect(slotAvailability(slots, [{ slotId: "x", userId: "a", available: true }])[0].yes).toBe(0);
  });
});

describe("pendingVoters", () => {
  const members = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("lista a quien no respondió ningún horario", () => {
    expect(pendingVoters(members, votes).map((m) => m.id)).toEqual(["c"]);
  });
  it("con los horarios, exige responder todos", () => {
    expect(pendingVoters(members, votes, ["s1", "s2", "s3"]).map((m) => m.id)).toEqual(["b", "c"]);
  });
});

describe("isVoteReminderDue", () => {
  it("avisa a partir de 24 h desde la convocatoria", () => {
    const created = "2026-10-06T17:00:00Z";
    expect(isVoteReminderDue(created, NOW)).toBe(true);
    expect(isVoteReminderDue("2026-10-06T17:00:01Z", NOW)).toBe(false);
  });
});

const meeting = (id: string, week: string, status: Meeting["status"], attendeeIds: string[] = []): Meeting => ({
  id,
  week,
  status,
  confirmedSlotId: null,
  meetLink: null,
  attendeeIds,
  createdAt: "2026-09-01T00:00:00Z",
});

describe("consecutiveAbsences", () => {
  it("cuenta las ausencias seguidas más recientes entre reuniones realizadas", () => {
    const ms = [
      meeting("1", "2026-09-07", "held", ["u"]),
      meeting("2", "2026-09-14", "held", []),
      meeting("3", "2026-09-21", "held", []),
      meeting("4", "2026-09-28", "polling"),
    ];
    expect(consecutiveAbsences(ms, "u")).toBe(2);
    expect(consecutiveAbsences(ms, "other")).toBe(3);
  });
  it("una asistencia reciente reinicia la racha", () => {
    const ms = [meeting("1", "2026-09-07", "held", []), meeting("2", "2026-09-14", "held", ["u"])];
    expect(consecutiveAbsences(ms, "u")).toBe(0);
  });
  it("sin reuniones realizadas no hay ausencias", () => {
    expect(consecutiveAbsences([meeting("1", "2026-09-07", "polling")], "u")).toBe(0);
  });
});

describe("pickCurrentMeeting", () => {
  const thisWeek = "2026-10-05";
  it("prefiere la primera convocatoria no realizada desde esta semana", () => {
    const ms = [meeting("a", "2026-10-12", "polling"), meeting("b", thisWeek, "confirmed"), meeting("old", "2026-09-28", "held")];
    expect(pickCurrentMeeting(ms, thisWeek)?.id).toBe("b");
  });
  it("si la de esta semana ya se realizó, muestra la siguiente o, si no hay, la realizada", () => {
    const held = meeting("b", thisWeek, "held");
    expect(pickCurrentMeeting([held, meeting("a", "2026-10-12", "polling")], thisWeek)?.id).toBe("a");
    expect(pickCurrentMeeting([held], thisWeek)?.id).toBe("b");
  });
  it("ignora semanas pasadas y devuelve null sin convocatoria", () => {
    expect(pickCurrentMeeting([meeting("old", "2026-09-28", "polling")], thisWeek)).toBeNull();
    expect(pickCurrentMeeting([], thisWeek)).toBeNull();
  });
});
