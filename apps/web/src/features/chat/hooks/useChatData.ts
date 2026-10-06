import { useCallback, useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  ChatAttachment,
  ChatMemberStatus,
  ChatMessage,
  ChatSettings,
  ChatThread,
} from "@vexa/domain/chat";
import type { Id } from "@vexa/domain/types";
import { services } from "@/services";
import { isSupabaseSource } from "@/services/supabase/data-source";
import { chatMediaRefresh } from "../chat-refresh";
import { applyReaction, needsDelivery } from "../chat-logic";

/** Keys carry the user id so switching accounts never shows someone else's chat. */
export const chatKeys = {
  threads: (userId: Id) => ["chat", "threads", userId] as const,
  status: (userId: Id) => ["chat", "status", userId] as const,
  settings: (userId: Id) => ["chat", "settings", userId] as const,
  wallpaper: (userId: Id) => ["chat", "wallpaper", userId] as const,
  shared: (userId: Id, threadId: Id) =>
    ["chat", "shared", userId, threadId] as const,
};

/** Refetches every chat query (not working-now) when the service reports a change. */
export function useChatSync() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      services.chat.subscribe(() => {
        for (const scope of [
          "threads",
          "status",
          "settings",
          "wallpaper",
          "shared",
        ])
          void queryClient.invalidateQueries({ queryKey: ["chat", scope] });
      }),
    [queryClient],
  );
}

/** Quiet period before delivery marks are written, so a burst becomes one write per thread. */
export const DELIVERY_DEBOUNCE_MS = 1000;
/** Newest message time already reported as received, per user and thread (shared by every caller). */
const reportedDeliveries = new Map<string, number>();

/**
 * Tells the sender that my open app received their messages. Never marks
 * them read (that stays with the open thread). A failed write is forgotten so
 * the next refresh retries; nothing retries on its own.
 */
function useDeliveryReceipts(userId: Id, threads: ChatThread[] | undefined) {
  useEffect(() => {
    if (!threads) return;
    const pending = threads.flatMap((thread) => {
      const latest = needsDelivery(thread, userId);
      const key = `${userId}:${thread.id}`;
      return latest !== null && latest > (reportedDeliveries.get(key) ?? 0)
        ? [{ key, threadId: thread.id, latest }]
        : [];
    });
    if (pending.length === 0) return;
    const timer = setTimeout(() => {
      for (const { key, threadId, latest } of pending) {
        if (latest <= (reportedDeliveries.get(key) ?? 0)) continue;
        reportedDeliveries.set(key, latest);
        services.chat.markDelivered(threadId).catch(() => {
          reportedDeliveries.delete(key);
        });
      }
    }, DELIVERY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [threads, userId]);
}

export function useChatThreads(userId: Id) {
  const query = useQuery({
    queryKey: chatKeys.threads(userId),
    queryFn: () => services.chat.listThreads(),
    ...chatMediaRefresh(isSupabaseSource()),
  });
  useDeliveryReceipts(userId, query.data);
  return query;
}

/** Status, presence flag and pinned project of every member. */
export function useChatStatus(userId: Id) {
  return useQuery({
    queryKey: chatKeys.status(userId),
    queryFn: () => services.chat.listMemberStatus(),
  });
}

export function useSharedMessages(
  userId: Id,
  threadId: Id | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: chatKeys.shared(userId, threadId ?? ""),
    queryFn: () => services.chat.listSharedMessages(threadId ?? ""),
    ...chatMediaRefresh(isSupabaseSource()),
    enabled: enabled && !!threadId,
  });
}

type Result<T> = { ok: true; value: T } | { ok: false };

interface MutationSpec<V, R> {
  run: (variables: V) => Promise<R>;
  /** Applies a cache change before the call and returns how to undo it. */
  optimistic?: (variables: V) => Promise<(() => void) | undefined>;
  /** Message when the failure carries no text of its own. */
  fallback: string;
  /** Background actions fail silently (nobody asked for them). */
  silent?: boolean;
  refresh: readonly (readonly string[])[];
}

/**
 * One chat action: optional optimistic update with rollback, a Spanish error
 * toast, and a refetch when it settles. Resolves to a result instead of
 * throwing so callers can reset their form only on success.
 */
function useChatAction<V, R>(spec: MutationSpec<V, R>) {
  const queryClient = useQueryClient();
  const mutation = useMutation<R, Error, V, { undo?: () => void }>({
    mutationFn: spec.run,
    onMutate: async (variables) => ({
      undo: await spec.optimistic?.(variables),
    }),
    onError: (error, _variables, context) => {
      context?.undo?.();
      if (!spec.silent) toast.error(error.message || spec.fallback);
    },
    // Awaited: the action resolves once fresh data is in the cache, so a thread
    // created by it can be opened right away.
    onSettled: async () => {
      await Promise.all(
        spec.refresh.map((key) =>
          queryClient.invalidateQueries({ queryKey: key }),
        ),
      );
    },
  });
  const { mutateAsync } = mutation;
  return useCallback(
    async (variables: V): Promise<Result<R>> => {
      try {
        return { ok: true, value: await mutateAsync(variables) };
      } catch {
        return { ok: false };
      }
    },
    [mutateAsync],
  );
}

const THREADS = ["chat", "threads"] as const;
const SETTINGS = ["chat", "settings"] as const;

async function patchThreads(
  queryClient: QueryClient,
  userId: Id,
  change: (threads: ChatThread[]) => ChatThread[],
): Promise<(() => void) | undefined> {
  const key = chatKeys.threads(userId);
  await queryClient.cancelQueries({ queryKey: key });
  const previous = queryClient.getQueryData<ChatThread[]>(key);
  if (!previous) return undefined;
  queryClient.setQueryData(key, change(previous));
  return () => queryClient.setQueryData(key, previous);
}

function mapThread(
  threads: ChatThread[],
  threadId: Id,
  change: (thread: ChatThread) => ChatThread,
) {
  return threads.map((thread) =>
    thread.id === threadId ? change(thread) : thread,
  );
}

/** Every chat write. Only send, react and markRead update the cache up front. */
export function useChatActions(userId: Id) {
  const queryClient = useQueryClient();
  const threads = [THREADS];

  const send = useChatAction({
    run: (v: {
      threadId: Id;
      text: string;
      attachment?: ChatAttachment;
      replyTo?: Id;
    }) =>
      services.chat.sendMessage(v.threadId, {
        text: v.text,
        attachment: v.attachment,
        replyTo: v.replyTo,
      }),
    optimistic: async (v) => {
      // Invalid input fails in the service; do not flash a message for it.
      if ((!v.text.trim() && !v.attachment) || v.text.length > 4000)
        return undefined;
      const now = Date.now();
      const pending: ChatMessage = {
        id: `pending-${crypto.randomUUID()}`,
        authorId: userId,
        text: v.text.trim(),
        sentAt: now,
        attachment: v.attachment,
        replyTo: v.replyTo,
        reactions: {},
      };
      return patchThreads(queryClient, userId, (all) =>
        mapThread(all, v.threadId, (thread) => ({
          ...thread,
          messages: [...thread.messages, pending],
          readAt: { ...thread.readAt, [userId]: now },
        })),
      );
    },
    fallback: "No se pudo enviar el mensaje.",
    refresh: threads,
  });

  const react = useChatAction({
    run: (v: { threadId: Id; messageId: Id; emoji: string }) =>
      services.chat.reactToMessage(v.threadId, v.messageId, v.emoji),
    optimistic: (v) =>
      patchThreads(queryClient, userId, (all) =>
        mapThread(all, v.threadId, (thread) => ({
          ...thread,
          messages: thread.messages.map((message) =>
            message.id === v.messageId && !message.deleted
              ? {
                  ...message,
                  reactions: applyReaction(message.reactions, userId, v.emoji),
                }
              : message,
          ),
        })),
      ),
    fallback: "No se pudo reaccionar al mensaje.",
    refresh: threads,
  });

  const markRead = useChatAction({
    run: (threadId: Id) => services.chat.markRead(threadId),
    optimistic: (threadId) =>
      patchThreads(queryClient, userId, (all) =>
        mapThread(all, threadId, (thread) => {
          const last = thread.messages.at(-1)?.sentAt ?? 0;
          if ((thread.readAt[userId] ?? 0) >= last) return thread;
          return {
            ...thread,
            readAt: { ...thread.readAt, [userId]: Date.now() },
          };
        }),
      ),
    fallback: "No se pudo marcar como leído.",
    silent: true,
    refresh: threads,
  });

  const edit = useChatAction({
    run: (v: { threadId: Id; messageId: Id; text: string }) =>
      services.chat.editMessage(v.threadId, v.messageId, v.text),
    fallback: "No se pudo editar el mensaje.",
    refresh: threads,
  });
  const remove = useChatAction({
    run: (v: { threadId: Id; messageId: Id }) =>
      services.chat.deleteMessage(v.threadId, v.messageId),
    fallback: "No se pudo eliminar el mensaje.",
    refresh: threads,
  });
  const forward = useChatAction({
    run: (v: { fromThreadId: Id; messageId: Id; toThreadId: Id }) =>
      services.chat.forwardMessage(v.fromThreadId, v.messageId, v.toThreadId),
    fallback: "No se pudo reenviar el mensaje.",
    refresh: threads,
  });
  const markDownloaded = useChatAction({
    run: (messageId: Id) => services.chat.markAttachmentDownloaded(messageId),
    fallback: "No se pudo registrar la descarga.",
    silent: true,
    refresh: threads,
  });
  const answerKeep = useChatAction({
    run: (v: { messageId: Id; keep: boolean }) =>
      services.chat.answerAttachmentKeep(v.messageId, v.keep),
    fallback: "No se pudo guardar tu respuesta.",
    refresh: threads,
  });
  const purgeReleased = useChatAction({
    run: (messageId: Id) => services.chat.purgeReleasedAttachment(messageId),
    fallback: "No se pudo liberar el espacio del archivo.",
    silent: true,
    refresh: threads,
  });
  const directThread = useChatAction({
    run: (otherId: Id) => services.chat.directThread(otherId),
    fallback: "No se pudo abrir la conversación.",
    refresh: threads,
  });
  const saveGroup = useChatAction({
    run: (input: {
      id?: Id;
      name: string;
      description: string;
      members: Id[];
    }) => services.chat.saveGroup(input),
    fallback: "No se pudo guardar el grupo.",
    refresh: threads,
  });
  const deleteGroup = useChatAction({
    run: (id: Id) => services.chat.deleteGroup(id),
    fallback: "No se pudo eliminar el grupo.",
    refresh: threads,
  });

  return {
    send,
    edit,
    remove,
    react,
    forward,
    markRead,
    markDownloaded,
    answerKeep,
    purgeReleased,
    directThread,
    saveGroup,
    deleteGroup,
  };
}

/** The user's own chat settings; changes refetch (no optimistic update). */
export function useChatSettings(userId: Id) {
  const query = useQuery({
    queryKey: chatKeys.settings(userId),
    queryFn: () => services.chat.getSettings(),
  });
  const update = useChatAction({
    run: (patch: Partial<ChatSettings>) => services.chat.updateSettings(patch),
    fallback: "No se pudieron guardar los ajustes de mensajería.",
    refresh: [SETTINGS, ["chat", "status"]],
  });
  return { query, settings: query.data, update };
}

/** The user's own wallpaper image, kept out of the settings. */
export function useWallpaperImage(userId: Id) {
  const query = useQuery({
    queryKey: chatKeys.wallpaper(userId),
    queryFn: () => services.chat.getWallpaperImage(),
  });
  const save = useChatAction({
    run: (dataUrl: string) => services.chat.saveWallpaperImage(dataUrl),
    fallback: "La imagen es demasiado pesada para guardarla.",
    refresh: [["chat", "wallpaper"]],
  });
  const remove = useChatAction<void, void>({
    run: () => services.chat.removeWallpaperImage(),
    fallback: "No se pudo quitar la imagen.",
    refresh: [["chat", "wallpaper"]],
  });
  return { image: query.data ?? null, save, remove: () => remove() };
}

export type ChatStatusMap = Record<Id, ChatMemberStatus>;
