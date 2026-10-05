import { lazy, Suspense, useState, useEffect, useRef } from "react";
import type { Profile } from "@vexa/domain/types";
import { toast } from "sonner";
import { useChat } from "@/features/chat/useChat";
import {
  notificationChime,
  prepareNotificationSound,
} from "@/features/notifications/notification-audio";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/features/auth/hooks/useAuth";
const ChatPanel = lazy(() => import("@/features/chat/ChatPanel"));
export function UserMenu() {
  const { user } = useAuth();
  return user ? <ChatEntry key={user.id} user={user} /> : null;
}
function ChatEntry({ user }: { user: Profile }) {
  const [open, setOpen] = useState(false);
  const chat = useChat(user);
  const previousIds = useRef(
    new Set(
      chat.threads.flatMap((thread) =>
        thread.messages.map((message) => message.id),
      ),
    ),
  );
  const unread = chat.threads.reduce(
    (count, thread) =>
      count +
      thread.messages.filter(
        (message) =>
          message.authorId !== user.id &&
          message.sentAt > (thread.readAt[user.id] ?? 0),
      ).length,
    0,
  );
  useEffect(() => {
    const messages = chat.threads.flatMap((thread) => thread.messages);
    const incoming = messages.filter(
      (message) =>
        !previousIds.current.has(message.id) && message.authorId !== user.id,
    );
    previousIds.current = new Set(messages.map((message) => message.id));
    if (incoming.length && chat.settings.notifications) {
      toast("Nuevo mensaje de chat", {
        description: incoming.at(-1)?.text.slice(0, 100) || "Archivo adjunto",
      });
      if (chat.settings.sound !== "none")
        notificationChime(chat.settings.sound);
    }
  }, [chat.threads, chat.settings.notifications, chat.settings.sound, user.id]);
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
        aria-expanded={open}
        aria-label={`Abrir chat de ${user.name}${unread ? `, ${unread} mensajes sin leer` : ""}`}
        onClick={() => setOpen(true)}
        className="relative flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
      >
        <Avatar name={user.name} size="sm" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 size-2 rounded-full bg-primary-solid ring-2 ring-surface"
          />
        )}
      </button>
      {open && (
        <Suspense
          fallback={
            <output className="text-xs text-muted">Abriendo chat…</output>
          }
        >
          <ChatPanel user={user} chat={chat} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
