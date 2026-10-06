import type { VexaSupabase } from "@/lib/supabase";

/**
 * Cliente falso para pruebas unitarias de los servicios: cada tabla o RPC devuelve el resultado
 * indicado, sin importar los filtros encadenados, y se anotan las llamadas para inspeccionarlas.
 * Solo lo importan archivos `*.test.ts`; la prueba contra la base real está en `integration.test.ts`.
 */
export interface FakeResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

export interface RecordedCall {
  /** `tabla` o `rpc:nombre`. */
  target: string;
  method: string;
  args: unknown[];
}

export interface FakeSpec {
  tables?: Record<string, FakeResult>;
  rpc?: Record<string, FakeResult>;
  /** Persona con sesión; `null` simula que no hay sesión. */
  userId?: string | null;
  /** Resultado de Storage por operación (`upload`, `remove`, `sign`); sin dato devuelve éxito vacío. */
  storage?: { upload?: FakeResult; remove?: FakeResult; sign?: FakeResult };
}

export const ok = (data: unknown): FakeResult => ({ data, error: null });

type Chain = { [method: string]: (...args: unknown[]) => Chain } & PromiseLike<FakeResult>;

export function fakeClient(spec: FakeSpec = {}) {
  const calls: RecordedCall[] = [];
  const userId = spec.userId === undefined ? "u1" : spec.userId;

  const chain = (target: string, result: FakeResult): Chain => {
    const proxy: Chain = new Proxy({} as Chain, {
      get(_object, method) {
        if (method === "then")
          return (
            resolve: (value: FakeResult) => unknown,
            reject: (reason: unknown) => unknown,
          ) => Promise.resolve(result).then(resolve, reject);
        return (...args: unknown[]) => {
          calls.push({ target, method: String(method), args });
          return proxy;
        };
      },
    });
    return proxy;
  };

  const client = {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: userId ? { user: { id: userId } } : null },
        }),
      // Sin segundo paso: la sesión ya es completa (aal1 y sin factores).
      mfa: {
        getAuthenticatorAssuranceLevel: () =>
          Promise.resolve({
            data: { currentLevel: "aal1", nextLevel: "aal1" },
            error: null,
          }),
        listFactors: () =>
          Promise.resolve({ data: { all: [], totp: [] }, error: null }),
      },
    },
    storage: {
      from: (bucket: string) => {
        const call = async (method: string, result: FakeResult, args: unknown[]) => {
          calls.push({ target: `storage:${bucket}`, method, args });
          return result;
        };
        return {
          upload: (...args: unknown[]) =>
            call("upload", spec.storage?.upload ?? ok({ path: String(args[0]) }), args),
          remove: (...args: unknown[]) =>
            call("remove", spec.storage?.remove ?? ok([]), args),
          createSignedUrl: (...args: unknown[]) =>
            call(
              "createSignedUrl",
              spec.storage?.sign ?? ok({ signedUrl: `https://files.test/${String(args[0])}?t=1` }),
              args,
            ),
        };
      },
    },
    from: (table: string) => chain(table, spec.tables?.[table] ?? ok(null)),
    rpc: (name: string, args?: unknown) => {
      calls.push({ target: `rpc:${name}`, method: "call", args: [args] });
      return chain(`rpc:${name}`, spec.rpc?.[name] ?? ok(null));
    },
  } as unknown as VexaSupabase;

  return { client, calls };
}

export const argsOf = (calls: RecordedCall[], target: string, method: string) =>
  calls.filter((c) => c.target === target && c.method === method).map((c) => c.args);

export const profileRow = (role: "admin" | "partner" | "collaborator", id = "u1") => ({
  id,
  name: "Persona",
  role,
  area: "technical",
  weekly_hours: 20,
  active: true,
  username: null,
  bio: null,
  created_at: "2026-10-03T17:00:00+00:00",
  updated_at: "2026-10-03T17:00:00+00:00",
});
