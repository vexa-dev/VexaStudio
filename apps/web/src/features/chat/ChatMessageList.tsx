import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Check,
  CheckCheck,
  Copy,
  Forward,
  Download,
  Pencil,
  Reply,
  Smile,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@vexa/domain/types";
import { formatDateTime } from "@vexa/domain/dates";
import { Avatar } from "@/components/ui/Avatar";
import type {
  ChatAttachment,
  ChatMessage,
  ChatThread,
} from "@vexa/domain/chat";
import { isReadByOthers } from "./chat-logic";
import { useChatActions } from "./hooks/useChatData";
import { dayLabel, groupMessages } from "./chat-format";
import { splitEmoji, toTextPresentation } from "./emoji-text";
import { KIND_ICONS } from "./AttachMenu";
import {
  INLINE_VIDEO_BYTES,
  dataUrlBytes,
  formatBytes,
  kindOfFile,
} from "./attachment-kinds";
import "@fontsource-variable/noto-emoji/index.css";

/** Renders text with emoji runs drawn by the monochrome emoji font. */
function EmojiText({ text }: { text: string }) {
  return (
    <>
      {splitEmoji(text).map((segment, index) =>
        segment.emoji ? (
          <span className="chat-emoji" key={index}>
            {toTextPresentation(segment.text)}
          </span>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}

function AttachmentView({ attachment }: { attachment: ChatAttachment }) {
  const kind = kindOfFile(attachment);
  const bytes = dataUrlBytes(attachment.data);
  const Icon = KIND_ICONS[kind.id];
  if (kind.id === "image" && attachment.type.startsWith("image/"))
    return (
      <a
        href={attachment.data}
        download={attachment.name}
        className="chat-attachment"
      >
        <img src={attachment.data} alt={attachment.name} />
        {attachment.name}
      </a>
    );
  if (kind.id === "video" && bytes <= INLINE_VIDEO_BYTES)
    return (
      <div className="chat-attachment">
        <video src={attachment.data} controls preload="metadata" />
        <span>
          {attachment.name} · {formatBytes(bytes)}
        </span>
      </div>
    );
  return (
    <a
      href={attachment.data}
      download={attachment.name}
      className="chat-attachment chat-attachment-card"
      aria-label={`Descargar ${attachment.name}, ${kind.label}, ${formatBytes(bytes)}`}
    >
      <span className="chat-attachment-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className="chat-attachment-meta">
        <strong>{attachment.name}</strong>
        <small>
          {kind.label} · {formatBytes(bytes)}
        </small>
      </span>
      <Download size={16} aria-hidden="true" />
    </a>
  );
}

const timeFormat = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Lima",
});

export function ChatMessageList({
  thread,
  user,
  members,
  search,
  now,
  style,
  emptyState,
  onReply,
  onEdit,
  onReact,
  onForward,
}: {
  thread: ChatThread;
  user: Profile;
  members: Profile[];
  search: string;
  now: number;
  style?: CSSProperties;
  /** Shown while the thread has no messages. */
  emptyState?: ReactNode;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onReact: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
}) {
  const { remove, react } = useChatActions(user.id);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [thread.id, thread.messages.length]);

  const items = useMemo(() => {
    const needle = search.toLowerCase();
    return groupMessages(
      thread.messages.filter((message) =>
        message.text.toLowerCase().includes(needle),
      ),
    );
  }, [thread.messages, search]);
  const isGroup = thread.kind === "group";
  const person = (id: string) =>
    members.find((member) => member.id === id)?.name ?? "Integrante";

  return (
    <div className="chat-messages" ref={box} style={style}>
      {items.map((item) => {
        if (item.kind === "day")
          return (
            <div className="chat-day" key={item.key}>
              <span>{dayLabel(item.sentAt, now)}</span>
            </div>
          );
        const own = item.authorId === user.id;
        const showIdentity = !own && isGroup;
        const author = members.find((member) => member.id === item.authorId);
        return (
          <div
            key={item.key}
            className={`chat-run${own ? " chat-run-own" : ""}`}
          >
            {showIdentity && (
              <Avatar
                name={person(item.authorId)}
                src={author?.avatarUrl}
                size="sm"
                className="chat-message-avatar"
              />
            )}
            <div className="chat-run-messages">
              {item.messages.map((message, index) => {
                const first = index === 0;
                const last = index === item.messages.length - 1;
                const quoted = thread.messages.find(
                  (entry) => entry.id === message.replyTo,
                );
                const read = isReadByOthers(thread, message, user.id);
                return (
                  <article
                    key={message.id}
                    className={`chat-message${own ? " chat-message-own" : ""}${first ? " is-first" : ""}${last ? " is-last" : ""}`}
                    title={formatDateTime(
                      new Date(message.sentAt).toISOString(),
                    )}
                  >
                    <div className="chat-bubble">
                      {showIdentity && first && (
                        <strong className="chat-author">
                          {person(item.authorId)}
                        </strong>
                      )}
                      {quoted && (
                        <blockquote>
                          {person(quoted.authorId)}
                          <span>
                            {quoted.deleted
                              ? "Mensaje eliminado"
                              : quoted.text || "Archivo adjunto"}
                          </span>
                        </blockquote>
                      )}
                      {message.deleted ? (
                        <p className="chat-deleted">Mensaje eliminado</p>
                      ) : (
                        <>
                          {message.text && (
                            <p>
                              <EmojiText text={message.text} />
                            </p>
                          )}
                          {message.attachment && (
                            <AttachmentView attachment={message.attachment} />
                          )}
                        </>
                      )}
                      <footer>
                        {message.editedAt && <span>editado</span>}
                        <time>{timeFormat.format(message.sentAt)}</time>
                        {own && (
                          <span className="chat-ticks">
                            {read ? (
                              <CheckCheck size={14} aria-hidden="true" />
                            ) : (
                              <Check size={14} aria-hidden="true" />
                            )}
                            <span className="sr-only">
                              {read ? "Leído" : "Enviado"}
                            </span>
                          </span>
                        )}
                      </footer>
                    </div>
                    {!message.deleted && (
                      <div className="chat-message-actions">
                        <button
                          type="button"
                          aria-label="Responder mensaje"
                          onClick={() => onReply(message)}
                        >
                          <Reply size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Reaccionar con emoji"
                          onClick={() => onReact(message)}
                        >
                          <Smile size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Reenviar mensaje"
                          onClick={() => onForward(message)}
                        >
                          <Forward size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Copiar mensaje"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(message.text)
                              .then(() => toast.success("Mensaje copiado"))
                              .catch(() =>
                                toast.error("No se pudo copiar el mensaje"),
                              );
                          }}
                        >
                          <Copy size={15} aria-hidden="true" />
                        </button>
                        {own && (
                          <button
                            type="button"
                            aria-label="Editar mensaje"
                            onClick={() => onEdit(message)}
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                        )}
                        {(own || (user.role === "admin" && isGroup)) && (
                          <button
                            type="button"
                            aria-label="Eliminar mensaje"
                            onClick={() =>
                              void remove({
                                threadId: thread.id,
                                messageId: message.id,
                              })
                            }
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                    {Object.keys(message.reactions).length > 0 && (
                      <div className="chat-reactions">
                        {[...new Set(Object.values(message.reactions))].map(
                          (reaction) => (
                            <button
                              type="button"
                              key={reaction}
                              aria-label={`Reacción ${reaction}`}
                              aria-pressed={
                                message.reactions[user.id] === reaction
                              }
                              onClick={() =>
                                void react({
                                  threadId: thread.id,
                                  messageId: message.id,
                                  emoji: reaction,
                                })
                              }
                            >
                              <span className="chat-emoji">
                                {toTextPresentation(reaction)}
                              </span>
                              <span>
                                {
                                  Object.values(message.reactions).filter(
                                    (value) => value === reaction,
                                  ).length
                                }
                              </span>
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
      {!thread.messages.length && emptyState}
      {!!thread.messages.length && !items.length && (
        <div className="chat-list-empty">
          <p>Ningún mensaje coincide con tu búsqueda.</p>
        </div>
      )}
    </div>
  );
}
