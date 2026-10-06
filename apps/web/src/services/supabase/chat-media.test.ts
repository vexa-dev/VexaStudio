import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_SIGN_CACHE_MS,
  CHAT_SIGN_TTL_SECONDS,
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
