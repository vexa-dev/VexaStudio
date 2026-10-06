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
  Pencil,
  Reply,
  Smile,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@vexa/domain/types";
import { formatDateTime } from "@vexa/domain/dates";
import { Avatar } from "@/components/ui/Avatar";
import type { ChatMessage, ChatThread } from "@vexa/domain/chat";
import {
  attachmentStage,
  messageStatus,
  shouldMarkDownload,
  type MessageStatus,
} from "./chat-logic";
import { attachmentCopy } from "./chat-copy";
import { AttachmentPrompt } from "./AttachmentPrompt";
import { AttachmentView, PurgedAttachmentView } from "./AttachmentView";
import { useChatActions } from "./hooks/useChatData";
import { dayLabel, groupMessages } from "./chat-format";
import { splitEmoji, toTextPresentation } from "./emoji-text";
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

const TICK_LABEL: Record<MessageStatus, string> = {
  sent: "Enviado",
  delivered: "Recibido",
  read: "Leído",
};
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
  const { remove, react, markDownloaded, answerKeep, purgeReleased } =
    useChatActions(user.id);
  const box = useRef<HTMLDivElement>(null);
  const reported = useRef(new Set<string>());
  const retried = useRef(new Set<string>());
  // Opening or downloading a file is my download; reported once per message and session.
  const openFile = (message: ChatMessage) => {
    if (
      reported.current.has(message.id) ||
      !shouldMarkDownload(thread, message, user.id)
    )
      return;
    reported.current.add(message.id);
    void markDownloaded(message.id).then((result) => {
      if (!result.ok) reported.current.delete(message.id);
    });
  };
  const answerFile = async (message: ChatMessage, keep: boolean) => {
    const result = await answerKeep({ messageId: message.id, keep });
    if (result.ok)
      toast.success(
        keep ? attachmentCopy.keptToast : attachmentCopy.releasedToast,
      );
  };
  // Everybody released but the file is still there (the answering device went offline, or the
  // removal failed): any member's open chat retries once per session; the server refuses otherwise.
  useEffect(() => {
    for (const message of thread.messages)
      if (
        attachmentStage(thread, message) === "ready" &&
        !retried.current.has(message.id)
      ) {
        retried.current.add(message.id);
        void purgeReleased(message.id);
      }
  }, [thread, purgeReleased]);
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
                const status = messageStatus(thread, message, user.id);
                return (
                  <article
                    key={message.id}
                    className={`chat-message${own ? " chat-message-own" : ""}${first ? " is-first" : ""}${last ? " is-last" : ""}`}
                    data-tooltip={formatDateTime(
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
                            <AttachmentView
                              attachment={message.attachment}
                              onOpen={() => openFile(message)}
                            />
                          )}
                          {message.purgedAttachment && (
                            <PurgedAttachmentView
                              attachment={message.purgedAttachment}
                            />
                          )}
                          <AttachmentPrompt
                            thread={thread}
                            message={message}
                            userId={user.id}
                            onAnswer={(keep) => answerFile(message, keep)}
                          />
                        </>
                      )}
                      <footer>
                        {message.editedAt && <span>editado</span>}
                        <time>{timeFormat.format(message.sentAt)}</time>
                        {own && (
                          <span
                            className={`chat-ticks${status === "read" ? " is-read" : ""}`}
                          >
                            {status === "sent" ? (
                              <Check size={14} aria-hidden="true" />
                            ) : (
                              <CheckCheck size={14} aria-hidden="true" />
                            )}
                            <span className="sr-only">
                              {TICK_LABEL[status]}
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
