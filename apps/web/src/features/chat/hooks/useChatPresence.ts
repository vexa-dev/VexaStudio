import { useEffect, useState } from "react";
import type { Id } from "@vexa/domain/types";
import { services } from "@/services";

/**
 * Publishes this tab's presence (only while visible) and returns
 * who is online: `userId -> last signal`. Mount it once, in the always-on entry.
 */
export function useChatPresence(): Record<Id, number> {
  const [online, setOnline] = useState<Record<Id, number>>({});
  useEffect(() => services.chat.subscribePresence(setOnline), []);
  useEffect(() => {
    const sync = () => services.chat.trackPresence(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      services.chat.trackPresence(false);
    };
  }, []);
  return online;
}
