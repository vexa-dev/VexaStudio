import { MessageCircle, MessagesSquare, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

/** Shown in the conversation area while no thread is selected. */
export function ChatEmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="chat-welcome">
      <MessagesSquare size={32} aria-hidden="true" />
      <h3>Elige una conversación</h3>
      <p>
        Abre un chat de la lista o empieza uno nuevo con alguien del equipo.
      </p>
      <Button onClick={onNewChat}>Nueva conversación</Button>
    </div>
  );
}

/** Per-tab message for a list with nothing to show, with a clear next step. */
export function ChatListEmpty({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="chat-list-empty">
      <MessageCircle size={26} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{hint}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/** Calm card shown inside a conversation that has no messages yet. */
export function ChatConversationIntro({
  title,
  avatarSrc,
  group,
  detail,
  status,
  hint,
  onOpenProfile,
}: {
  title: string;
  avatarSrc: string | null;
  group: boolean;
  /** Role and area for a person, or the member count for a group. */
  detail: string;
  status?: string;
  hint: string;
  /** Makes the avatar open the person's profile. */
  onOpenProfile?: () => void;
}) {
  const avatar = (
    <Avatar
      name={title}
      src={avatarSrc}
      size="lg"
      className="chat-intro-avatar"
    />
  );
  return (
    <div className="chat-intro">
      {group ? (
        <span className="chat-intro-group" aria-hidden="true">
          <Users size={30} />
        </span>
      ) : onOpenProfile ? (
        <button
          type="button"
          className="chat-intro-avatar-button"
          aria-label={`Ver perfil de ${title}`}
          onClick={onOpenProfile}
        >
          {avatar}
        </button>
      ) : (
        avatar
      )}
      <h3>{title}</h3>
      <p className="chat-intro-detail">{detail}</p>
      {status && <p className="chat-intro-status">{status}</p>}
      <p className="chat-intro-hint">{hint}</p>
    </div>
  );
}
