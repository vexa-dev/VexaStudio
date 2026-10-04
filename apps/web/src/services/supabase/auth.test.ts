import { describe, expect, it, vi } from "vitest";
import type { VexaSupabase } from "@/lib/supabase";
import { createAuthService, toAuthError } from "./auth";

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
