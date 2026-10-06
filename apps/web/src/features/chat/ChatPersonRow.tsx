import { chatCopy } from "./chat-copy";
import { FolderOpen } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { defaultChatSettings } from "./chat-store";
import { StatusNote } from "./StatusNote";
import { useWorkingNow } from "./useWorkingNow";
import { workingLabel } from "./working-label";
import "./chat-list.css";

/** One person in the Chats or Personas tab: status, project and last line. */
export function ChatPersonRow({
  memberId,
  name,
  avatarSrc,
  online,
  status,
  currentProjectId,
  detail,
  time,
  unread = 0,
  selected,
  onSelect,
}: {
  memberId: string;
  name: string;
  avatarSrc?: string | null;
  online: boolean;
  status: string;
  currentProjectId: string | null;
  /** Last message preview (Chats) or connection text (Personas). */
  detail: string;
  time?: string;
  unread?: number;
  selected?: boolean;
  onSelect: () => void;
}) {
  const working = useWorkingNow(memberId, currentProjectId);
  const project = workingLabel(working.data ?? null);
  // The default "Disponible" says nothing new: only show a note the person wrote or picked.
  const hasNote =
    status.trim() !== "" && status.trim() !== defaultChatSettings.status;
  return (
    <button
      type="button"
      className={`chat-thread chat-person-row${hasNote ? " has-note" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="chat-avatar-wrap">
        <Avatar name={name} src={avatarSrc} />
        <i
          className={online ? "chat-online-dot" : "chat-offline-dot"}
          aria-label={chatCopy.presence(online)}
        />
      </span>
      {hasNote && <StatusNote text={status} />}
      <span className="chat-thread-body">
        <span className="chat-thread-top">
          <strong>{name}</strong>
          {time && <time className="chat-thread-time">{time}</time>}
        </span>
        {project && (
          <span className="chat-project-line">
            <FolderOpen size={12} aria-hidden="true" />
            <span>{project}</span>
          </span>
        )}
        <span className="chat-thread-bottom">
          <small>{detail}</small>
          {unread > 0 && (
            <b className="chat-unread" aria-label={`${unread} sin leer`}>
              {unread > 99 ? "99+" : unread}
            </b>
          )}
        </span>
      </span>
    </button>
  );
}
