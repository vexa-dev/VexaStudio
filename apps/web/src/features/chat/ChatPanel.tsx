import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  Forward,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  Reply,
  Search,
  Send,
  Settings2,
  Smile,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@vexa/domain/types";
import { formatDateTime } from "@vexa/domain/dates";
import { SidePanel } from "@/components/ui/SidePanel";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { useMembers } from "@/features/team/hooks/useMembers";
import type { useChat } from "./useChat";
import { ChatSettings } from "./ChatSettings";
import { ChatGroupEditor } from "./ChatGroupEditor";
import {
  changeMessage,
  deleteGroup,
  directThread,
  reactToMessage,
  saveGroup,
  sendMessage,
  type ChatAttachment,
  type ChatMessage,
  type ChatThread,
} from "./chat-store";
import "../../app/user-menu.css";
import "./chat.css";
const EmojiPicker = lazy(() => import("./EmojiPicker"));

export default function ChatPanel({
  user,
  chat,
  onClose,
}: {
  user: Profile;
  chat: ReturnType<typeof useChat>;
  onClose: () => void;
}) {
  const membersQuery = useMembers();
  const members = membersQuery.data ?? [user];
  const { store, update, settings, online, threads } = chat;
  const [tab, setTab] = useState<"chats" | "contacts" | "groups" | "settings">(
    "chats",
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | undefined>();
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [edit, setEdit] = useState<ChatMessage | null>(null);
  const [emoji, setEmoji] = useState(false);
  const [reactionTo, setReactionTo] = useState<string | null>(null);
  const [groupEditor, setGroupEditor] = useState<ChatThread | "new" | null>(
    null,
  );
  const [forward, setForward] = useState<ChatMessage | null>(null);
  const [forwardTo, setForwardTo] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messagesBox = useRef<HTMLDivElement>(null);
  const active = threads.find((thread) => thread.id === activeId);
  const otherId = active?.members.find((id) => id !== user.id);
  function person(id: string) {
    return members.find((member) => member.id === id)?.name ?? "Integrante";
  }
  function title(thread: ChatThread) {
    return thread.kind === "group"
      ? thread.name
      : person(thread.members.find((id) => id !== user.id) ?? user.id);
  }
  function selectThread(id: string) {
    setActiveId(id);
    setDraft("");
    setReply(null);
    setEdit(null);
    setAttachment(undefined);
    setEmoji(false);
    setReactionTo(null);
    setMessageSearch("");
  }
  function unread(thread: ChatThread) {
    return thread.messages.filter(
      (message) =>
        message.authorId !== user.id &&
        message.sentAt > (thread.readAt[user.id] ?? 0),
    ).length;
  }
  useEffect(() => {
    const last = active?.messages.at(-1)?.sentAt;
    if (active && last && (active.readAt[user.id] ?? 0) < last)
      update((next) => {
        const thread = next.threads.find((entry) => entry.id === active.id);
        if (thread) thread.readAt[user.id] = Date.now();
      });
  }, [active, user.id, update]);
  useEffect(() => {
    if (messagesBox.current)
      messagesBox.current.scrollTop = messagesBox.current.scrollHeight;
  }, [activeId, active?.messages.length]);
  function submit() {
    if (!active) return;
    const sent = update((next) => {
      if (edit) changeMessage(next, user, active.id, edit.id, draft);
      else
        sendMessage(next, user, active.id, {
          text: draft,
          attachment,
          replyTo: reply?.id,
        });
    });
    if (sent) {
      setDraft("");
      setAttachment(undefined);
      setReply(null);
      setEdit(null);
      setEmoji(false);
      input.current?.focus();
    }
  }
  const filteredThreads = threads.filter(
    (thread) =>
      (tab !== "groups" || thread.kind === "group") &&
      `${title(thread)} ${thread.messages.at(-1)?.text ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <SidePanel title="Chat VEXA" onClose={onClose} className="chat-drawer">
      <p className="chat-preview-banner">
        Demo local · los mensajes y la conexión se comparten solo entre pestañas
        de este navegador.
      </p>
      <div className="chat-workspace">
        <aside className={`chat-sidebar${active ? " chat-mobile-hidden" : ""}`}>
          <nav className="chat-tabs" aria-label="Apartados del chat">
            {(
              [
                { id: "chats", icon: MessageCircle, label: "Chats" },
                { id: "contacts", icon: Plus, label: "Personas" },
                { id: "groups", icon: Users, label: "Grupos" },
                { id: "settings", icon: Settings2, label: "Ajustes" },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                type="button"
                key={id}
                aria-pressed={tab === id}
                onClick={() => {
                  setTab(id);
                  setQuery("");
                  if (id === "settings") setActiveId(null);
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          {tab !== "settings" && (
            <div className="chat-search">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Buscar conversaciones o personas"
                placeholder="Buscar…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          )}
          {tab === "groups" && user.role === "admin" && (
            <Button
              variant="secondary"
              className="chat-create-group"
              onClick={() => setGroupEditor("new")}
            >
              <Plus size={16} aria-hidden="true" />
              Crear grupo
            </Button>
          )}
          {tab === "settings" ? (
            <ChatSettings
              user={user}
              settings={settings}
              onClose={onClose}
              onChange={(patch) =>
                update((next) => {
                  next.settings[user.id] = { ...settings, ...patch };
                })
              }
            />
          ) : (
            <div className="chat-thread-list">
              {tab === "contacts" ? (
                <>
                  {membersQuery.isPending && (
                    <p className="chat-hint">Cargando personas…</p>
                  )}
                  {membersQuery.isError && (
                    <Button
                      variant="secondary"
                      onClick={() => void membersQuery.refetch()}
                    >
                      Volver a cargar personas
                    </Button>
                  )}
                  {members
                    .filter(
                      (member) =>
                        member.id !== user.id &&
                        member.active &&
                        member.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((member) => (
                      <button
                        type="button"
                        className="chat-thread"
                        key={member.id}
                        onClick={() => {
                          let id = "";
                          if (
                            update((next) => {
                              id = directThread(next, user, member.id);
                            })
                          ) {
                            selectThread(id);
                            setTab("chats");
                          }
                        }}
                      >
                        <Avatar name={member.name} />
                        <span>
                          <strong>{member.name}</strong>
                          <small>
                            {store.settings[member.id]?.status ?? "Disponible"}
                          </small>
                        </span>
                        <i
                          className={
                            online[member.id]
                              ? "chat-online-dot"
                              : "chat-offline-dot"
                          }
                          aria-label={
                            online[member.id]
                              ? "En línea en la demo"
                              : "Sin conexión en la demo"
                          }
                        />
                      </button>
                    ))}
                </>
              ) : (
                <>
                  {filteredThreads.map((thread) => (
                    <button
                      type="button"
                      className="chat-thread"
                      aria-pressed={activeId === thread.id}
                      key={thread.id}
                      onClick={() => selectThread(thread.id)}
                    >
                      {thread.kind === "group" ? (
                        <span className="chat-group-avatar">
                          <Users size={20} aria-hidden="true" />
                        </span>
                      ) : (
                        <Avatar name={title(thread)} />
                      )}
                      <span>
                        <strong>{title(thread)}</strong>
                        <small>
                          {thread.messages.at(-1)?.deleted
                            ? "Mensaje eliminado"
                            : thread.messages.at(-1)?.text ||
                              (thread.messages.at(-1)?.attachment
                                ? "Archivo adjunto"
                                : thread.description ||
                                  "Empieza la conversación")}
                        </small>
                      </span>
                      {unread(thread) > 0 && (
                        <b className="chat-unread">{unread(thread)}</b>
                      )}
                    </button>
                  ))}
                  {!filteredThreads.length && (
                    <div className="chat-list-empty">
                      <MessageCircle size={28} aria-hidden="true" />
                      <h3>
                        {tab === "groups" ? "Tus grupos" : "Conversaciones"}
                      </h3>
                      <p>
                        {tab === "groups"
                          ? user.role === "admin"
                            ? "Crea un grupo y asigna a sus integrantes."
                            : "Aquí aparecerán los grupos a los que te asignen."
                          : "Abre Personas para empezar un mensaje directo."}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </aside>
        {tab !== "settings" && (
          <section
            className={`chat-conversation${!active ? " chat-mobile-hidden" : ""}`}
            aria-label="Conversación"
          >
            {active ? (
              <>
                <header className="chat-conversation-heading">
                  <Button
                    variant="ghost"
                    className="chat-back"
                    aria-label="Volver a conversaciones"
                    onClick={() => setActiveId(null)}
                  >
                    <ArrowLeft size={18} aria-hidden="true" />
                  </Button>
                  <div>
                    <h3>{title(active)}</h3>
                    <p>
                      {active.kind === "group"
                        ? `${active.members.length} integrantes`
                        : `${otherId && online[otherId] ? "En línea" : "Sin conexión"} · ${store.settings[otherId ?? ""]?.status ?? "Disponible"}`}
                    </p>
                  </div>
                  {active.kind === "group" && user.role === "admin" && (
                    <Button
                      variant="ghost"
                      aria-label="Administrar grupo"
                      onClick={() => setGroupEditor(active)}
                    >
                      <Settings2 size={18} aria-hidden="true" />
                    </Button>
                  )}
                </header>
                {active.kind === "group" && active.description && (
                  <p className="chat-group-description">{active.description}</p>
                )}
                <div className="chat-message-search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    placeholder="Buscar en esta conversación"
                    aria-label="Buscar mensajes"
                    value={messageSearch}
                    onChange={(event) => setMessageSearch(event.target.value)}
                  />
                </div>
                <div className="chat-messages" ref={messagesBox}>
                  {active.messages
                    .filter((message) =>
                      message.text
                        .toLowerCase()
                        .includes(messageSearch.toLowerCase()),
                    )
                    .map((message) => {
                      const own = message.authorId === user.id;
                      const quoted = active.messages.find(
                        (entry) => entry.id === message.replyTo,
                      );
                      const read = active.members.some(
                        (id) =>
                          id !== user.id &&
                          (active.readAt[id] ?? 0) >= message.sentAt,
                      );
                      return (
                        <article
                          key={message.id}
                          className={`chat-message${own ? " chat-message-own" : ""}`}
                        >
                          <div className="chat-bubble">
                            {!own && active.kind === "group" && (
                              <strong className="chat-author">
                                {person(message.authorId)}
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
                                {message.text && <p>{message.text}</p>}
                                {message.attachment && (
                                  <a
                                    href={message.attachment.data}
                                    download={message.attachment.name}
                                    className="chat-attachment"
                                  >
                                    {message.attachment.type.startsWith(
                                      "image/",
                                    ) && (
                                      <img
                                        src={message.attachment.data}
                                        alt={message.attachment.name}
                                      />
                                    )}
                                    {message.attachment.name}
                                  </a>
                                )}
                              </>
                            )}
                            <footer>
                              <time
                                title={formatDateTime(
                                  new Date(message.sentAt).toISOString(),
                                )}
                              >
                                {new Intl.DateTimeFormat("es-PE", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "America/Lima",
                                }).format(message.sentAt)}
                              </time>
                              {message.editedAt && <span>editado</span>}
                              {own &&
                                (read ? (
                                  <CheckCheck
                                    size={14}
                                    aria-label="Revisado en la demo local"
                                  />
                                ) : (
                                  <Check
                                    size={14}
                                    aria-label="Guardado en la demo local"
                                  />
                                ))}
                            </footer>
                          </div>
                          {!message.deleted && (
                            <div className="chat-message-actions">
                              <button
                                type="button"
                                aria-label="Responder mensaje"
                                onClick={() => {
                                  setReply(message);
                                  setEdit(null);
                                  input.current?.focus();
                                }}
                              >
                                <Reply size={14} />
                              </button>
                              <button
                                type="button"
                                aria-label="Reaccionar con emoji"
                                onClick={() => {
                                  setReactionTo(message.id);
                                  setEmoji(true);
                                }}
                              >
                                <Smile size={14} />
                              </button>
                              <button
                                type="button"
                                aria-label="Reenviar mensaje"
                                onClick={() => {
                                  setForward(message);
                                  setForwardTo("");
                                }}
                              >
                                <Forward size={14} />
                              </button>
                              <button
                                type="button"
                                aria-label="Copiar mensaje"
                                onClick={() => {
                                  void navigator.clipboard
                                    .writeText(message.text)
                                    .then(() =>
                                      toast.success("Mensaje copiado"),
                                    )
                                    .catch(() =>
                                      toast.error(
                                        "No se pudo copiar el mensaje",
                                      ),
                                    );
                                }}
                              >
                                <Copy size={14} />
                              </button>
                              {own && (
                                <button
                                  type="button"
                                  aria-label="Editar mensaje"
                                  onClick={() => {
                                    setEdit(message);
                                    setReply(null);
                                    setDraft(message.text);
                                    input.current?.focus();
                                  }}
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                              {(own ||
                                (user.role === "admin" &&
                                  active.kind === "group")) && (
                                <button
                                  type="button"
                                  aria-label="Eliminar mensaje"
                                  onClick={() =>
                                    update((next) =>
                                      changeMessage(
                                        next,
                                        user,
                                        active.id,
                                        message.id,
                                        null,
                                      ),
                                    )
                                  }
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          )}
                          {Object.keys(message.reactions).length > 0 && (
                            <div className="chat-reactions">
                              {[
                                ...new Set(Object.values(message.reactions)),
                              ].map((reaction) => (
                                <button
                                  type="button"
                                  key={reaction}
                                  aria-label={`Reacción ${reaction}`}
                                  aria-pressed={
                                    message.reactions[user.id] === reaction
                                  }
                                  onClick={() =>
                                    update((next) =>
                                      reactToMessage(
                                        next,
                                        user,
                                        active.id,
                                        message.id,
                                        reaction,
                                      ),
                                    )
                                  }
                                >
                                  {reaction}
                                  <span>
                                    {
                                      Object.values(message.reactions).filter(
                                        (value) => value === reaction,
                                      ).length
                                    }
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  {!active.messages.length && (
                    <div className="chat-list-empty">
                      <MessageCircle size={30} aria-hidden="true" />
                      <p>Empieza con un saludo 👋</p>
                    </div>
                  )}
                </div>
                {(reply || edit) && (
                  <div className="chat-composer-context">
                    <span>
                      <strong>
                        {edit
                          ? "Editar mensaje"
                          : `Responder a ${person(reply!.authorId)}`}
                      </strong>
                      <small>
                        {(edit ?? reply)?.text || "Archivo adjunto"}
                      </small>
                    </span>
                    <button
                      type="button"
                      aria-label="Cancelar respuesta o edición"
                      onClick={() => {
                        setReply(null);
                        setEdit(null);
                        setDraft("");
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {attachment && (
                  <div className="chat-composer-context">
                    <span>{attachment.name}</span>
                    <button
                      type="button"
                      aria-label="Quitar adjunto"
                      onClick={() => setAttachment(undefined)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                {emoji && (
                  <div className="chat-emoji-area">
                    <div>
                      <span>
                        {reactionTo ? "Reaccionar al mensaje" : "Elegir emoji"}
                      </span>
                      <button
                        type="button"
                        aria-label="Cerrar emojis"
                        onClick={() => {
                          setEmoji(false);
                          setReactionTo(null);
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <Suspense
                      fallback={<p className="chat-hint">Cargando emojis…</p>}
                    >
                      <EmojiPicker
                        onSelect={(value) => {
                          if (reactionTo) {
                            update((next) =>
                              reactToMessage(
                                next,
                                user,
                                active.id,
                                reactionTo,
                                value,
                              ),
                            );
                            setEmoji(false);
                            setReactionTo(null);
                          } else setDraft((current) => current + value);
                        }}
                      />
                    </Suspense>
                  </div>
                )}
                <form
                  className="chat-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                  }}
                >
                  <button
                    type="button"
                    aria-label="Seleccionar emoji"
                    aria-expanded={emoji}
                    onClick={() => {
                      setEmoji(!emoji);
                      setReactionTo(null);
                    }}
                  >
                    <Smile size={20} />
                  </button>
                  <button
                    type="button"
                    aria-label="Adjuntar imagen o archivo"
                    disabled={!!edit}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Paperclip size={19} />
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Seleccionar adjunto"
                    accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      if (
                        file.size > 3 * 1024 * 1024 ||
                        ![
                          "image/jpeg",
                          "image/png",
                          "image/webp",
                          "application/pdf",
                          "text/plain",
                        ].includes(file.type)
                      ) {
                        toast.error(
                          "Usa una imagen, PDF o texto de hasta 3 MB.",
                        );
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === "string")
                          setAttachment({
                            name: file.name,
                            type: file.type,
                            data: reader.result,
                          });
                      };
                      reader.onerror = () =>
                        toast.error("No se pudo abrir el adjunto.");
                      reader.readAsDataURL(file);
                    }}
                  />
                  <textarea
                    ref={input}
                    value={draft}
                    maxLength={4000}
                    aria-label="Escribir mensaje"
                    placeholder="Escribe un mensaje…"
                    rows={1}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        submit();
                      }
                    }}
                  />
                  <button
                    className="chat-send"
                    type="submit"
                    aria-label={
                      edit ? "Guardar edición" : "Enviar mensaje en la demo"
                    }
                    disabled={!draft.trim() && !attachment}
                  >
                    <Send size={19} />
                  </button>
                </form>
              </>
            ) : (
              <div className="chat-welcome">
                <span>
                  <MessageCircle size={36} aria-hidden="true" />
                </span>
                <h3>Conversaciones que acercan</h3>
                <p>
                  Mensajes directos y grupos del equipo, en tu espacio de
                  trabajo.
                </p>
                <Button variant="secondary" onClick={() => setTab("contacts")}>
                  Iniciar conversación
                </Button>
                <small>Sin stickers. Todos los emojis que necesitas.</small>
              </div>
            )}
          </section>
        )}
      </div>
      {groupEditor && (
        <ChatGroupEditor
          user={user}
          members={members}
          group={groupEditor === "new" ? undefined : groupEditor}
          onClose={() => setGroupEditor(null)}
          onSave={(name, description, memberIds) => {
            let id = "";
            const success = update((next) => {
              id = saveGroup(next, user, {
                id: groupEditor === "new" ? undefined : groupEditor.id,
                name,
                description,
                members: memberIds,
              });
            });
            if (success) {
              setTab("groups");
              selectThread(id);
            }
            return success;
          }}
          onDelete={() => {
            if (
              groupEditor !== "new" &&
              update((next) => deleteGroup(next, user, groupEditor.id))
            ) {
              setGroupEditor(null);
              setActiveId(null);
            }
          }}
        />
      )}
      <Sheet
        open={!!forward}
        title="Reenviar mensaje"
        onClose={() => setForward(null)}
      >
        {forward && (
          <div className="chat-group-form">
            <p>{forward.text || forward.attachment?.name}</p>
            <ChoicePicker
              label="Conversación de destino"
              value={forwardTo}
              onChange={setForwardTo}
              options={threads.map((thread) => ({
                value: thread.id,
                label: title(thread),
              }))}
            />
            <div className="chat-modal-actions">
              <Button variant="secondary" onClick={() => setForward(null)}>
                Cancelar
              </Button>
              <Button
                disabled={!forwardTo}
                onClick={() => {
                  if (
                    update((next) =>
                      sendMessage(next, user, forwardTo, {
                        text: forward.text ? `Reenviado: ${forward.text}` : "",
                        attachment: forward.attachment,
                      }),
                    )
                  )
                    setForward(null);
                }}
              >
                Reenviar
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </SidePanel>
  );
}
