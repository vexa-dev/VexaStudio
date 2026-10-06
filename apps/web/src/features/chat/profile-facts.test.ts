import { describe, expect, it } from "vitest";
import type { Profile } from "@vexa/domain/types";
import { profileChips, profileFacts } from "./profile-facts";

const base: Profile = {
  id: "p1",
  name: "Rober Vasquez",
  email: "rober@vexa.test",
  role: "partner",
  area: "technical",
  weeklyHours: 20,
  active: true,
  joinedAt: "2026-03-10T15:00:00.000Z",
} as Profile;

function map(facts: { key: string; value: string }[]) {
  return Object.fromEntries(facts.map((f) => [f.key, f.value]));
}

describe("profileFacts", () => {
  it("lists every fact in order for a complete profile", () => {
    const facts = profileFacts(base, { online: true });
    expect(facts.map((f) => f.key)).toEqual([
      "weekly",
      "since",
      "account",
      "presence",
    ]);
    expect(facts.map((f) => f.label)).toEqual([
      "Compromiso semanal",
      "Miembro desde",
      "Cuenta",
      "Conexión",
    ]);
    const values = map(facts);
    expect(values.weekly).toBe("20 h por semana");
    expect(values.since).toBe("10/03/2026");
    expect(values.account).toBe("Activo");
    expect(values.presence).toBe("En línea");
  });

  it("keeps role and area out of the facts", () => {
    const keys = profileFacts(base, { online: true }).map((f) => f.key);
    expect(keys).not.toContain("role");
    expect(keys).not.toContain("area");
  });

  it("omits Miembro desde when joinedAt is missing", () => {
    const facts = profileFacts(
      { ...base, joinedAt: undefined },
      { online: true },
    );
    expect(facts.some((f) => f.key === "since")).toBe(false);
  });

  it("uses the Lima calendar day", () => {
    const before = profileFacts(
      { ...base, joinedAt: "2026-01-15T03:00:00Z" },
      { online: false },
    );
    const after = profileFacts(
      { ...base, joinedAt: "2026-01-15T05:00:00Z" },
      { online: false },
    );
    expect(map(before).since).toBe("14/01/2026");
    expect(map(after).since).toBe("15/01/2026");
  });

  it("marks an inactive account", () => {
    expect(
      map(profileFacts({ ...base, active: false }, { online: true })).account,
    ).toBe("Inactivo");
  });

  it("marks an offline person", () => {
    expect(map(profileFacts(base, { online: false })).presence).toBe(
      "Sin conexión",
    );
  });
});

describe("profileChips", () => {
  it("returns the role and area labels", () => {
    expect(profileChips(base)).toEqual({
      role: "Socio",
      area: "Líder técnico",
    });
  });
});
