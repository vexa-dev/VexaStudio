import { describe, expect, it } from "vitest";
import {
  assignedMeetings,
  hasMeetingConflict,
  offsetDay,
  upcomingMeetings,
  type PlannedMeeting,
} from "./meeting-planner";

const meeting: PlannedMeeting = {
  id: "one",
  title: "Planificación",
  date: "2026-10-07",
  time: "23:45",
  duration: 45,
  participants: ["admin", "invited"],
  location: "",
  agenda: "",
  minutes: "",
  attendance: {},
  status: "scheduled",
};
describe("meeting planner", () => {
  it("shows only meetings assigned to a person", () => {
    expect(assignedMeetings([meeting], "outsider")).toEqual([]);
    expect(assignedMeetings([meeting], "invited")).toEqual([meeting]);
  });
  it("keeps an ongoing meeting and removes it once it ends", () => {
    expect(
      upcomingMeetings(
        [meeting],
        new Date("2026-10-08T00:00:00-05:00").getTime(),
      ),
    ).toHaveLength(1);
    expect(
      upcomingMeetings(
        [meeting],
        new Date("2026-10-08T00:30:00-05:00").getTime(),
      ),
    ).toHaveLength(0);
    expect(upcomingMeetings([{ ...meeting, status: "cancelled" }], 0)).toEqual(
      [],
    );
  });
  it("detects overlapping invitations across midnight but allows adjacent meetings", () => {
    expect(
      hasMeetingConflict([meeting], { date: "2026-10-08", time: "00:15" }, 30, [
        "invited",
      ]),
    ).toBe(true);
    expect(
      hasMeetingConflict([meeting], { date: "2026-10-08", time: "00:30" }, 30, [
        "invited",
      ]),
    ).toBe(false);
    expect(
      hasMeetingConflict([meeting], { date: "2026-10-08", time: "00:15" }, 30, [
        "other",
      ]),
    ).toBe(false);
    expect(
      hasMeetingConflict(
        [{ ...meeting, status: "cancelled" }],
        { date: "2026-10-08", time: "00:15" },
        30,
        ["invited"],
      ),
    ).toBe(false);
  });
  it("advances calendar dates across month and year boundaries in Lima", () => {
    expect(offsetDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(offsetDay("2026-03-01", -1)).toBe("2026-02-28");
  });
});
