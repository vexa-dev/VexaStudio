import { describe, it, expect } from "vitest";
import { participantsSchema } from "./schemas";

const schema = participantsSchema("owner");
const ok = (value: unknown) => schema.safeParse(value).success;

describe("participantsSchema", () => {
  it("acepta una lista vacía y porcentajes enteros de 1 a 100", () => {
    expect(ok([])).toBe(true);
    expect(
      ok([
        { userId: "a", sharePercent: 1 },
        { userId: "b", sharePercent: 100 },
      ]),
    ).toBe(true);
  });
  it("rechaza porcentajes fuera de rango o con decimales", () => {
    expect(ok([{ userId: "a", sharePercent: 0 }])).toBe(false);
    expect(ok([{ userId: "a", sharePercent: 101 }])).toBe(false);
    expect(ok([{ userId: "a", sharePercent: 50.5 }])).toBe(false);
    expect(ok([{ userId: "a", sharePercent: Number.NaN }])).toBe(false);
  });
  it("rechaza etiquetarse a uno mismo y repetidos", () => {
    const self = schema.safeParse([{ userId: "owner", sharePercent: 100 }]);
    expect(self.success).toBe(false);
    const dup = schema.safeParse([
      { userId: "a", sharePercent: 100 },
      { userId: "a", sharePercent: 50 },
    ]);
    expect(dup.success).toBe(false);
    if (!dup.success) expect(dup.error.issues[0].path).toEqual([1, "userId"]);
  });
  it("limita a 10 personas", () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, sharePercent: 100 }));
    expect(ok(many(10))).toBe(true);
    expect(ok(many(11))).toBe(false);
  });
});
