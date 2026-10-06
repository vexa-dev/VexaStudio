import { chatCopy } from "./chat-copy";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  FlaskConical,
  FolderOpen,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Settings2,
  SquarePen,
  UserRound,
  PanelLeftOpen,
  Users,
  X,
} from "lucide-react";
import type { Profile } from "@vexa/domain/types";
import { chatPanelVisibility } from "@/app/chat-panel-visibility";
import { SidePanel } from "@/components/ui/SidePanel";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { BrandLogo } from "@/components/BrandLogo";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { isSupabaseSource } from "@/services/supabase/data-source";
import { useMembers } from "@/features/team/hooks/useMembers";
import { ChatGroupEditor } from "./ChatGroupEditor";
import { ChatProfilePanel } from "./ChatProfilePanel";
import { ChatFilesPanel } from "./ChatFilesPanel";
import { collectSharedMedia } from "./shared-media";
import { ChatComposer } from "./ChatComposer";
import {
  ChatConversationIntro,
  ChatEmptyState,
  ChatListEmpty,
} from "./ChatEmptyState";
import { ChatMessageList } from "./ChatMessageList";
import { shortTime } from "./chat-format";
import { threadIdentity } from "./thread-identity";
import { chatSubtitle } from "./chat-subtitle";
import { useWorkingNow } from "./useWorkingNow";
import { ChatPersonRow } from "./ChatPersonRow";
import { areaLabel, roleLabel } from "@/lib/labels";
import type {
  ChatAttachment,
  ChatMessage,
  ChatThread,
} from "@vexa/domain/chat";
import {
  countUnread,
  sortThreadsByActivity,
  unreadByThread,
} from "./chat-logic";
import { defaultChatSettings } from "./chat-store";
import {
  useChatActions,
  useChatSettings,
  useChatStatus,
  useChatThreads,
  useSharedMessages,
  useWallpaperImage,
} from "./hooks/useChatData";
import { wallpaperStyle } from "./chat-wallpaper";
import "../../app/user-menu.css";
import "./chat.css";
import "./chat-list.css";
const EmojiPicker = lazy(() => import("./EmojiPicker"));

export default function ChatPanel({
  user,
  online,
  onClose,
  minimized,
  onMinimize,
  onRestore,
  onConversationChange,
  openRequest,
}: {
  user: Profile;
  /** `userId -> last signal` of the people who are online. */
  online: Record<string, number>;
  onClose: () => void;
  minimized?: boolean;
  onMinimize?: () => void;
  onRestore?: () => void;
  onConversationChange?: (hasConversation: boolean) => void;
  /** Selects a conversation from outside (e.g. a toast); a new `nonce` re-triggers it. */
  openRequest?: { threadId: string; nonce: number } | null;
}) {
  const membersQuery = useMembers();
  const members = membersQuery.data ?? [user];
  const threadsQuery = useChatThreads(user.id);
  const threads = useMemo(
    () => sortThreadsByActivity(threadsQuery.data ?? []),
    [threadsQuery.data],
  );
  const statusMap = useChatStatus(user.id).data;
  const { settings } = useChatSettings(user.id);
  const { image: wallpaperImage } = useWallpaperImage(user.id);
  const actions = useChatActions(user.id);
  const { markRead } = actions;
  /** What everybody may see about a person; defaults until it loads. */
  const statusOf = (id: string | undefined) =>
    (id && statusMap?.[id]) || defaultChatSettings;
  const [tab, setTab] = useState<"chats" | "contacts" | "groups">("chats");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  // Refreshed every minute so "Hoy"/"Ayer" labels stay right across midnight.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
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
  const [profileId, setProfileId] = useState<string | null>(null);
  // The profile belongs to the conversation it was opened from.
  const [profileThreadId, setProfileThreadId] = useState<string | null>(null);
  // The files panel also belongs to one conversation; only one panel is open.
  const [filesThreadId, setFilesThreadId] = useState<string | null>(null);
  const openProfile = (id: string) => {
    setProfileId(id);
    setProfileThreadId(activeId);
    setFilesThreadId(null);
  };
  const closeProfile = useCallback(() => setProfileThreadId(null), []);
  const openFiles = () => {
    setProfileThreadId(null);
    setFilesThreadId(activeId);
  };
  const closeFiles = useCallback(() => setFilesThreadId(null), []);
  const input = useRef<HTMLTextAreaElement>(null);
  const messageSearchInput = useRef<HTMLInputElement>(null);
  const listSearchInput = useRef<HTMLInputElement>(null);
  const active = threads.find((thread) => thread.id === activeId);
  const visibility = chatPanelVisibility(!!minimized, !!active);
  useEffect(() => {
    onConversationChange?.(!!active);
  }, [active, onConversationChange]);
  const sharedOpen =
    (profileThreadId !== null && profileThreadId === activeId) ||
    (filesThreadId !== null && filesThreadId === activeId);
  const sharedMessages = useSharedMessages(user.id, activeId, sharedOpen).data;
  const shared = useMemo(
    () => collectSharedMedia(sharedMessages ?? []),
    [sharedMessages],
  );
  const activeIdentity = active
    ? threadIdentity(active, user.id, members)
    : undefined;
  const otherId = activeIdentity?.otherId;
  const otherMember = members.find((member) => member.id === otherId);
  const working = useWorkingNow(
    otherId ?? "",
    statusOf(otherId).currentProjectId,
  );
  const subtitle = active
    ? chatSubtitle({
        kind: active.kind,
        working: otherId ? (working.data ?? null) : null,
        online: !!otherId && !!online[otherId],
        status: statusOf(otherId).status,
        memberCount: active.members.length,
      })
    : "";
  function person(id: string) {
    return members.find((member) => member.id === id)?.name ?? "Integrante";
  }
  function title(thread: ChatThread) {
    return threadIdentity(thread, user.id, members).title;
  }
  function presenceDot(id: string | undefined) {
    const isOnline = !!id && !!online[id];
    return (
      <i
        className={isOnline ? "chat-online-dot" : "chat-offline-dot"}
        aria-label={chatCopy.presence(isOnline)}
      />
    );
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
    setSearchOpen(false);
    setFilesThreadId(null);
  }
  // Opening a conversation from outside reuses selectThread; markRead follows from the active thread.
  const requestedNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!openRequest || requestedNonce.current === openRequest.nonce) return;
    requestedNonce.current = openRequest.nonce;
    setTab("chats");
    selectThread(openRequest.threadId);
    // selectThread only sets local state, so depending on the request alone is enough.
  }, [openRequest]);
  function closeMessageSearch() {
    setMessageSearch("");
    setSearchOpen(false);
  }
  const unreadMap = useMemo(
    () => unreadByThread(threads, user.id),
    [threads, user.id],
  );
  // One markRead per thread and last message: a failure never retries in a loop.
  const marked = useRef("");
  const activeThreadId = active?.id;
  const lastSentAt = active?.messages.at(-1)?.sentAt;
  const myReadAt = active?.readAt[user.id] ?? 0;
  useEffect(() => {
    if (!activeThreadId || !lastSentAt || myReadAt >= lastSentAt) return;
    const token = `${activeThreadId}:${lastSentAt}`;
    if (marked.current === token) return;
    marked.current = token;
    void markRead(activeThreadId);
  }, [activeThreadId, lastSentAt, myReadAt, markRead]);
  useEffect(() => {
    if (searchOpen) messageSearchInput.current?.focus();
  }, [searchOpen]);
  function resetComposer() {
    setDraft("");
    setAttachment(undefined);
    setReply(null);
    setEdit(null);
    setEmoji(false);
    input.current?.focus();
  }
  async function submit() {
    if (!active) return;
    if (edit) {
      const edited = await actions.edit({
        threadId: active.id,
        messageId: edit.id,
        text: draft,
      });
      if (edited.ok) resetComposer();
      return;
    }
    // Sending is optimistic: clear the composer now, restore it if it fails.
    const sent = { draft, attachment, reply };
    resetComposer();
    const result = await actions.send({
      threadId: active.id,
      text: sent.draft,
      attachment: sent.attachment,
      replyTo: sent.reply?.id,
    });
    if (!result.ok) {
      setDraft((current) => current || sent.draft);
      setAttachment((current) => current ?? sent.attachment);
      setReply((current) => current ?? sent.reply);
    }
  }
  async function openDirect(memberId: string) {
    const result = await actions.directThread(memberId);
    if (result.ok) {
      selectThread(result.value);
      setTab("chats");
    }
  }
  const filteredThreads = threads.filter(
    (thread) =>
      (tab !== "groups" || thread.kind === "group") &&
      `${title(thread)} ${thread.messages.at(-1)?.text ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const contacts = members.filter(
    (member) =>
      member.id !== user.id &&
      member.active &&
      member.name.toLowerCase().includes(query.toLowerCase()),
  );
  const onlineCount = members.filter(
    (member) =>
      member.id !== user.id &&
      member.active &&
      !!online[member.id] &&
      statusOf(member.id).presence,
  ).length;
  const unreadTotal = countUnread(threads, user.id);
  const summary =
    [
      onlineCount > 0 && `${onlineCount} en línea`,
      unreadTotal > 0 && `${unreadTotal} sin leer`,
    ]
      .filter(Boolean)
      .join(" · ") || "VEXA Studio";
  function startNewChat() {
    onRestore?.();
    setActiveId(null);
    setTab("contacts");
    setQuery("");
    listSearchInput.current?.focus();
  }
  return (
    <SidePanel
      title="Chat VEXA"
      onClose={onClose}
      className={`chat-drawer${minimized && active ? " chat-contacts-minimized" : ""}`}
      header={
        <>
          <div className="chat-heading-main">
            <BrandLogo className="chat-heading-brand" decorative />
            <div className="chat-heading-copy">
              <strong aria-hidden="true">Chat</strong>
              <small>{summary}</small>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-11 px-0"
            aria-label="Nuevo chat"
            onClick={startNewChat}
          >
            <SquarePen size={20} aria-hidden="true" />
          </Button>
          {active && (minimized ? onRestore : onMinimize) && (
            <Button
              variant="ghost"
              className="w-11 px-0"
              aria-label={
                minimized ? "Restaurar contactos" : "Minimizar contactos"
              }
              title={minimized ? "Restaurar contactos" : "Minimizar contactos"}
              onClick={minimized ? onRestore : onMinimize}
            >
              {minimized ? (
                <PanelLeftOpen size={20} aria-hidden="true" />
              ) : (
                <Minus size={20} aria-hidden="true" />
              )}
            </Button>
          )}
        </>
      }
    >
      <div className="chat-workspace">
        <aside
          hidden={visibility.contactsHidden}
          className={`chat-sidebar${active ? " chat-mobile-hidden" : ""}`}
        >
          {!isSupabaseSource() && (
            <div className="chat-sidebar-head">
              <span
                className="chat-demo-badge"
                title="Demo local: los mensajes y la conexión se comparten solo entre pestañas de este navegador."
              >
                <FlaskConical size={13} aria-hidden="true" />
                Demo local
                <span className="sr-only">
                  : los mensajes y la conexión se comparten solo entre pestañas
                  de este navegador.
                </span>
              </span>
            </div>
          )}
          <nav className="chat-tabs" aria-label="Apartados del chat">
            {(
              [
                { id: "chats", icon: MessageCircle, label: "Chats" },
                { id: "contacts", icon: UserRound, label: "Personas" },
                { id: "groups", icon: Users, label: "Grupos" },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                type="button"
                key={id}
                aria-pressed={tab === id}
                onClick={() => {
                  setTab(id);
                  setQuery("");
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="chat-search vexa-search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={listSearchInput}
              className="chat-search-input"
              aria-label="Buscar conversaciones o personas"
              placeholder="Buscar…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
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
                {contacts.map((member) => {
                  const isOnline =
                    !!online[member.id] && statusOf(member.id).presence;
                  return (
                    <ChatPersonRow
                      key={member.id}
                      memberId={member.id}
                      name={member.name}
                      avatarSrc={member.avatarUrl}
                      online={isOnline}
                      status={statusOf(member.id).status}
                      currentProjectId={statusOf(member.id).currentProjectId}
                      detail={isOnline ? "En línea" : "Sin conexión"}
                      onSelect={() => void openDirect(member.id)}
                    />
                  );
                })}
                {!membersQuery.isPending &&
                  !membersQuery.isError &&
                  !contacts.length && (
                    <ChatListEmpty
                      title={query ? "Sin resultados" : "Aún no hay personas"}
                      hint={
                        query
                          ? "Prueba con otro nombre."
                          : "Cuando se sume alguien al equipo aparecerá aquí."
                      }
                    />
                  )}
              </>
            ) : (
              <>
                {threadsQuery.isPending && (
                  <output
                    className="flex flex-col gap-2 p-3"
                    aria-label="Cargando conversaciones"
                  >
                    {[0, 1, 2, 3].map((row) => (
                      <Skeleton key={row} className="h-14" />
                    ))}
                  </output>
                )}
                {threadsQuery.isError && (
                  <ErrorState
                    title="No se pudieron cargar los chats"
                    message={threadsQuery.error.message}
                    onRetry={() => void threadsQuery.refetch()}
                  />
                )}
                {filteredThreads.map((thread) => {
                  const identity = threadIdentity(thread, user.id, members);
                  const last = thread.messages.at(-1);
                  const count = unreadMap[thread.id] ?? 0;
                  const preview = last?.deleted
                    ? "Mensaje eliminado"
                    : last?.text ||
                      (last?.attachment
                        ? "Archivo adjunto"
                        : thread.description || "Empieza la conversación");
                  const lastLine =
                    last && !last.deleted && last.authorId === user.id
                      ? `Tú: ${preview}`
                      : preview;
                  const otherPerson = identity.otherId;
                  if (thread.kind === "direct" && otherPerson)
                    return (
                      <ChatPersonRow
                        key={thread.id}
                        memberId={otherPerson}
                        name={identity.title}
                        avatarSrc={identity.avatarSrc}
                        online={!!online[otherPerson]}
                        status={statusOf(otherPerson).status}
                        currentProjectId={
                          statusOf(otherPerson).currentProjectId
                        }
                        detail={lastLine}
                        time={last ? shortTime(last.sentAt, now) : undefined}
                        unread={count}
                        selected={activeId === thread.id}
                        onSelect={() => selectThread(thread.id)}
                      />
                    );
                  return (
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
                        <span className="chat-avatar-wrap">
                          <Avatar
                            name={identity.title}
                            src={identity.avatarSrc}
                          />
                          {presenceDot(identity.otherId)}
                        </span>
                      )}
                      <span className="chat-thread-body">
                        <span className="chat-thread-top">
                          <strong>{identity.title}</strong>
                          {last && (
                            <time className="chat-thread-time">
                              {shortTime(last.sentAt, now)}
                            </time>
                          )}
                        </span>
                        <span className="chat-thread-bottom">
                          <small>
                            {last && !last.deleted && last.authorId === user.id
                              ? `Tú: ${preview}`
                              : preview}
                          </small>
                          {count > 0 && (
                            <b
                              className="chat-unread"
                              aria-label={`${count} sin leer`}
                            >
                              {count > 99 ? "99+" : count}
                            </b>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {!threadsQuery.isPending &&
                  !threadsQuery.isError &&
                  !filteredThreads.length &&
                  (query ? (
                    <ChatListEmpty
                      title="Sin resultados"
                      hint="Prueba con otro nombre o mensaje."
                    />
                  ) : tab === "groups" ? (
                    <ChatListEmpty
                      title="Aún no hay grupos"
                      hint={
                        user.role === "admin"
                          ? "Crea un grupo y asigna a sus integrantes."
                          : "Aquí aparecerán los grupos a los que te asignen."
                      }
                    />
                  ) : (
                    <ChatListEmpty
                      title="Aún no tienes chats"
                      hint="Elige a alguien de Personas para enviar tu primer mensaje."
                      actionLabel="Nueva conversación"
                      onAction={() => setTab("contacts")}
                    />
                  ))}
              </>
            )}
          </div>
        </aside>
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
                  onClick={() => {
                    onRestore?.();
                    setActiveId(null);
                  }}
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </Button>
                {active.kind === "group" ? (
                  <>
                    <span className="chat-group-avatar" aria-hidden="true">
                      <Users size={20} />
                    </span>
                    <div className="chat-heading-text">
                      <h3>{activeIdentity?.title}</h3>
                      <p>{subtitle}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="chat-heading-avatar"
                      aria-label={`Ver perfil de ${activeIdentity?.title ?? ""}`}
                      onClick={() => otherId && openProfile(otherId)}
                    >
                      <span className="chat-avatar-wrap">
                        <Avatar
                          name={activeIdentity?.title ?? ""}
                          src={activeIdentity?.avatarSrc}
                        />
                        {presenceDot(otherId)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="chat-heading-text chat-heading-profile"
                      aria-label={`Ver perfil de ${activeIdentity?.title ?? ""}`}
                      onClick={() => otherId && openProfile(otherId)}
                    >
                      <h3>{activeIdentity?.title}</h3>
                      <p>{subtitle}</p>
                    </button>
                  </>
                )}
                <Button
                  variant="ghost"
                  className="chat-icon-button"
                  aria-label="Archivos compartidos"
                  onClick={openFiles}
                >
                  <FolderOpen size={18} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="chat-icon-button"
                  aria-label="Buscar en esta conversación"
                  aria-expanded={searchOpen}
                  aria-controls="chat-message-search"
                  onClick={() =>
                    searchOpen ? closeMessageSearch() : setSearchOpen(true)
                  }
                >
                  <Search size={18} aria-hidden="true" />
                </Button>
                {active.kind === "group" && user.role === "admin" && (
                  <Button
                    variant="ghost"
                    className="chat-icon-button"
                    aria-label="Administrar grupo"
                    onClick={() => setGroupEditor(active)}
                  >
                    <Settings2 size={18} aria-hidden="true" />
                  </Button>
                )}
              </header>
              {searchOpen && (
                <div className="chat-message-search vexa-search" id="chat-message-search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    ref={messageSearchInput}
                    className="chat-search-input"
                    placeholder="Buscar en esta conversación"
                    aria-label="Buscar mensajes"
                    value={messageSearch}
                    onChange={(event) => setMessageSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        closeMessageSearch();
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Cerrar búsqueda"
                    onClick={closeMessageSearch}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
              {active.kind === "group" && active.description && (
                <p className="chat-group-description">{active.description}</p>
              )}
              <ChatMessageList
                thread={active}
                user={user}
                members={members}
                search={messageSearch}
                now={now}
                style={wallpaperStyle(
                  settings?.wallpaper ?? defaultChatSettings.wallpaper,
                  wallpaperImage,
                )}
                emptyState={
                  <ChatConversationIntro
                    title={activeIdentity?.title ?? ""}
                    avatarSrc={activeIdentity?.avatarSrc ?? null}
                    group={active.kind === "group"}
                    onOpenProfile={
                      otherId ? () => openProfile(otherId) : undefined
                    }
                    detail={
                      active.kind === "group"
                        ? `${active.members.length} integrantes`
                        : otherMember
                          ? `${roleLabel[otherMember.role]} · ${areaLabel[otherMember.area]}`
                          : "Integrante del equipo"
                    }
                    status={active.kind === "group" ? undefined : subtitle}
                    hint={
                      active.kind === "group"
                        ? "Aún no hay mensajes. Escribe al grupo para empezar."
                        : "Aún no hay mensajes. Escribe abajo para saludar."
                    }
                  />
                }
                onReply={(message) => {
                  setReply(message);
                  setEdit(null);
                  input.current?.focus();
                }}
                onEdit={(message) => {
                  setEdit(message);
                  setReply(null);
                  setDraft(message.text);
                  input.current?.focus();
                }}
                onReact={(message) => {
                  setReactionTo(message.id);
                  setEmoji(true);
                }}
                onForward={(message) => {
                  setForward(message);
                  setForwardTo("");
                }}
              />
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
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <Suspense
                    fallback={<p className="chat-hint">Cargando emojis…</p>}
                  >
                    <EmojiPicker
                      onClose={() => {
                        setEmoji(false);
                        setReactionTo(null);
                      }}
                      onSelect={(value) => {
                        if (reactionTo) {
                          void actions.react({
                            threadId: active.id,
                            messageId: reactionTo,
                            emoji: value,
                          });
                          setEmoji(false);
                          setReactionTo(null);
                        } else setDraft((current) => current + value);
                      }}
                    />
                  </Suspense>
                </div>
              )}
              <ChatComposer
                draft={draft}
                onDraftChange={setDraft}
                attachment={attachment}
                onAttachmentChange={setAttachment}
                reply={reply}
                edit={edit}
                replyAuthor={reply ? person(reply.authorId) : ""}
                onCancelContext={() => {
                  setReply(null);
                  setEdit(null);
                  setDraft("");
                }}
                emojiOpen={emoji}
                onToggleEmoji={() => {
                  setEmoji(!emoji);
                  setReactionTo(null);
                }}
                onSubmit={() => void submit()}
                inputRef={input}
              />
            </>
          ) : (
            <ChatEmptyState onNewChat={() => setTab("contacts")} />
          )}
          <ChatProfilePanel
            member={members.find((member) => member.id === profileId) ?? null}
            open={profileThreadId !== null && profileThreadId === activeId}
            status={profileId ? statusOf(profileId).status : undefined}
            currentProjectId={statusOf(profileId ?? undefined).currentProjectId}
            online={
              !!profileId && !!online[profileId] && statusOf(profileId).presence
            }
            fileCount={
              shared.media.length +
              shared.documents.length +
              shared.links.length
            }
            onOpenFiles={openFiles}
            onClose={closeProfile}
          />
          <ChatFilesPanel
            open={filesThreadId !== null && filesThreadId === activeId}
            title={activeIdentity?.title ?? ""}
            shared={shared}
            authorName={person}
            onClose={closeFiles}
          />
        </section>
      </div>
      {groupEditor && (
        <ChatGroupEditor
          user={user}
          members={members}
          group={groupEditor === "new" ? undefined : groupEditor}
          onClose={() => setGroupEditor(null)}
          onSave={async (name, description, memberIds) => {
            const result = await actions.saveGroup({
              id: groupEditor === "new" ? undefined : groupEditor.id,
              name,
              description,
              members: memberIds,
            });
            if (result.ok) {
              setTab("groups");
              selectThread(result.value);
            }
            return result.ok;
          }}
          onDelete={async () => {
            if (groupEditor === "new") return;
            const result = await actions.deleteGroup(groupEditor.id);
            if (result.ok) {
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
                disabled={!forwardTo || !active}
                onClick={async () => {
                  if (!active) return;
                  const result = await actions.forward({
                    fromThreadId: active.id,
                    messageId: forward.id,
                    toThreadId: forwardTo,
                  });
                  if (result.ok) setForward(null);
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
