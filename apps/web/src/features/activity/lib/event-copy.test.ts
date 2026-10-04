import { describe, expect, it } from "vitest";
import { AUDIT_EVENT_TYPES, type AuditLogEntry } from "@vexa/domain/audit";
import {
  CATEGORY_EVENT_TYPES,
  categoryLabel,
  eventCategory,
  eventIcon,
  eventPhrase,
  timeOfDay,
  type EventCategory,
} from "./event-copy";

function entry(patch: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: "au-1",
    seq: 1,
    occurredAt: "2026-10-02T15:04:05.000Z",
    clientAt: null,
    actorId: "u1",
    actorRole: "partner",
    eventType: "task.created",
    entity: {
      table: "tasks",
      id: "t1",
      projectId: "p1",
      label: "Diseñar login",
    },
    changes: [],
    before: null,
    after: null,
    reason: null,
    requestId: "r1",
    sessionId: "s1",
    client: { platform: "web", appVersion: "0.0.0" },
    ...patch,
  };
}

const ctx = { actorName: "Rober" };

describe("event metadata", () => {
  it("gives every declared event type a category, an icon and a phrase", () => {
    for (const eventType of AUDIT_EVENT_TYPES) {
      expect(categoryLabel[eventCategory(eventType)]).toBeTruthy();
      expect(eventIcon(eventType)).toBeTruthy();
      const phrase = eventPhrase(entry({ eventType }), ctx);
      expect(phrase.startsWith("Rober ")).toBe(true);
      expect(phrase.length).toBeGreaterThan(8);
    }
  });
  it("partitions all event types across the category filters", () => {
    const all = Object.values(CATEGORY_EVENT_TYPES).flat();
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...AUDIT_EVENT_TYPES].sort());
  });
  it("maps types to the expected categories", () => {
    const expected: Record<string, EventCategory> = {
      "task.moved": "tasks",
      "hours.voided": "hours",
      "timer.recovered": "timer",
      "project_label.created": "projects",
      "sprint.created": "projects",
      "member.role_changed": "team",
      "settings.changed": "system",
    };
    for (const [type, category] of Object.entries(expected))
      expect(eventCategory(type as never)).toBe(category);
  });
  it("falls back to the system category for an unknown type", () => {
    expect(eventCategory("future.thing" as never)).toBe("system");
  });
});

describe("eventPhrase", () => {
  it("describes a task move with both statuses", () => {
    const phrase = eventPhrase(
      entry({
        eventType: "task.moved",
        changes: [{ field: "status", from: "in_progress", to: "review" }],
      }),
      ctx,
    );
    expect(phrase).toBe(
      "Rober movió «Diseñar login» de En progreso a En revisión",
    );
  });
  it("names the new assignee", () => {
    const phrase = eventPhrase(
      entry({
        eventType: "task.assigned",
        changes: [{ field: "assigneeId", from: null, to: "u2" }],
      }),
      { actorName: "Rober", memberName: (id) => (id === "u2" ? "Diego" : undefined) },
    );
    expect(phrase).toBe("Rober asignó «Diseñar login» a Diego");
  });
  it("lists edited fields", () => {
    const phrase = eventPhrase(
      entry({
        eventType: "task.edited",
        changes: [
          { field: "title", from: "a", to: "b" },
          { field: "estimateHours", from: 1, to: 2 },
        ],
      }),
      ctx,
    );
    expect(phrase).toBe(
      "Rober editó la tarea «Diseñar login» (Título, Estimación (h))",
    );
  });
  it("includes the hours in a new time entry", () => {
    const phrase = eventPhrase(
      entry({
        eventType: "hours.created",
        entity: { table: "time_entries", id: "e1", projectId: null, label: "Revisión" },
        changes: [{ field: "hours", from: null, to: 1.5 }],
      }),
      ctx,
    );
    expect(phrase).toBe("Rober registró 1.5 h en «Revisión»");
  });
  it("omits the quoted name when the label is empty", () => {
    const phrase = eventPhrase(
      entry({
        eventType: "task.created",
        entity: { table: "tasks", id: "t1", projectId: null, label: "" },
      }),
      ctx,
    );
    expect(phrase).toBe("Rober creó una tarea");
  });
  it("covers an unknown event type without throwing", () => {
    const phrase = eventPhrase(
      entry({ eventType: "future.thing" as never }),
      ctx,
    );
    expect(phrase).toBe("Rober registró «future.thing» en «Diseñar login»");
  });
});

describe("timeOfDay", () => {
  it("shows HH:mm:ss in Lima", () => {
    expect(timeOfDay("2026-10-02T15:04:05.000Z")).toBe("10:04:05");
    expect(timeOfDay("2026-10-03T04:59:59.000Z")).toBe("23:59:59");
  });
});
