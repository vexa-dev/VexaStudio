/**
 * Minimizing only folds the contacts list, and only while a conversation is
 * open: the open chat always stays on screen and there is no floating widget.
 */
export function chatPanelVisibility(
  minimized: boolean,
  hasConversation: boolean,
) {
  return {
    contactsHidden: minimized && hasConversation,
  };
}
