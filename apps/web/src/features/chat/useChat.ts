import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "@vexa/domain/types";
import { toast } from "sonner";
import {
  CHAT_KEY,
  emptyChatStore,
  canOpenThread,
  defaultChatSettings,
  type ChatStore,
} from "./chat-store";

function readStore(): ChatStore {
  try {
    const stored = JSON.parse(localStorage.getItem(CHAT_KEY) ?? "null");
    if (
      stored &&
      Array.isArray(stored.threads) &&
      stored.settings &&
      typeof stored.settings === "object"
    )
      return stored;
  } catch {
    /* Sin almacenamiento disponible. */
  }
  return emptyChatStore();
}
export function useChat(user: Profile) {
  const [store, setStore] = useState(readStore);
  const [online, setOnline] = useState<Record<string, number>>({});
  const settings = store.settings[user.id] ?? defaultChatSettings;
  const presence = useRef(settings.presence);
  useEffect(() => {
    presence.current = settings.presence;
  }, [settings.presence]);
  useEffect(() => {
    const refresh = () => setStore(readStore());
    window.addEventListener("storage", refresh);
    window.addEventListener("vexa-chat-update", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("vexa-chat-update", refresh);
    };
  }, []);
  useEffect(() => {
    const prefix = "vexa.chat-presence.";
    const key = `${prefix}${user.id}.${crypto.randomUUID()}`;
    function beat() {
      try {
        if (presence.current && !document.hidden)
          localStorage.setItem(
            key,
            JSON.stringify({ userId: user.id, at: Date.now() }),
          );
        else localStorage.removeItem(key);
        const result: Record<string, number> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const candidate = localStorage.key(i);
          if (!candidate?.startsWith(prefix)) continue;
          const entry = JSON.parse(localStorage.getItem(candidate) ?? "null");
          if (
            entry?.userId &&
            typeof entry.at === "number" &&
            Date.now() - entry.at < 45000
          )
            result[entry.userId] = Math.max(
              result[entry.userId] ?? 0,
              entry.at,
            );
        }
        setOnline(result);
      } catch {
        /* La presencia de la demo es opcional. */
      }
    }
    beat();
    const timer = window.setInterval(beat, 15000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
      try {
        localStorage.removeItem(key);
      } catch {
        /* Sin almacenamiento. */
      }
    };
  }, [user.id, settings.presence]);
  const update = useCallback((change: (next: ChatStore) => void): boolean => {
    try {
      const next = readStore();
      change(next);
      localStorage.setItem(CHAT_KEY, JSON.stringify(next));
      setStore(next);
      window.dispatchEvent(new Event("vexa-chat-update"));
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la vista previa del chat.",
      );
      return false;
    }
  }, []);
  return {
    store,
    update,
    settings,
    online,
    threads: store.threads.filter((thread) => canOpenThread(thread, user)),
  };
}
