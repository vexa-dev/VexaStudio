import { describe, expect, it } from "vitest";
import { argsOf, fakeClient, ok, profileRow, type FakeSpec } from "./fake-client";
import { createAuthService } from "./auth";
import { createMemberService } from "./members";
import {
  clearProfileImage,
  createSignedUrlResolver,
  dataUrlToBlob,
  uploadProfileImage,
} from "./profile-media";

const INVALID = "La imagen no es válida o pesa demasiado.";
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const WEBP = "data:image/webp;base64,UklGRg==";
const U1 = "u1";

interface StorageOp {
  op: "upload" | "remove" | "sign";
  bucket: string;
  args: unknown[];
}

interface StorageSpec {
  uploadError?: { message: string } | null;
  removeError?: { message: string } | null;
  removeThrows?: boolean;
  signError?: { message: string } | null;
  signThrows?: boolean;
  /** Rutas cuya firma individual falla. */
  badPaths?: string[];
}

/** Cliente falso con `storage`: anota cada operación en orden junto a las llamadas a la base. */
function setup(spec: FakeSpec = {}, storage: StorageSpec = {}) {
  const base = fakeClient(spec);
  const ops: StorageOp[] = [];
  let signCount = 0;
  const bucketApi = (bucket: string) => ({
    upload: (path: string, body: Blob, options: unknown) => {
      ops.push({ op: "upload", bucket, args: [path, body, options] });
      return Promise.resolve({
        data: storage.uploadError ? null : { path },
        error: storage.uploadError ?? null,
      });
    },
    remove: (paths: string[]) => {
      ops.push({ op: "remove", bucket, args: [paths] });
      if (storage.removeThrows) return Promise.reject(new Error("sin red"));
      return Promise.resolve({ data: [], error: storage.removeError ?? null });
    },
    createSignedUrls: (paths: string[], ttl: number) => {
      ops.push({ op: "sign", bucket, args: [paths, ttl] });
      signCount += 1;
      if (storage.signThrows) return Promise.reject(new Error("sin red"));
      if (storage.signError) return Promise.resolve({ data: null, error: storage.signError });
      return Promise.resolve({
        data: paths.map((path) =>
          storage.badPaths?.includes(path)
            ? { path, signedUrl: null, error: "Object not found" }
            : { path, signedUrl: `https://files.test/${bucket}/${path}?t=${signCount}`, error: null },
        ),
        error: null,
      });
    },
  });
  Object.assign(base.client, { storage: { from: bucketApi } });
  return { ...base, ops };
}

const rpcRow = (patch: Record<string, unknown> = {}) => ({
  ...profileRow("partner", U1),
  avatar_path: null,
  banner_path: null,
  ...patch,
});

describe("dataUrlToBlob", () => {
  it("convierte un data URL png, webp y jpeg", async () => {
    const png = dataUrlToBlob(PNG);
    expect(png.mime).toBe("image/png");
    expect(png.ext).toBe("png");
    expect(png.blob.type).toBe("image/png");
    expect(png.blob.size).toBe(8);
    expect(Array.from(new Uint8Array(await png.blob.arrayBuffer()))).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(dataUrlToBlob(WEBP)).toMatchObject({ mime: "image/webp", ext: "webp" });
    expect(dataUrlToBlob("data:image/jpeg;base64,/9j/4AAQ")).toMatchObject({
      mime: "image/jpeg",
      ext: "jpg",
    });
  });

  it.each([
    ["un svg", "data:image/svg+xml;base64,AAAA"],
    ["un gif", "data:image/gif;base64,R0lGODlh"],
    ["un enlace", "https://x.test/a.png"],
    ["sin base64", "data:image/png,hola"],
    ["base64 vacío", "data:image/png;base64,"],
    ["base64 roto", "data:image/png;base64,@@@"],
    ["texto html", "data:text/html;base64,AAAA"],
  ])("rechaza %s", (_name, value) => {
    expect(() => dataUrlToBlob(value)).toThrow(INVALID);
  });

  it("rechaza una imagen de más de 2 MiB", () => {
    const big = `data:image/png;base64,${"A".repeat(Math.ceil(((2 * 1024 * 1024 + 4) * 4) / 3))}`;
    expect(() => dataUrlToBlob(big)).toThrow(INVALID);
  });
});

describe("createSignedUrlResolver", () => {
  it("no firma una ruta nula", async () => {
    const { client, ops } = setup();
    const resolver = createSignedUrlResolver(client);
    expect(await resolver.resolve("avatars", null)).toBeNull();
    expect(await resolver.resolve("avatars", undefined)).toBeNull();
    expect(ops).toEqual([]);
  });

  it("firma en lote, una llamada por bucket, con el TTL pedido", async () => {
    const { client, ops } = setup();
    const resolver = createSignedUrlResolver(client, { ttlSeconds: 600 });
    const urls = await resolver.resolveMany([
      { bucket: "avatars", path: "u1/a.webp" },
      { bucket: "avatars", path: "u2/a.webp" },
      { bucket: "banners", path: "u1/b.webp" },
      { bucket: "avatars", path: null },
      { bucket: "avatars", path: "u1/a.webp" },
    ]);
    expect(urls[0]).toContain("/avatars/u1/a.webp");
    expect(urls[1]).toContain("/avatars/u2/a.webp");
    expect(urls[2]).toContain("/banners/u1/b.webp");
    expect(urls[3]).toBeNull();
    expect(urls[4]).toBe(urls[0]);
    const signs = ops.filter((o) => o.op === "sign");
    expect(signs).toHaveLength(2);
    expect(signs[0]).toMatchObject({
      bucket: "avatars",
      args: [["u1/a.webp", "u2/a.webp"], 600],
    });
  });

  it("usa 3600 s por defecto y guarda en caché", async () => {
    const { client, ops } = setup();
    const resolver = createSignedUrlResolver(client);
    const first = await resolver.resolve("avatars", "u1/a.webp");
    const second = await resolver.resolve("avatars", "u1/a.webp");
    expect(second).toBe(first);
    const signs = ops.filter((o) => o.op === "sign");
    expect(signs).toHaveLength(1);
    expect(signs[0]?.args[1]).toBe(3600);
  });

  it("renueva cuando queda menos del 10% del TTL", async () => {
    const { client, ops } = setup();
    let now = 1_000_000;
    const resolver = createSignedUrlResolver(client, { ttlSeconds: 1000, now: () => now });
    const first = await resolver.resolve("avatars", "u1/a.webp");
    now += 899_000; // quedan 101 s (>10%)
    expect(await resolver.resolve("avatars", "u1/a.webp")).toBe(first);
    now += 2_000; // quedan 99 s (<10%)
    const renewed = await resolver.resolve("avatars", "u1/a.webp");
    expect(renewed).not.toBe(first);
    expect(ops.filter((o) => o.op === "sign")).toHaveLength(2);
  });

  it("devuelve null, sin lanzar, cuando firmar falla", async () => {
    for (const storage of [
      { signError: { message: "boom" } },
      { signThrows: true },
      { badPaths: ["u1/a.webp"] },
    ]) {
      const { client } = setup({}, storage);
      const resolver = createSignedUrlResolver(client);
      expect(await resolver.resolve("avatars", "u1/a.webp")).toBeNull();
    }
  });

  it("no guarda en caché un fallo", async () => {
    const { client, ops } = setup({}, { badPaths: ["u1/a.webp"] });
    const resolver = createSignedUrlResolver(client);
    await resolver.resolve("avatars", "u1/a.webp");
    await resolver.resolve("avatars", "u1/a.webp");
    expect(ops.filter((o) => o.op === "sign")).toHaveLength(2);
  });

  it("forget y clear descartan la caché", async () => {
    const { client, ops } = setup();
    const resolver = createSignedUrlResolver(client);
    await resolver.resolve("avatars", "u1/a.webp");
    resolver.forget("avatars", "u1/a.webp");
    await resolver.resolve("avatars", "u1/a.webp");
    resolver.clear();
    await resolver.resolve("avatars", "u1/a.webp");
    expect(ops.filter((o) => o.op === "sign")).toHaveLength(3);
  });
});

describe("uploadProfileImage", () => {
  const now = () => 1_700_000_000_000;

  it("sube, guarda la ruta con la RPC y retira el objeto anterior", async () => {
    const { client, ops, calls } = setup({
      tables: { profiles: ok({ avatar_path: "u1/avatar-1.png" }) },
      rpc: { set_profile_media: ok(rpcRow({ avatar_path: "u1/avatar-1700000000000.webp" })) },
    });
    const row = await uploadProfileImage(client, {
      userId: U1,
      kind: "avatar",
      dataUrl: WEBP,
      now,
    });
    expect(row.avatar_path).toBe("u1/avatar-1700000000000.webp");
    const [upload, remove] = ops;
    expect(upload).toMatchObject({ op: "upload", bucket: "avatars" });
    expect(upload?.args[0]).toBe("u1/avatar-1700000000000.webp");
    expect(upload?.args[2]).toEqual({ contentType: "image/webp", upsert: false });
    expect(argsOf(calls, "rpc:set_profile_media", "call")).toEqual([
      [{ p_avatar_path: "u1/avatar-1700000000000.webp" }],
    ]);
    expect(remove).toMatchObject({ op: "remove", bucket: "avatars", args: [["u1/avatar-1.png"]] });
    // El orden importa: nunca se borra lo anterior antes de que la ruta nueva esté guardada.
    expect(ops.map((o) => o.op)).toEqual(["upload", "remove"]);
  });

  it("usa el bucket banners y no retira nada si no había anterior", async () => {
    const { client, ops, calls } = setup({
      tables: { profiles: ok({ banner_path: null }) },
      rpc: { set_profile_media: ok(rpcRow()) },
    });
    await uploadProfileImage(client, { userId: U1, kind: "banner", dataUrl: PNG, now });
    expect(ops.map((o) => `${o.op}:${o.bucket}`)).toEqual(["upload:banners"]);
    expect(argsOf(calls, "rpc:set_profile_media", "call")).toEqual([
      [{ p_banner_path: "u1/banner-1700000000000.png" }],
    ]);
  });

  it("un fallo al borrar lo anterior no falla la operación", async () => {
    for (const storage of [{ removeError: { message: "x" } }, { removeThrows: true }]) {
      const { client } = setup(
        {
          tables: { profiles: ok({ avatar_path: "u1/viejo.png" }) },
          rpc: { set_profile_media: ok(rpcRow()) },
        },
        storage,
      );
      await expect(
        uploadProfileImage(client, { userId: U1, kind: "avatar", dataUrl: PNG, now }),
      ).resolves.toBeDefined();
    }
  });

  it("si la RPC falla, retira el objeto nuevo y traduce el error", async () => {
    const { client, ops } = setup({
      tables: { profiles: ok({ avatar_path: "u1/viejo.png" }) },
      rpc: {
        set_profile_media: {
          data: null,
          error: { message: "La imagen no existe en el almacenamiento", code: "P0002" },
        },
      },
    });
    await expect(
      uploadProfileImage(client, { userId: U1, kind: "avatar", dataUrl: PNG, now }),
    ).rejects.toThrow("La imagen no existe en el almacenamiento");
    expect(ops.map((o) => o.op)).toEqual(["upload", "remove"]);
    expect(ops[1]?.args).toEqual([["u1/avatar-1700000000000.png"]]);
  });

  it("si la subida falla, no llama a la RPC", async () => {
    const { client, calls } = setup({}, { uploadError: { message: "The object exceeded the maximum allowed size" } });
    await expect(
      uploadProfileImage(client, { userId: U1, kind: "avatar", dataUrl: PNG, now }),
    ).rejects.toThrow(INVALID);
    expect(argsOf(calls, "rpc:set_profile_media", "call")).toEqual([]);
  });

  it("no sube nada si el data URL no es válido", async () => {
    const { client, ops } = setup();
    await expect(
      uploadProfileImage(client, { userId: U1, kind: "avatar", dataUrl: "data:text/html;base64,AA" }),
    ).rejects.toThrow(INVALID);
    expect(ops).toEqual([]);
  });
});

describe("clearProfileImage", () => {
  it("quita la ruta con la RPC y retira el objeto anterior", async () => {
    const { client, ops, calls } = setup({
      tables: { profiles: ok({ banner_path: "u1/banner-1.webp" }) },
      rpc: { set_profile_media: ok(rpcRow()) },
    });
    await clearProfileImage(client, { userId: U1, kind: "banner" });
    expect(argsOf(calls, "rpc:set_profile_media", "call")).toEqual([[{ p_clear_banner: true }]]);
    expect(ops).toEqual([
      { op: "remove", bucket: "banners", args: [["u1/banner-1.webp"]] },
    ]);
  });
});

describe("AuthService.updateProfileMedia con Supabase", () => {
  it("sube lo pedido, quita lo nulo y devuelve URLs firmadas", async () => {
    const { client, ops, calls } = setup({
      tables: { profiles: ok({ avatar_path: null, banner_path: "u1/banner-0.png" }) },
      rpc: {
        set_profile_media: ok(
          rpcRow({ avatar_path: "u1/avatar-x.webp", banner_path: null }),
        ),
      },
    });
    const profile = await createAuthService(client).updateProfileMedia({
      avatarUrl: WEBP,
      bannerUrl: null,
    });
    expect(argsOf(calls, "rpc:set_profile_media", "call")).toEqual([
      [{ p_avatar_path: expect.stringMatching(/^u1\/avatar-\d+\.webp$/) }],
      [{ p_clear_banner: true }],
    ]);
    expect(ops.some((o) => o.op === "upload" && o.bucket === "avatars")).toBe(true);
    expect(profile.id).toBe(U1);
    expect(profile.avatarUrl).toContain("https://files.test/avatars/u1/avatar-x.webp");
    expect(profile.bannerUrl ?? null).toBeNull();
  });

  it("valida ambas imágenes antes de subir", async () => {
    const { client, ops } = setup({ rpc: { set_profile_media: ok(rpcRow()) } });
    await expect(
      createAuthService(client).updateProfileMedia({ avatarUrl: PNG, bannerUrl: "https://x.test/a.png" }),
    ).rejects.toThrow(INVALID);
    expect(ops).toEqual([]);
  });

  it("sin sesión pide iniciar sesión", async () => {
    const { client } = setup({ userId: null });
    await expect(
      createAuthService(client).updateProfileMedia({ avatarUrl: PNG }),
    ).rejects.toThrow("Inicia sesión para continuar");
  });

  it("restaura la sesión con la foto firmada", async () => {
    const { client } = setup({
      tables: {
        profiles: ok(rpcRow({ avatar_path: "u1/a.webp", banner_path: "u1/b.webp" })),
      },
    });
    const profile = await createAuthService(client).getSession();
    expect(profile?.avatarUrl).toContain("/avatars/u1/a.webp");
    expect(profile?.bannerUrl).toContain("/banners/u1/b.webp");
  });
});

describe("MemberService con fotos firmadas", () => {
  it("list y get devuelven URLs firmadas y null sin ruta", async () => {
    const rows = [
      rpcRow({ id: "u1", avatar_path: "u1/a.webp" }),
      rpcRow({ id: "u2" }),
    ];
    const { client } = setup({ tables: { profiles: ok(rows) } });
    const list = await createMemberService(client).list();
    expect(list[0]?.avatarUrl).toContain("/avatars/u1/a.webp");
    expect(list[1]?.avatarUrl ?? null).toBeNull();

    const one = setup({ tables: { profiles: ok(rows[0]) } });
    const profile = await createMemberService(one.client).get("u1");
    expect(profile?.avatarUrl).toContain("/avatars/u1/a.webp");
  });

  it("si firmar falla, el perfil se devuelve sin foto", async () => {
    const { client } = setup(
      { tables: { profiles: ok([rpcRow({ avatar_path: "u1/a.webp" })]) } },
      { signThrows: true },
    );
    const list = await createMemberService(client).list();
    expect(list[0]?.avatarUrl ?? null).toBeNull();
  });
});
