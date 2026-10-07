import { lazy, Suspense, useState, useEffect, useRef } from "react";
import type { Profile } from "@vexa/domain/types";
import { toast } from "sonner";
import {
  countUnread,
  incomingMessages,
  incomingNotice,
  noticeTitle,
} from "@/features/chat/chat-logic";
import {
  useChatSettings,
  useChatSync,
  useChatThreads,
} from "@/features/chat/hooks/useChatData";
import { useChatPresence } from "@/features/chat/hooks/useChatPresence";
import {
  notificationChime,
  prepareNotificationSound,
} from "@/features/notifications/notification-audio";
import { MessageCircle } from "lucide-react";
import { unreadLabel } from "./unread-label";
import { nextChatMode, type ChatMode, type ChatModeAction } from "./chat-dock";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembers } from "@/features/team/hooks/useMembers";
const ChatPanel = lazy(() => import("@/features/chat/ChatPanel"));
export function UserMenu() {
  const { user } = useAuth();
  return user ? <ChatEntry key={user.id} user={user} /> : null;
}
function ChatEntry({ user }: { user: Profile }) {
  const [mode, setMode] = useState<ChatMode>("closed");
  // The panel mounts on first open and stays mounted while minimized to keep its state.
  const [mounted, setMounted] = useState(false);
  const [openRequest, setOpenRequest] = useState<{
    threadId: string;
    nonce: number;
  } | null>(null);
  const apply = (action: ChatModeAction) => {
    const next = nextChatMode(mode, action);
    if (next === mode) return;
    setMode(next);
    if (next === "open") setMounted(true);
    else if (next === "closed") {
      setMounted(false);
    }
  };
  useChatSync();
  const threads = useChatThreads(user.id);
  const { settings } = useChatSettings(user.id);
  // Read through a ref so a members refresh never re-runs the incoming-message effect.
  const membersRef = useRef<Profile[]>([]);
  membersRef.current = useMembers().data ?? [];
  const online = useChatPresence();
  // Null until the first load, so history is never announced as new.
  const previousIds = useRef<Set<string> | null>(null);
  const unread = countUnread(threads.data ?? [], user.id);
  useEffect(() => {
    const loaded = threads.data;
    if (!loaded || !settings) return;
    const incoming = previousIds.current
      ? incomingMessages(previousIds.current, loaded, user.id)
      : [];
    previousIds.current = new Set(
      loaded.flatMap((thread) => thread.messages.map((message) => message.id)),
    );
    const notice = incomingNotice(incoming, settings);
    if (!notice) return;
    const latest = incoming.at(-1);
    const author = membersRef.current.find(
      (member) => member.id === latest?.authorId,
    )?.name;
    const source = loaded.find((thread) =>
      thread.messages.some((message) => message.id === latest?.id),
    );
    const threadId = source?.id;
    const openFromToast = () => {
      // Closed, minimized or open: the toast always lands on an open panel.
      setMode((current) => nextChatMode(current, "open"));
      setMounted(true);
      if (threadId)
        setOpenRequest((prev) => ({ threadId, nonce: (prev?.nonce ?? 0) + 1 }));
    };
    toast(noticeTitle(author, source), {
      description: notice.body,
      action: {
        label: "Abrir conversación",
        onClick: openFromToast,
        actionButtonStyle: { minHeight: 44, minWidth: 44 },
      },
    });
    if (notice.sound) notificationChime(notice.sound);
  }, [threads.data, settings, user.id]);
  useEffect(() => {
    const unlock = () => {
      void prepareNotificationSound();
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={mode !== "closed"}
        aria-label={`${mode === "closed" ? "Abrir chat" : "Cerrar chat"}${unread ? `, ${unread} ${unread === 1 ? "mensaje sin leer" : "mensajes sin leer"}` : ""}`}
        onClick={() => apply("toggle")}
        className="relative flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="num absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-solid px-1 text-[10px] font-semibold leading-none text-primary-fg ring-2 ring-bg"
          >
            {unreadLabel(unread)}
          </span>
        )}
      </button>
      {mounted && (
        <Suspense
          fallback={
            <output className="text-xs text-muted">Abriendo chat…</output>
          }
        >
          <ChatPanel
            user={user}
            online={online}
            minimized={mode !== "open"}
            onMinimize={() => apply("minimize")}
            onRestore={() => apply("restore")}
            onConversationChange={(has) => {
              // Without an open chat there is nothing to keep: show the list again.
              if (!has && mode === "minimized") apply("restore");
            }}
            onClose={() => apply("close")}
            openRequest={openRequest}
          />
        </Suspense>
      )}
    </>
  );
}
