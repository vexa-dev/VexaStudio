export type ChatMode = "closed" | "open" | "minimized";
export type ChatModeAction = "toggle" | "open" | "minimize" | "restore" | "close";

/**
 * Pure state machine for the chat panel; invalid transitions keep the mode.
 * "minimized" means: the contacts list is folded and the open chat stays.
 */
export function nextChatMode(mode: ChatMode, action: ChatModeAction): ChatMode {
  switch (action) {
    case "toggle":
      return mode === "closed" ? "open" : "closed";
    case "open":
      return "open";
    case "minimize":
      return mode === "open" ? "minimized" : mode;
    case "restore":
      return mode === "minimized" ? "open" : mode;
    case "close":
      return "closed";
  }
}
