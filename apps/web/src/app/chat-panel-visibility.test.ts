import { describe, expect, it } from "vitest";
import { chatPanelVisibility } from "./chat-panel-visibility";

describe("contacts-only minimization", () => {
  it.each([
    [false, false, false],
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ])(
    "minimized=%s, conversation=%s -> contactsHidden=%s",
    (minimized, hasConversation, contactsHidden) => {
      expect(chatPanelVisibility(minimized, hasConversation)).toEqual({
        contactsHidden,
      });
    },
  );

  it("never produces a floating widget or hides the whole panel", () => {
    for (const minimized of [false, true])
      for (const hasConversation of [false, true])
        expect(
          chatPanelVisibility(minimized, hasConversation),
        ).not.toHaveProperty("dockVisible");
  });
});
