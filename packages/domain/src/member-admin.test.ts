import { describe, expect, it } from "vitest";
import {
  MEMBER_ADMIN_MESSAGES,
  checkRoleChange,
  checkSetActive,
  roleConfirmationText,
  validateInvite,
} from "./member-admin";

const admin = { id: "u-admin", role: "admin" as const, active: true };
const partner = { id: "u-partner", role: "partner" as const, active: true };
const collab = { id: "u-collab", role: "collaborator" as const, active: true };
const otherAdmin = { id: "u-admin2", role: "admin" as const, active: true };

describe("validateInvite", () => {
  it("normalizes email, trims name and defaults the role to collaborator", () => {
    const result = validateInvite({ email: "  Ana@Vexa.PE ", name: "  Ana Pérez ", weeklyHours: 10 });
    expect(result).toEqual({
      ok: true,
      value: {
        email: "ana@vexa.pe",
        name: "Ana Pérez",
        role: "collaborator",
        area: "technical",
        weeklyHours: 10,
        projectIds: [],
      },
    });
  });

  it("rejects an invalid email, a short or long name and out-of-range hours", () => {
    expect(validateInvite({ email: "nope", name: "Ana" })).toMatchObject({ ok: false });
    expect(validateInvite({ email: "a@b.co", name: " " })).toMatchObject({ ok: false });
    expect(validateInvite({ email: "a@b.co", name: "x".repeat(81) })).toMatchObject({ ok: false });
    expect(validateInvite({ email: "a@b.co", name: "Ana", weeklyHours: -1 })).toMatchObject({ ok: false });
    expect(validateInvite({ email: "a@b.co", name: "Ana", weeklyHours: 61 })).toMatchObject({ ok: false });
    expect(validateInvite({ email: "a@b.co", name: "Ana", weeklyHours: Number.NaN })).toMatchObject({ ok: false });
  });

  it("never allows inviting a partner or an admin", () => {
    for (const role of ["partner", "admin", "root"]) {
      const result = validateInvite({ email: "a@b.co", name: "Ana", role });
      expect(result).toEqual({ ok: false, message: MEMBER_ADMIN_MESSAGES.roleNotInvitable });
    }
  });

  it("rejects an unknown area and repeated or malformed project ids", () => {
    expect(validateInvite({ email: "a@b.co", name: "Ana", area: "legal" })).toMatchObject({ ok: false });
    expect(validateInvite({ email: "a@b.co", name: "Ana", projectIds: ["p-1", "p-1"] })).toMatchObject({
      ok: false,
    });
    expect(validateInvite({ email: "a@b.co", name: "Ana", projectIds: [""] })).toMatchObject({ ok: false });
    const many = Array.from({ length: 21 }, (_, i) => `p-${i}`);
    expect(validateInvite({ email: "a@b.co", name: "Ana", projectIds: many })).toMatchObject({ ok: false });
  });
});

describe("checkRoleChange", () => {
  it("lets an admin change another member's role", () => {
    expect(checkRoleChange({ actor: admin, target: collab, role: "partner", activeAdminCount: 1 })).toBeNull();
  });
  it("refuses non-admins, self changes and inactive targets", () => {
    expect(checkRoleChange({ actor: partner, target: collab, role: "partner", activeAdminCount: 1 })).toBe(
      MEMBER_ADMIN_MESSAGES.adminOnly,
    );
    expect(checkRoleChange({ actor: admin, target: admin, role: "partner", activeAdminCount: 2 })).toBe(
      MEMBER_ADMIN_MESSAGES.selfRole,
    );
    expect(
      checkRoleChange({ actor: admin, target: { ...collab, active: false }, role: "partner", activeAdminCount: 1 }),
    ).toBe(MEMBER_ADMIN_MESSAGES.targetInactive);
  });
  it("protects the last active admin", () => {
    expect(checkRoleChange({ actor: admin, target: otherAdmin, role: "partner", activeAdminCount: 1 })).toBe(
      MEMBER_ADMIN_MESSAGES.lastAdmin,
    );
    expect(checkRoleChange({ actor: admin, target: otherAdmin, role: "partner", activeAdminCount: 2 })).toBeNull();
  });
});

describe("checkSetActive", () => {
  it("requires a reason to deactivate but not to reactivate", () => {
    expect(checkSetActive({ actor: admin, target: collab, active: false, reason: " ", activeAdminCount: 1 })).toBe(
      MEMBER_ADMIN_MESSAGES.reasonRequired,
    );
    expect(
      checkSetActive({ actor: admin, target: collab, active: false, reason: "Dejó el equipo", activeAdminCount: 1 }),
    ).toBeNull();
    expect(
      checkSetActive({ actor: admin, target: { ...collab, active: false }, active: true, activeAdminCount: 1 }),
    ).toBeNull();
  });
  it("refuses self deactivation, non-admins and the last admin", () => {
    expect(checkSetActive({ actor: admin, target: admin, active: false, reason: "x", activeAdminCount: 2 })).toBe(
      MEMBER_ADMIN_MESSAGES.selfDeactivate,
    );
    expect(checkSetActive({ actor: collab, target: partner, active: false, reason: "x", activeAdminCount: 1 })).toBe(
      MEMBER_ADMIN_MESSAGES.adminOnly,
    );
    expect(checkSetActive({ actor: admin, target: otherAdmin, active: false, reason: "x", activeAdminCount: 1 })).toBe(
      MEMBER_ADMIN_MESSAGES.lastAdmin,
    );
  });
  it("limits the reason to 280 characters", () => {
    expect(
      checkSetActive({ actor: admin, target: collab, active: false, reason: "x".repeat(281), activeAdminCount: 1 }),
    ).toBe(MEMBER_ADMIN_MESSAGES.reasonTooLong);
  });
});

describe("roleConfirmationText", () => {
  it("is the upper-case role label the admin must type", () => {
    expect(roleConfirmationText("admin")).toBe("ADMINISTRADOR");
    expect(roleConfirmationText("partner")).toBe("SOCIO");
    expect(roleConfirmationText("collaborator")).toBe("COLABORADOR");
  });
});
