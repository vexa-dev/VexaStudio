import { describe, expect, it } from "vitest";
import { nextChatMode, type ChatMode } from "./chat-dock";

describe("nextChatMode", () => {
  it("toggle opens a closed chat and closes an open or minimized one", () => {
    expect(nextChatMode("closed", "toggle")).toBe("open");
    expect(nextChatMode("open", "toggle")).toBe("closed");
    expect(nextChatMode("minimized", "toggle")).toBe("closed");
  });
  it("minimize only applies from open", () => {
    expect(nextChatMode("open", "minimize")).toBe("minimized");
    expect(nextChatMode("closed", "minimize")).toBe("closed");
    expect(nextChatMode("minimized", "minimize")).toBe("minimized");
  });
  it("restore only applies from minimized", () => {
    expect(nextChatMode("minimized", "restore")).toBe("open");
    expect(nextChatMode("closed", "restore")).toBe("closed");
    expect(nextChatMode("open", "restore")).toBe("open");
  });
  it("close goes to closed from anywhere", () => {
    const modes: ChatMode[] = ["closed", "open", "minimized"];
    for (const mode of modes)
      expect(nextChatMode(mode, "close")).toBe("closed");
  });
});
