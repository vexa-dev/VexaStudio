import { describe, expect, it } from "vitest";
import {
  mfaCodeSchema,
  normalizeCodeInput,
  passwordFormSchema,
  profileFormSchema,
  qrImageSrc,
  resetPasswordSchema,
  toProfileInput,
} from "./schemas";

const validPassword = {
  currentPassword: "Actual-clave-1",
  newPassword: "Nueva-clave-2026",
  confirmPassword: "Nueva-clave-2026",
};

describe("profileFormSchema", () => {
  const base = { name: "Ana Pérez", username: "ana.perez", bio: "" };

  it("accepts a valid profile and lowercases the username", () => {
    const parsed = profileFormSchema.parse({ ...base, username: "Ana_P" });
    expect(parsed.username).toBe("ana_p");
  });

  it("requires a display name", () => {
    expect(profileFormSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
  });

  it("allows an empty username", () => {
    expect(profileFormSchema.safeParse({ ...base, username: "" }).success).toBe(true);
  });

  it.each(["ab", "a".repeat(31), "con espacio", "tilde-ñ", "guion-medio"])(
    "rejects username %s",
    (username) => {
      expect(profileFormSchema.safeParse({ ...base, username }).success).toBe(false);
    },
  );

  it("limits the bio to 280 characters", () => {
    expect(profileFormSchema.safeParse({ ...base, bio: "a".repeat(280) }).success).toBe(true);
    expect(profileFormSchema.safeParse({ ...base, bio: "a".repeat(281) }).success).toBe(false);
  });

  it("maps empty optional fields to null for the service", () => {
    expect(toProfileInput({ name: " Ana ", username: "", bio: "  " })).toEqual({
      name: "Ana",
      username: null,
      bio: null,
    });
  });
});

describe("passwordFormSchema", () => {
  it("accepts a strong, different and confirmed password", () => {
    expect(passwordFormSchema.safeParse(validPassword).success).toBe(true);
  });

  it.each([
    ["too short", "Abc12345"],
    ["no uppercase", "nueva-clave-2026"],
    ["no lowercase", "NUEVA-CLAVE-2026"],
    ["no digit", "Nueva-clave-segura"],
  ])("rejects a new password that is %s", (_, newPassword) => {
    const result = passwordFormSchema.safeParse({
      ...validPassword,
      newPassword,
      confirmPassword: newPassword,
    });
    expect(result.success).toBe(false);
  });

  it("requires the confirmation to match", () => {
    const result = passwordFormSchema.safeParse({ ...validPassword, confirmPassword: "otra" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("requires the new password to differ from the current one", () => {
    const result = passwordFormSchema.safeParse({
      currentPassword: "Nueva-clave-2026",
      newPassword: "Nueva-clave-2026",
      confirmPassword: "Nueva-clave-2026",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["newPassword"]);
  });

  it("requires the current password", () => {
    expect(passwordFormSchema.safeParse({ ...validPassword, currentPassword: "" }).success).toBe(
      false,
    );
  });
});

describe("mfaCodeSchema", () => {
  it("accepts exactly six digits", () => {
    expect(mfaCodeSchema.safeParse({ code: "123456" }).success).toBe(true);
  });
  it.each(["12345", "1234567", "12345a", ""])("rejects %s", (code) => {
    expect(mfaCodeSchema.safeParse({ code }).success).toBe(false);
  });
});

describe("normalizeCodeInput", () => {
  it("keeps only digits and caps at six", () => {
    expect(normalizeCodeInput("12 34-56 78")).toBe("123456");
  });
});

describe("qrImageSrc", () => {
  it("keeps a data URL untouched", () => {
    expect(qrImageSrc("data:image/svg+xml;utf-8,<svg/>")).toBe("data:image/svg+xml;utf-8,<svg/>");
  });
  it("wraps raw SVG markup into a data URL", () => {
    expect(qrImageSrc("<svg a='b'/>")).toBe(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent("<svg a='b'/>")}`,
    );
  });
  it("returns an empty string for anything else", () => {
    expect(qrImageSrc("javascript:alert(1)")).toBe("");
  });
});

describe("resetPasswordSchema", () => {
  const ok = { newPassword: "Nueva-clave-2026", confirmPassword: "Nueva-clave-2026" };

  it("acepta una contraseña fuerte y confirmada", () => {
    expect(resetPasswordSchema.safeParse(ok).success).toBe(true);
  });

  it.each(["Abc12345", "nueva-clave-2026", "NUEVA-CLAVE-2026", "Nueva-clave-segura"])(
    "rechaza %s por no cumplir la política",
    (newPassword) => {
      expect(resetPasswordSchema.safeParse({ newPassword, confirmPassword: newPassword }).success).toBe(false);
    },
  );

  it("exige que la confirmación coincida", () => {
    const result = resetPasswordSchema.safeParse({ ...ok, confirmPassword: "otra" });
    expect(result.success).toBe(false);
  });
});
