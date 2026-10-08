import { describe, expect, it } from "vitest";
import { navigationFor } from "./nav";

describe("role navigation", () => {
  it("shows five personal destinations for a collaborator", () => {
    expect(navigationFor("collaborator").map((item) => item.to)).toEqual([
      "/",
      "/mi-dia",
      "/proyectos",
      "/tareas",
      "/horas",
    ]);
    expect(
      navigationFor("collaborator").filter((item) => item.mobile),
    ).toHaveLength(5);
  });
  it("keeps team for studio roles and expenses only for admins", () => {
    for (const role of ["admin", "partner"] as const)
      expect(navigationFor(role).map((item) => item.to)).toEqual(
        expect.arrayContaining(["/equipo"]),
      );
    expect(navigationFor("admin").map((item) => item.to)).toContain("/gastos");
    expect(navigationFor("admin").map((item) => item.to)).toContain("/reuniones");
    expect(navigationFor("partner").map((item) => item.to)).not.toContain("/reuniones");
    expect(navigationFor("partner").map((item) => item.to)).not.toContain(
      "/gastos",
    );
  });
  it("limits activity to studio roles and keeps it out of the bottom bar", () => {
    for (const role of ["admin", "partner"] as const)
      expect(navigationFor(role).map((item) => item.to)).toContain(
        "/actividad",
      );
    expect(navigationFor("collaborator").map((item) => item.to)).not.toContain(
      "/actividad",
    );
    expect(navigationFor(undefined).map((item) => item.to)).not.toContain(
      "/actividad",
    );
    expect(
      navigationFor("admin").find((item) => item.to === "/actividad")?.mobile,
    ).toBe(false);
  });
});
