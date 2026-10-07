import { describe, expect, it } from "vitest";
import { validateInvite } from "@vexa/domain/member-admin";
import { parseInvite } from "../../../../../supabase/functions/members-admin/validate";
import { argsOf, fakeClient, ok, profileRow } from "./fake-client";
import { createMemberService } from "./members";

const resolver = { resolveMany: async (refs: unknown[]) => refs.map(() => null) } as never;
const row = (id: string, role: "admin" | "partner" | "collaborator" = "collaborator") => ({
  ...profileRow(role, id),
  avatar_path: null,
  banner_path: null,
});
const make = (spec: Parameters<typeof fakeClient>[0]) => {
  const fake = fakeClient(spec);
  return { ...fake, service: createMemberService(fake.client, resolver) };
};
const ID = "11111111-1111-4111-8111-111111111111";

describe("MemberService de Supabase: invite", () => {
  it("validates, calls the Edge Function with the normalized body and returns the pending profile", async () => {
    const { service, calls } = make({
      functions: { "members-admin": ok({ ok: true, memberId: ID, projectsAdded: true }) },
      tables: { profiles: ok(row(ID)) },
    });
    const profile = await service.invite!({ email: " A@B.co ", name: " Ana ", weeklyHours: 10, projectIds: [ID] });
    expect(profile).toMatchObject({ id: ID, pendingInvite: true });
    expect(argsOf(calls, "fn:members-admin", "invoke")[0]).toEqual([
      {
        body: {
          action: "invite",
          email: "a@b.co",
          name: "Ana",
          role: "collaborator",
          area: "technical",
          weeklyHours: 10,
          projectIds: [ID],
        },
      },
    ]);
  });

  it("rejects invalid input without calling the function", async () => {
    const { service, calls } = make({});
    await expect(service.invite!({ email: "x", name: "Ana" })).rejects.toThrow("correo");
    expect(calls.filter((c) => c.target.startsWith("fn:"))).toHaveLength(0);
  });

  it("surfaces the function's message and a partial project failure", async () => {
    const duplicated = make({
      functions: { "members-admin": ok({ ok: false, message: "Ya existe una cuenta con ese correo" }) },
    });
    await expect(duplicated.service.invite!({ email: "a@b.co", name: "Ana" })).rejects.toThrow("Ya existe");
    const partial = make({
      functions: { "members-admin": ok({ ok: true, memberId: ID, projectsAdded: false }) },
      tables: { profiles: ok(row(ID)) },
    });
    await expect(partial.service.invite!({ email: "a@b.co", name: "Ana" })).rejects.toThrow("proyectos");
  });

  it("reads the message of a non-2xx response", async () => {
    const response = new Response(JSON.stringify({ ok: false, message: "Solo un administrador gestiona al equipo" }), {
      status: 403,
    });
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      name: "FunctionsHttpError",
      context: response,
    });
    const { service } = make({ functions: { "members-admin": { data: null, error } as never } });
    await expect(service.invite!({ email: "a@b.co", name: "Ana" })).rejects.toThrow("administrador");
  });
});

describe("MemberService de Supabase: setRole y setActive", () => {
  it("calls set_member_role with the note", async () => {
    const { service, calls } = make({ rpc: { set_member_role: ok(row(ID, "partner")) } });
    expect((await service.setRole!(ID, "partner", " Votación ")).role).toBe("partner");
    expect(argsOf(calls, "rpc:set_member_role", "call")[0]).toEqual([
      { p_member: ID, p_role: "partner", p_note: "Votación" },
    ]);
  });

  it("maps the SQL guard messages to Spanish with accents", async () => {
    const { service } = make({
      rpc: { set_member_role: { data: null, error: { message: "Debe quedar al menos un administrador activo", code: "23514" } } },
    });
    await expect(service.setRole!(ID, "partner")).rejects.toThrow("Debe quedar al menos un administrador activo");
    const denied = make({
      rpc: { set_member_active: { data: null, error: { message: "Escribe el motivo de la desactivacion", code: "23514" } } },
    });
    await expect(denied.service.setActive!(ID, false, "x")).rejects.toThrow("Escribe el motivo de la desactivación");
  });

  it("requires a reason, then revokes sessions after deactivating and restores access after reactivating", async () => {
    const off = make({
      rpc: { set_member_active: ok({ ...row(ID), active: false }) },
      functions: { "members-admin": ok({ ok: true }) },
    });
    await expect(off.service.setActive!(ID, false, "  ")).rejects.toThrow("motivo");
    expect((await off.service.setActive!(ID, false, " Se fue ")).active).toBe(false);
    expect(argsOf(off.calls, "rpc:set_member_active", "call")[0]).toEqual([
      { p_member: ID, p_active: false, p_reason: "Se fue" },
    ]);
    expect(argsOf(off.calls, "fn:members-admin", "invoke")[0]).toEqual([
      { body: { action: "revoke-sessions", memberId: ID } },
    ]);
    const on = make({ rpc: { set_member_active: ok(row(ID)) }, functions: { "members-admin": ok({ ok: true }) } });
    await on.service.setActive!(ID, true);
    expect(argsOf(on.calls, "fn:members-admin", "invoke")[0]).toEqual([
      { body: { action: "restore-access", memberId: ID } },
    ]);
  });

  it("reports a failed session revocation honestly", async () => {
    const { service } = make({
      rpc: { set_member_active: ok({ ...row(ID), active: false }) },
      functions: { "members-admin": ok({ ok: false, message: "x" }) },
    });
    await expect(service.setActive!(ID, false, "Se fue")).rejects.toThrow("quedó desactivada");
  });
});

describe("paridad entre el dominio y la Edge Function", () => {
  const cases: Record<string, unknown>[] = [
    { email: "a@b.co", name: "Ana" },
    { email: "  A@B.CO ", name: " Ana ", weeklyHours: 60, area: "commercial", projectIds: [ID] },
    { email: "no", name: "Ana" },
    { email: "a@b.co", name: "" },
    { email: "a@b.co", name: "x".repeat(81) },
    { email: "a@b.co", name: "Ana", role: "partner" },
    { email: "a@b.co", name: "Ana", role: "admin" },
    { email: "a@b.co", name: "Ana", area: "legal" },
    { email: "a@b.co", name: "Ana", weeklyHours: -1 },
    { email: "a@b.co", name: "Ana", weeklyHours: 61 },
    { email: "a@b.co", name: "Ana", projectIds: [ID, ID] },
    { email: "a@b.co", name: "Ana", projectIds: Array.from({ length: 21 }, () => ID) },
  ];
  it.each(cases.map((c, i) => [i, c] as const))("case %i gives the same verdict and values", (_i, input) => {
    const domain = validateInvite(input as never);
    const edge = parseInvite(input);
    expect(edge.ok).toBe(domain.ok);
    if (domain.ok && edge.ok) expect(edge.value).toEqual(domain.value);
    if (!domain.ok && !edge.ok) expect(edge.message).toBe(domain.message);
  });
});
