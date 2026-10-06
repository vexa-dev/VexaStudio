import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_SIGN_CACHE_MS,
  CHAT_SIGN_TTL_SECONDS,
  STORAGE_CACHE_CONTROL,
  createChatMedia,
  decodeAttachment,
  safeFilename,
} from "./chat-media";

describe("chat upload validation", () => {
  it("decodes bytes and preserves declared MIME", () => {
    expect(
      decodeAttachment({
        name: "notes.txt",
        type: "text/plain",
        data: "data:text/plain;base64,aGk=",
      }).size,
    ).toBe(2);
  });
  it("rejects external URLs, empty data, MIME mismatch and oversize payloads", () => {
    for (const data of [
      "https://example.com/file",
      "data:text/plain;base64,",
      "data:image/png;base64,aGk=",
    ])
      expect(() =>
        decodeAttachment({ name: "a", type: "text/plain", data }),
      ).toThrow();
    expect(() =>
      decodeAttachment({
        name: "a",
        type: "text/plain",
        data: `data:text/plain;base64,${btoa("a".repeat(26 * 1024 * 1024))}`,
      }),
    ).toThrow();
  });
  it("sanitizes storage filenames without path traversal", () => {
    expect(safeFilename("../secret / archivo.txt")).not.toContain("/");
    expect(safeFilename("...")).toBe("file");
  });
});

import { chatMediaRefresh } from "@/features/chat/chat-refresh";
import type { VexaSupabase } from "@/lib/supabase";

describe("signed attachment cache", () => {
  afterEach(() => vi.useRealTimers());
  function fixture() {
    let user: string | undefined = "first";
    const sign = vi.fn(async (paths: string[]) => ({
      data: paths.map((path) => ({
        path,
        signedUrl: `${user}/${sign.mock.calls.length}/${path}`,
        error: null,
      })),
      error: null,
    }));
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: user ? { user: { id: user } } : null },
        }),
      },
      storage: { from: () => ({ createSignedUrls: sign }) },
    } as unknown as VexaSupabase;
    return {
      media: createChatMedia(client),
      sign,
      setUser: (id?: string) => {
        user = id;
      },
    };
  }
  it("reuses repeated paths, renews at the exact boundary before URL expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const f = fixture();
    const first = await f.media.sign(["file", "file"]);
    expect(f.sign).toHaveBeenCalledWith(["file"], 3600);
    vi.advanceTimersByTime(CHAT_SIGN_CACHE_MS - 1);
    expect(await f.media.sign(["file"])).toEqual(first);
    expect(f.sign).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(await f.media.sign(["file"])).not.toEqual(first);
    expect(f.sign).toHaveBeenCalledTimes(2);
    expect(CHAT_SIGN_CACHE_MS).toBeLessThan(CHAT_SIGN_TTL_SECONDS * 1000);
  });
  it("renews before one hour even after a cached fetch resets the query interval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const f = fixture();
    const first = await f.media.sign(["file"]);
    vi.advanceTimersByTime(CHAT_SIGN_CACHE_MS - 1);
    expect(await f.media.sign(["file"])).toEqual(first);
    vi.advanceTimersByTime(Number(chatMediaRefresh(true).refetchInterval));
    expect(await f.media.sign(["file"])).not.toEqual(first);
    expect(Date.now()).toBeLessThan(
      1000 + CHAT_SIGN_TTL_SECONDS * 1000 - 5 * 60_000,
    );
  });
  it("clears signed URLs when account changes or signs out", async () => {
    const f = fixture();
    const first = await f.media.sign(["file"]);
    f.setUser("second");
    expect(await f.media.sign(["file"])).not.toEqual(first);
    f.setUser();
    await f.media.sign(["file"]);
    f.setUser("first");
    await f.media.sign(["file"]);
    expect(f.sign).toHaveBeenCalledTimes(4);
  });
});

function memoryStorage(failing = false) {
  const data = new Map<string, string>();
  const fail = () => {
    throw new Error("storage unavailable");
  };
  return {
    data,
    api: {
      get length() {
        return failing ? fail() : data.size;
      },
      key: (i: number) => (failing ? fail() : ([...data.keys()][i] ?? null)),
      getItem: (k: string) => (failing ? fail() : (data.get(k) ?? null)),
      setItem: (k: string, v: string) => (failing ? fail() : void data.set(k, v)),
      removeItem: (k: string) => (failing ? fail() : void data.delete(k)),
    },
  };
}

function signFixture(user: string | undefined = "first") {
  const sign = vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({
      path,
      signedUrl: `https://files.test/${path}?t=${sign.mock.calls.length}`,
      error: null,
    })),
    error: null,
  }));
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: user ? { user: { id: user } } : null },
      }),
    },
    storage: { from: () => ({ createSignedUrls: sign }) },
  } as unknown as VexaSupabase;
  return { client, sign };
}

describe("persisted signed URL cache", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("reuses the URL after a reload while it is young, without signing again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const store = memoryStorage();
    vi.stubGlobal("localStorage", store.api);
    const a = signFixture();
    const first = await createChatMedia(a.client).sign(["t/m/file.png"]);
    expect(a.sign).toHaveBeenCalledTimes(1);
    const stored = [...store.data.values()].join("");
    expect(stored).toContain("https://files.test/t/m/file.png");
    expect(stored).not.toMatch(/first|token|password/i);
    vi.advanceTimersByTime(CHAT_SIGN_CACHE_MS - 1);
    const b = signFixture();
    expect(await createChatMedia(b.client).sign(["t/m/file.png"])).toEqual(first);
    expect(b.sign).not.toHaveBeenCalled();
  });
  it("signs again once the persisted URL is too close to expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    vi.stubGlobal("localStorage", memoryStorage().api);
    const a = signFixture();
    await createChatMedia(a.client).sign(["file"]);
    vi.advanceTimersByTime(CHAT_SIGN_CACHE_MS);
    const b = signFixture();
    await createChatMedia(b.client).sign(["file"]);
    expect(b.sign).toHaveBeenCalledTimes(1);
  });
  it("drops another account's entries and ignores corrupt data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const store = memoryStorage();
    vi.stubGlobal("localStorage", store.api);
    await createChatMedia(signFixture("first").client).sign(["file"]);
    const second = signFixture("second");
    await createChatMedia(second.client).sign(["file"]);
    expect(second.sign).toHaveBeenCalledTimes(1);
    expect([...store.data.keys()].some((k) => k.endsWith(":first"))).toBe(false);
    for (const key of store.data.keys()) store.data.set(key, "{not json");
    const third = signFixture("second");
    await createChatMedia(third.client).sign(["file"]);
    expect(third.sign).toHaveBeenCalledTimes(1);
  });
  it("still works when storage throws or does not exist", async () => {
    vi.stubGlobal("localStorage", memoryStorage(true).api);
    const a = signFixture();
    const media = createChatMedia(a.client);
    const first = await media.sign(["file"]);
    expect(await media.sign(["file"])).toEqual(first);
    expect(a.sign).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    const b = signFixture();
    expect((await createChatMedia(b.client).sign(["file"])).size).toBe(1);
  });
});

describe("chat upload caching", () => {
  it("marks immutable uploads as cacheable for a year without upsert", async () => {
    const upload = vi.fn(async () => ({ data: { path: "p" }, error: null }));
    const client = {
      storage: { from: () => ({ upload }) },
    } as unknown as VexaSupabase;
    await createChatMedia(client).upload("t", "m", {
      name: "a.txt",
      type: "text/plain",
      data: "data:text/plain;base64,aGk=",
    });
    expect(STORAGE_CACHE_CONTROL).toBe("31536000");
    expect(upload).toHaveBeenCalledWith("t/m/a.txt", expect.any(Blob), {
      contentType: "text/plain",
      upsert: false,
      cacheControl: "31536000",
    });
  });
});
