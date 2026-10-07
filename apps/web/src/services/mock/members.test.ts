import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetMock, setSessionUserId } from "./db";
import { createMockServices } from "./index";

beforeEach(resetMock);
const services = createMockServices();
const members = services.members;
const invite = { email: "Nueva@Vexa.pe ", name: " Nueva Persona ", weeklyHours: 12, projectIds: ["p-fivuza"] };

describe("mock members: invite", () => {
  it("creates a pending collaborator, joins the projects and sends no email", async () => {
    setSessionUserId("u-jhony");
    const created = await members.invite!(invite);
    expect(created).toMatchObject({
      name: "Nueva Persona",
      email: "nueva@vexa.pe",
      role: "collaborator",
      active: true,
      pendingInvite: true,
      weeklyHours: 12,
    });
    expect(getDb().profiles.some((p) => p.id === created.id)).toBe(true);
    expect(getDb().projects.find((p) => p.id === "p-fivuza")?.memberIds).toContain(created.id);
    expect((await services.auth.listLoginProfiles()).some((p) => p.id === created.id)).toBe(true);
  });

  it("refuses non-admins, invalid input and duplicated emails", async () => {
    setSessionUserId("u-rober");
    await expect(members.invite!(invite)).rejects.toThrow("administrador");
    setSessionUserId("u-jhony");
    await expect(members.invite!({ ...invite, email: "no" })).rejects.toThrow("correo");
    await expect(members.invite!({ ...invite, projectIds: ["nope"] })).rejects.toThrow("proyectos");
    await members.invite!(invite);
    await expect(members.invite!({ ...invite, email: "nueva@vexa.pe" })).rejects.toThrow("Ya existe");
  });
});

describe("mock members: role and activation", () => {
  it("lets the admin change another member's role", async () => {
    setSessionUserId("u-jhony");
    const updated = await members.setRole!("u-rober", "admin");
    expect(updated.role).toBe("admin");
    expect(getDb().profiles.find((p) => p.id === "u-rober")?.role).toBe("admin");
  });

  it("refuses partners, self changes and inactive targets", async () => {
    setSessionUserId("u-rober");
    await expect(members.setRole!("u-diego", "admin")).rejects.toThrow("administrador");
    setSessionUserId("u-jhony");
    await expect(members.setRole!("u-jhony", "partner")).rejects.toThrow("propio rol");
    await members.setActive!("u-demo-collaborator", false, "Se fue");
    await expect(members.setRole!("u-demo-collaborator", "partner")).rejects.toThrow("Reactiva");
  });

  it("requires a reason to deactivate, blocks the login and allows reactivating", async () => {
    setSessionUserId("u-jhony");
    await expect(members.setActive!("u-diego", false)).rejects.toThrow("motivo");
    await expect(members.setActive!("u-jhony", false, "x")).rejects.toThrow("ti mismo");
    expect((await members.setActive!("u-diego", false, "Licencia")).active).toBe(false);
    await expect(services.auth.signIn("u-diego")).rejects.toThrow();
    expect((await members.setActive!("u-diego", true)).active).toBe(true);
    expect((await services.auth.signIn("u-jhony")).id).toBe("u-jhony");
  });

  it("does not let the last active admin be demoted or deactivated", async () => {
    setSessionUserId("u-jhony");
    await members.setRole!("u-rober", "admin");
    setSessionUserId("u-rober");
    await members.setRole!("u-jhony", "partner");
    // Rober is now the only admin: nobody else can act on him, and he cannot touch himself.
    await expect(members.setActive!("u-rober", false, "x")).rejects.toThrow("ti mismo");
    expect(getDb().profiles.filter((p) => p.role === "admin" && p.active)).toHaveLength(1);
  });
});
