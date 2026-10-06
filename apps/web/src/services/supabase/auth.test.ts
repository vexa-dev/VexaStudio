import { describe, expect, it, vi } from "vitest";
import type { VexaSupabase } from "@/lib/supabase";
import { MfaRequiredError, createAuthService, toAuthError } from "./auth";

const profileRow = {
  id: "u1",
  name: "Jhony",
  role: "admin",
  area: "management_finance",
  weekly_hours: 15,
  active: true,
  created_at: "2026-10-03T17:00:00+00:00",
  updated_at: "2026-10-03T17:00:00+00:00",
};

/** Cliente mínimo: solo lo que usa el servicio de acceso. */
function fakeClient(options: {
  session?: boolean;
  profile?: typeof profileRow | null;
  signIn?: { error: { message: string; code?: string; status?: number } | null };
}) {
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: options.session ? { user: { id: "u1" } } : null },
      }),
      signInWithPassword: vi.fn().mockResolvedValue(
        options.signIn?.error
          ? { data: { user: null }, error: options.signIn.error }
          : { data: { user: { id: "u1" } }, error: null },
      ),
      signOut,
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: "aal1", nextLevel: "aal1" },
          error: null,
        }),
        listFactors: vi.fn().mockResolvedValue({ data: { all: [], totp: [] }, error: null }),
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: options.profile ?? null, error: null }),
        }),
      }),
    }),
  } as unknown as VexaSupabase;
  return { client, signOut };
}

describe("toAuthError", () => {
  it("explica las credenciales incorrectas", () => {
    expect(
      toAuthError({ message: "Invalid login credentials", code: "invalid_credentials" })
        .message,
    ).toBe("Correo o contraseña incorrectos");
  });

  it("explica el límite de intentos", () => {
    expect(toAuthError({ message: "x", status: 429 }).message).toBe(
      "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    );
  });
});

describe("AuthService de Supabase", () => {
  it("sin sesión no hay perfil", async () => {
    const { client } = fakeClient({ session: false });
    expect(await createAuthService(client).getSession()).toBeNull();
  });

  it("restaura la sesión con el perfil del dominio", async () => {
    const { client } = fakeClient({ session: true, profile: profileRow });
    expect(await createAuthService(client).getSession()).toMatchObject({
      id: "u1",
      weeklyHours: 15,
      role: "admin",
    });
  });

  it("cierra la sesión si el perfil ya no está activo", async () => {
    const { client, signOut } = fakeClient({ session: true, profile: null });
    expect(await createAuthService(client).getSession()).toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("entra con correo y contraseña", async () => {
    const { client } = fakeClient({ profile: profileRow });
    const profile = await createAuthService(client).signInWithPassword(
      " jhony@vexa.test ",
      "secreto",
    );
    expect(profile.name).toBe("Jhony");
    expect(
      (client.auth.signInWithPassword as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toEqual({ email: "jhony@vexa.test", password: "secreto" });
  });

  it("traduce un error de credenciales", async () => {
    const { client } = fakeClient({
      signIn: { error: { message: "Invalid login credentials", code: "invalid_credentials" } },
    });
    await expect(
      createAuthService(client).signInWithPassword("a@b.c", "mal"),
    ).rejects.toThrow("Correo o contraseña incorrectos");
  });

  it("una cuenta sin perfil activo no entra", async () => {
    const { client, signOut } = fakeClient({ profile: null });
    await expect(
      createAuthService(client).signInWithPassword("a@b.c", "x"),
    ).rejects.toThrow("desactivada");
    expect(signOut).toHaveBeenCalled();
  });

  it("no permite elegir un perfil ni lista perfiles sin sesión", async () => {
    const { client } = fakeClient({});
    const auth = createAuthService(client);
    expect(await auth.listLoginProfiles()).toEqual([]);
    await expect(auth.signIn("u1")).rejects.toThrow("correo y contraseña");
  });
});

interface AuthSpy {
  getSession: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  mfa: {
    getAuthenticatorAssuranceLevel: ReturnType<typeof vi.fn>;
    listFactors: ReturnType<typeof vi.fn>;
    enroll: ReturnType<typeof vi.fn>;
    challengeAndVerify: ReturnType<typeof vi.fn>;
    unenroll: ReturnType<typeof vi.fn>;
  };
}

const factor = (id: string, status: "verified" | "unverified") => ({
  id,
  friendly_name: "Vexa Studio",
  factor_type: "totp",
  status,
  created_at: "2026-10-06T10:00:00Z",
  updated_at: "2026-10-06T10:00:00Z",
});

/** Cliente con lo necesario para el perfil propio, la contraseña y el segundo paso. */
function richClient(options: {
  levels?: { currentLevel: string; nextLevel: string };
  factors?: ReturnType<typeof factor>[];
  rpcRow?: Record<string, unknown> | null;
  rpcError?: { message: string; code?: string } | null;
  profile?: typeof profileRow | null;
} = {}) {
  const factors = options.factors ?? [];
  const auth: AuthSpy = {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { user: { id: "u1", email: "jhony@vexa.test" } } },
    }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    mfa: {
      getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
        data: options.levels ?? { currentLevel: "aal1", nextLevel: "aal1" },
        error: null,
      }),
      listFactors: vi.fn().mockResolvedValue({
        data: { all: factors, totp: factors.filter((f) => f.status === "verified") },
        error: null,
      }),
      enroll: vi.fn().mockResolvedValue({
        data: {
          id: "f-new",
          totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DP", uri: "otpauth://totp/x" },
        },
        error: null,
      }),
      challengeAndVerify: vi.fn().mockResolvedValue({ data: {}, error: null }),
      unenroll: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  };
  const rpc = vi.fn().mockResolvedValue({
    data: options.rpcRow === undefined ? { ...profileRow, username: "jhony", bio: "Hola" } : options.rpcRow,
    error: options.rpcError ?? null,
  });
  const client = {
    auth,
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: options.profile === undefined ? profileRow : options.profile,
              error: null,
            }),
        }),
      }),
    }),
  } as unknown as VexaSupabase;
  return { client, auth, rpc };
}

describe("updateProfile", () => {
  it("llama al RPC con nombre, usuario y bio y devuelve el perfil", async () => {
    const { client, rpc } = richClient();
    const profile = await createAuthService(client).updateProfile({
      name: "Jhony",
      username: "jhony",
      bio: "Hola",
    });
    expect(rpc).toHaveBeenCalledWith("update_my_profile", {
      p_name: "Jhony",
      p_username: "jhony",
      p_bio: "Hola",
    });
    expect(profile).toMatchObject({ id: "u1", username: "jhony", bio: "Hola" });
  });

  it("usuario y bio vacíos viajan como indefinidos", async () => {
    const { client, rpc } = richClient();
    await createAuthService(client).updateProfile({ name: "Jhony", username: null, bio: null });
    expect(rpc).toHaveBeenCalledWith("update_my_profile", {
      p_name: "Jhony",
      p_username: undefined,
      p_bio: undefined,
    });
  });

  it("traduce el usuario repetido", async () => {
    const { client } = richClient({
      rpcRow: null,
      rpcError: {
        message: 'duplicate key value violates unique constraint "profiles_username_uidx"',
        code: "23505",
      },
    });
    await expect(
      createAuthService(client).updateProfile({ name: "Jhony", username: "diego", bio: null }),
    ).rejects.toThrow("Ese usuario ya está en uso");
  });
});

describe("updatePassword", () => {
  const strong = "Nueva-Clave-2026";
  const verify = (error: { message: string; code?: string } | null = null) =>
    vi.fn().mockResolvedValue({ error });

  it("comprueba la contraseña actual y luego actualiza", async () => {
    const { client, auth } = richClient();
    const verifyCurrentPassword = verify();
    await createAuthService(client, undefined, { verifyCurrentPassword }).updatePassword({
      currentPassword: "Actual-Clave-1",
      newPassword: strong,
    });
    expect(verifyCurrentPassword).toHaveBeenCalledWith("jhony@vexa.test", "Actual-Clave-1");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: strong });
  });

  it("rechaza una contraseña actual incorrecta sin tocar la nueva", async () => {
    const { client, auth } = richClient();
    const verifyCurrentPassword = verify({
      message: "Invalid login credentials",
      code: "invalid_credentials",
    });
    await expect(
      createAuthService(client, undefined, { verifyCurrentPassword }).updatePassword({
        currentPassword: "mala",
        newPassword: strong,
      }),
    ).rejects.toThrow("La contraseña actual no es correcta");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["Corta1a", "al menos 12 caracteres"],
    ["sin-mayusculas-123", "mayúscula"],
    ["SIN-MINUSCULAS-123", "minúscula"],
    ["Sin-Numeros-Aqui", "número"],
  ])("valida la nueva contraseña %s", async (newPassword, fragment) => {
    const { client, auth } = richClient();
    const verifyCurrentPassword = verify();
    await expect(
      createAuthService(client, undefined, { verifyCurrentPassword }).updatePassword({
        currentPassword: "Actual-Clave-1",
        newPassword,
      }),
    ).rejects.toThrow(fragment);
    expect(verifyCurrentPassword).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("exige escribir la contraseña actual", async () => {
    const { client } = richClient();
    await expect(
      createAuthService(client, undefined, { verifyCurrentPassword: verify() }).updatePassword({
        currentPassword: "",
        newPassword: strong,
      }),
    ).rejects.toThrow("contraseña actual");
  });

  it("traduce el rechazo de Supabase por contraseña débil o igual", async () => {
    const { client, auth } = richClient();
    auth.updateUser.mockResolvedValue({
      data: null,
      error: { message: "New password should be different from the old password.", code: "same_password" },
    });
    await expect(
      createAuthService(client, undefined, { verifyCurrentPassword: verify() }).updatePassword({
        currentPassword: "Actual-Clave-1",
        newPassword: strong,
      }),
    ).rejects.toThrow("distinta de la actual");
  });
});

describe("signOutOthers", () => {
  it("cierra las demás sesiones y conserva esta", async () => {
    const { client, auth } = richClient();
    await createAuthService(client).signOutOthers();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });
});

describe("segundo paso (TOTP)", () => {
  it("lista solo los factores TOTP con su estado", async () => {
    const { client } = richClient({
      factors: [factor("f1", "verified"), factor("f2", "unverified")],
    });
    expect(await createAuthService(client).listMfaFactors()).toEqual([
      { id: "f1", friendlyName: "Vexa Studio", status: "verified", createdAt: "2026-10-06T10:00:00.000Z" },
      { id: "f2", friendlyName: "Vexa Studio", status: "unverified", createdAt: "2026-10-06T10:00:00.000Z" },
    ]);
  });

  it("alta: descarta restos sin confirmar y devuelve QR, secreto y URI", async () => {
    const { client, auth } = richClient({ factors: [factor("stale", "unverified")] });
    const enrollment = await createAuthService(client).enrollMfa();
    expect(auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: "stale" });
    expect(auth.mfa.enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "Vexa Studio",
    });
    expect(enrollment).toEqual({
      factorId: "f-new",
      qrCodeSvg: "data:image/svg+xml;utf-8,<svg/>",
      secret: "JBSWY3DP",
      uri: "otpauth://totp/x",
    });
  });

  it("alta: no deja registrar un segundo factor verificado", async () => {
    const { client, auth } = richClient({ factors: [factor("f1", "verified")] });
    await expect(createAuthService(client).enrollMfa()).rejects.toThrow("ya está activado");
    expect(auth.mfa.enroll).not.toHaveBeenCalled();
  });

  it("confirma el alta con el código de 6 dígitos", async () => {
    const { client, auth } = richClient();
    await createAuthService(client).verifyMfaEnrollment("f-new", " 123456 ");
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f-new", code: "123456" });
  });

  it("rechaza un código que no son 6 dígitos sin llamar a Supabase", async () => {
    const { client, auth } = richClient();
    await expect(createAuthService(client).verifyMfaEnrollment("f-new", "12ab")).rejects.toThrow(
      "6 dígitos",
    );
    expect(auth.mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("traduce un código incorrecto", async () => {
    const { client, auth } = richClient();
    auth.mfa.challengeAndVerify.mockResolvedValue({
      data: null,
      error: { message: "Invalid TOTP code entered", code: "mfa_verification_failed" },
    });
    await expect(createAuthService(client).verifyMfaEnrollment("f-new", "000000")).rejects.toThrow(
      "código no es correcto",
    );
  });

  it("desactiva un factor", async () => {
    const { client, auth } = richClient();
    await createAuthService(client).disableMfa("f1");
    expect(auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: "f1" });
  });

  it("getMfaChallenge: pide el segundo paso solo de aal1 a aal2", async () => {
    const needs = richClient({
      levels: { currentLevel: "aal1", nextLevel: "aal2" },
      factors: [factor("f1", "verified")],
    });
    expect(await createAuthService(needs.client).getMfaChallenge()).toEqual({
      required: true,
      factorId: "f1",
    });
    const done = richClient({ levels: { currentLevel: "aal2", nextLevel: "aal2" } });
    expect(await createAuthService(done.client).getMfaChallenge()).toEqual({ required: false });
    const none = richClient();
    expect(await createAuthService(none.client).getMfaChallenge()).toEqual({ required: false });
  });

  it("el acceso con contraseña avisa con MfaRequiredError y no entrega perfil", async () => {
    const { client } = richClient({
      levels: { currentLevel: "aal1", nextLevel: "aal2" },
      factors: [factor("f1", "verified")],
    });
    const error = await createAuthService(client)
      .signInWithPassword("jhony@vexa.test", "Actual-Clave-1")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MfaRequiredError);
    expect((error as MfaRequiredError).factorId).toBe("f1");
  });

  it("restaurar la sesión no entrega perfil mientras falte el segundo paso", async () => {
    const { client, auth } = richClient({
      levels: { currentLevel: "aal1", nextLevel: "aal2" },
      factors: [factor("f1", "verified")],
    });
    expect(await createAuthService(client).getSession()).toBeNull();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("verifyMfaLogin completa el segundo paso y devuelve el perfil", async () => {
    const { client, auth } = richClient();
    const profile = await createAuthService(client).verifyMfaLogin("f1", "654321");
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f1", code: "654321" });
    expect(profile).toMatchObject({ id: "u1", name: "Jhony" });
  });
});
