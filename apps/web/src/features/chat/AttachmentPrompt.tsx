import { useState } from "react";
import type { ChatMessage, ChatThread } from "@vexa/domain/chat";
import { attachmentCopy } from "./chat-copy";
import { needsMyAnswer } from "./chat-logic";

/**
 * Under a file: the keep-or-release question for a member who has not answered
 * once everybody downloaded it, then a neutral text with their own answer.
 * Nothing else is shown (the flow is silent until it is the person's turn).
 */
export function AttachmentPrompt({
  thread,
  message,
  userId,
  onAnswer,
}: {
  thread: ChatThread;
  message: ChatMessage;
  userId: string;
  onAnswer: (keep: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (needsMyAnswer(thread, message, userId)) {
    const answer = async (keep: boolean) => {
      setBusy(true);
      try {
        await onAnswer(keep);
      } finally {
        setBusy(false);
      }
    };
    return (
      <fieldset className="chat-attachment-prompt">
        <legend>{attachmentCopy.question}</legend>
        <div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer(true)}
          >
            {attachmentCopy.keep}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer(false)}
          >
            {attachmentCopy.release}
          </button>
        </div>
      </fieldset>
    );
  }
  const mine = message.attachmentLife?.keep[userId];
  if (mine === undefined || message.purgedAttachment) return null;
  return (
    <p className="chat-attachment-note">
      {mine ? attachmentCopy.answeredKeep : attachmentCopy.answeredRelease}
    </p>
  );
}
