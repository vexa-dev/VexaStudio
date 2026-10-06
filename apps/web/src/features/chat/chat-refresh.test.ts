import { describe, expect, it } from "vitest";
import { chatMediaRefresh } from "./chat-refresh";
import {
  CHAT_SIGN_CACHE_MS,
  CHAT_SIGN_TTL_SECONDS,
} from "@/services/supabase/chat-media";

describe("attachment query renewal policy", () => {
  it("renews foreground Supabase queries and suspended tabs on focus", () => {
    expect(chatMediaRefresh(true)).toEqual({
      refetchInterval: 50 * 60_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: "always",
    });
  });
  it("does not add polling or override focus behavior in mock mode", () => {
    expect(chatMediaRefresh(false)).toEqual({});
  });
  it("keeps five minutes grace even when a cached read postpones renewal", () => {
    const signedAt = 1000;
    const lastReuse = signedAt + CHAT_SIGN_CACHE_MS - 1;
    const renewedAt =
      lastReuse + Number(chatMediaRefresh(true).refetchInterval);
    expect(
      signedAt + CHAT_SIGN_TTL_SECONDS * 1000 - renewedAt,
    ).toBeGreaterThanOrEqual(5 * 60_000);
  });
});
