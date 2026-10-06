import { describe, expect, it } from "vitest";
import type { Notification } from "@vexa/domain/types";
import { withRead } from "./useNotifications";

const item = (id: string, read: boolean): Notification => ({
  id,
  userId: "u1",
  type: "mention",
  payload: {},
  read,
  createdAt: "2026-10-05T15:00:00.000Z",
});

describe("withRead", () => {
  const items = [item("a", false), item("b", false), item("c", true)];

  it("marca solo los ids indicados", () => {
    expect(withRead(items, new Set(["b"])).map((n) => n.read)).toEqual([false, true, true]);
  });

  it("sin ids marca todos", () => {
    expect(withRead(items).every((n) => n.read)).toBe(true);
  });

  it("no modifica la lista original", () => {
    withRead(items);
    expect(items[0].read).toBe(false);
  });
});
