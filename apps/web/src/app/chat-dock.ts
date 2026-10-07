export type ChatMode = "closed" | "open" | "minimized" | "bubble";
export type ChatModeAction =
  | "toggle"
  | "open"
  | "minimize"
  | "bubble"
  | "restore"
  | "close";

/**
 * Pure state machine for the chat panel; invalid transitions keep the mode.
 * "minimized" means: the contacts list is folded and the open chat stays.
 * "bubble" means: the whole chat is hidden (still mounted) behind a floating bubble.
 */
export function nextChatMode(mode: ChatMode, action: ChatModeAction): ChatMode {
  switch (action) {
    case "toggle":
      if (mode === "bubble") return "open";
      return mode === "closed" ? "open" : "closed";
    case "open":
      return "open";
    case "minimize":
      return mode === "open" ? "minimized" : mode;
    case "bubble":
      return mode === "open" || mode === "minimized" ? "bubble" : mode;
    case "restore":
      return mode === "minimized" || mode === "bubble" ? "open" : mode;
    case "close":
      return "closed";
  }
}
