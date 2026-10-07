import { describe, expect, it } from "vitest";
import { nextChatMode, type ChatMode } from "./chat-dock";

describe("nextChatMode", () => {
  it("toggle opens a closed chat and closes an open or minimized one", () => {
    expect(nextChatMode("closed", "toggle")).toBe("open");
    expect(nextChatMode("open", "toggle")).toBe("closed");
    expect(nextChatMode("minimized", "toggle")).toBe("closed");
  });
  it("toggle from the bubble brings the chat back instead of closing it", () => {
    expect(nextChatMode("bubble", "toggle")).toBe("open");
  });
  it("bubble hides the whole chat and only applies from open or minimized", () => {
    expect(nextChatMode("open", "bubble")).toBe("bubble");
    expect(nextChatMode("minimized", "bubble")).toBe("bubble");
    expect(nextChatMode("closed", "bubble")).toBe("closed");
    expect(nextChatMode("bubble", "bubble")).toBe("bubble");
  });
  it("restore and open bring the chat back from the bubble", () => {
    expect(nextChatMode("bubble", "restore")).toBe("open");
    expect(nextChatMode("bubble", "open")).toBe("open");
  });
  it("minimize does not leave the bubble", () => {
    expect(nextChatMode("bubble", "minimize")).toBe("bubble");
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
  it("open shows the panel from closed or minimized and keeps it open", () => {
    const modes: ChatMode[] = ["closed", "open", "minimized", "bubble"];
    for (const mode of modes) expect(nextChatMode(mode, "open")).toBe("open");
  });
  it("close goes to closed from anywhere", () => {
    const modes: ChatMode[] = ["closed", "open", "minimized", "bubble"];
    for (const mode of modes)
      expect(nextChatMode(mode, "close")).toBe("closed");
  });
});
