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
  it("keeps expenses and team for both studio roles", () => {
    for (const role of ["admin", "partner"] as const)
      expect(navigationFor(role).map((item) => item.to)).toEqual(
        expect.arrayContaining(["/gastos", "/equipo"]),
      );
  });
});
