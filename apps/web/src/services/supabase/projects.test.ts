import { describe, expect, it } from "vitest";
import { argsOf, fakeClient, ok } from "./fake-client";
import { createProjectService } from "./projects";

const row = {
  id: "p1",
  name: "Nuevo",
  type: "product",
  status: "active",
  created_at: "2026-10-03T17:00:00+00:00",
  updated_at: "2026-10-03T17:00:00+00:00",
};

describe("ProjectService de Supabase", () => {
  it("crea el proyecto con los miembros sin repetir", async () => {
    const { client, calls } = fakeClient({ rpc: { create_project: ok(row) } });
    const project = await createProjectService(client).create({
      name: "  Nuevo ",
      type: "product",
      status: "active",
      memberIds: ["a", "b", "a"],
    });
    expect(project).toEqual({
      id: "p1",
      name: "Nuevo",
      type: "product",
      status: "active",
      memberIds: ["a", "b"],
    });
    expect(argsOf(calls, "rpc:create_project", "call")[0][0]).toMatchObject({
      p_member_ids: ["a", "b"],
    });
  });

  it("exige el nombre antes de ir a la red", async () => {
    const { client, calls } = fakeClient();
    const service = createProjectService(client);
    await expect(
      service.create({ name: "  ", type: "client", status: "active" }),
    ).rejects.toThrow("Escribe el nombre del proyecto");
    await expect(service.update("p1", { name: "" })).rejects.toThrow(
      "Escribe el nombre del proyecto",
    );
    expect(calls).toHaveLength(0);
  });

  it("valida las etiquetas como el mock y guarda el color en minúsculas", async () => {
    const { client, calls } = fakeClient({
      tables: {
        project_labels: ok({
          id: "l1",
          project_id: "p1",
          name: "Bug",
          color: "#aabbcc",
          created_at: "2026-10-03T17:00:00+00:00",
          updated_at: "2026-10-03T17:00:00+00:00",
        }),
      },
    });
    const service = createProjectService(client);
    await expect(
      service.createLabel("p1", { name: "x".repeat(41), color: "#aabbcc" }),
    ).rejects.toThrow("Escribe un nombre de hasta 40 caracteres");
    await expect(
      service.createLabel("p1", { name: "Bug", color: "rojo" }),
    ).rejects.toThrow("Elige un color válido");
    await service.createLabel("p1", { name: " Bug ", color: "#AABBCC" });
    expect(argsOf(calls, "project_labels", "insert")[0][0]).toEqual({
      project_id: "p1",
      name: "Bug",
      color: "#aabbcc",
    });
  });

  it("un proyecto inaccesible se informa como en el mock", async () => {
    const { client } = fakeClient({ tables: { projects: ok(null) } });
    await expect(createProjectService(client).get("p9")).rejects.toThrow(
      "No tienes acceso a este proyecto",
    );
  });
});
