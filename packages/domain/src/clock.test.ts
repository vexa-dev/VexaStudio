import { describe, expect, it } from "vitest";
import {
  angleFromPoint,
  angleToHour12,
  angleToMinute,
  formatClockLabel,
  formatClockTime,
  from12h,
  hourToAngle,
  limaInstant,
  minuteToAngle,
  parseClockTime,
  snapMinute,
  to12h,
} from "./clock";

describe("12 hour conversion", () => {
  it("maps midnight and noon correctly", () => {
    expect(to12h(0)).toEqual({ hour12: 12, meridiem: "am" });
    expect(to12h(12)).toEqual({ hour12: 12, meridiem: "pm" });
    expect(to12h(9)).toEqual({ hour12: 9, meridiem: "am" });
    expect(to12h(23)).toEqual({ hour12: 11, meridiem: "pm" });
  });

  it("round-trips every hour of the day", () => {
    for (let h = 0; h < 24; h++) {
      const { hour12, meridiem } = to12h(h);
      expect(from12h(hour12, meridiem)).toBe(h);
    }
  });
});

describe("angles", () => {
  it("places the minute hand six degrees per minute", () => {
    expect(minuteToAngle(0)).toBe(0);
    expect(minuteToAngle(15)).toBe(90);
    expect(minuteToAngle(45)).toBe(270);
  });

  it("moves the hour hand with the minutes", () => {
    expect(hourToAngle(3, 0)).toBe(90);
    expect(hourToAngle(12, 0)).toBe(0);
    expect(hourToAngle(6, 30)).toBe(195);
  });

  it("reads the angle of a point clockwise from twelve o'clock", () => {
    expect(angleFromPoint(0, 0, 0, -10)).toBe(0);
    expect(angleFromPoint(0, 0, 10, 0)).toBe(90);
    expect(angleFromPoint(0, 0, 0, 10)).toBe(180);
    expect(angleFromPoint(0, 0, -10, 0)).toBe(270);
  });

  it("turns an angle into a minute, wrapping at sixty", () => {
    expect(angleToMinute(90)).toBe(15);
    expect(angleToMinute(359)).toBe(0);
    expect(angleToMinute(93, 1)).toBe(16);
    expect(angleToMinute(93, 5)).toBe(15);
  });

  it("turns an angle into an hour, ignoring the drift caused by the minutes", () => {
    expect(angleToHour12(90)).toBe(3);
    expect(angleToHour12(0)).toBe(12);
    expect(angleToHour12(359)).toBe(12);
    // At 6:30 the hour hand rests at 195 degrees and must still read as 6.
    expect(angleToHour12(195, 30)).toBe(6);
  });
});

describe("snapMinute", () => {
  it("rounds to the chosen step and wraps at sixty", () => {
    expect(snapMinute(7, 5)).toBe(5);
    expect(snapMinute(8, 5)).toBe(10);
    expect(snapMinute(58, 5)).toBe(0);
    expect(snapMinute(33, 1)).toBe(33);
  });
});

describe("clock strings", () => {
  it("formats and parses HH:mm", () => {
    expect(formatClockTime({ hour24: 9, minute: 5 })).toBe("09:05");
    expect(parseClockTime("14:30")).toEqual({ hour24: 14, minute: 30 });
    expect(parseClockTime("09:00")).toEqual({ hour24: 9, minute: 0 });
  });

  it("rejects invalid times", () => {
    expect(parseClockTime("")).toBeNull();
    expect(parseClockTime("24:00")).toBeNull();
    expect(parseClockTime("12:60")).toBeNull();
    expect(parseClockTime("9am")).toBeNull();
  });

  it("writes a friendly Spanish label", () => {
    expect(formatClockLabel({ hour24: 9, minute: 0 })).toBe("9:00 a. m.");
    expect(formatClockLabel({ hour24: 0, minute: 5 })).toBe("12:05 a. m.");
    expect(formatClockLabel({ hour24: 15, minute: 45 })).toBe("3:45 p. m.");
  });
});

describe("limaInstant", () => {
  it("uses the fixed UTC-5 offset of Lima", () => {
    expect(limaInstant("2026-10-05", { hour24: 9, minute: 0 }).toISOString()).toBe(
      "2026-10-05T14:00:00.000Z",
    );
  });

  it("rolls over to the next UTC day late in the evening", () => {
    expect(limaInstant("2026-10-05", { hour24: 22, minute: 30 }).toISOString()).toBe(
      "2026-10-06T03:30:00.000Z",
    );
  });
});
