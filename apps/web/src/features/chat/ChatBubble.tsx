import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { unreadLabel } from "@/app/unread-label";
import "./chat-bubble.css";

/** Floating launcher shown while the whole chat is minimized; restores it on click. */
export function ChatBubble({
  unread,
  raised,
  onOpen,
}: {
  unread: number;
  /** True when the timer bar is on screen, so the bubble sits above it. */
  raised: boolean;
  onOpen: () => void;
}) {
  const label = `Abrir chat${unread ? `, ${unread} ${unread === 1 ? "mensaje sin leer" : "mensajes sin leer"}` : ""}`;
  return createPortal(
    <button
      type="button"
      className="chat-dock-bubble"
      data-raised={raised || undefined}
      aria-label={label}
      onClick={onOpen}
    >
      <MessageCircle size={24} aria-hidden="true" />
      {unread > 0 && (
        <span className="chat-dock-bubble-badge num" aria-hidden="true">
          {unreadLabel(unread)}
        </span>
      )}
    </button>,
    document.body,
  );
}
