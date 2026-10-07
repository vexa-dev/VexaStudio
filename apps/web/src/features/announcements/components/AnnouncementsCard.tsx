import { Megaphone, Pin, PinOff, Send } from "lucide-react";
import { useState } from "react";
import { canAccessStudio } from "@vexa/domain/access";
import {
  ANNOUNCEMENT_MAX_LENGTH,
  validateAnnouncementText,
} from "@vexa/domain/comments";
import { formatDateTime } from "@vexa/domain/dates";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextareaField } from "@/components/ui/Field";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembers } from "@/features/team/hooks/useMembers";
import { useAnnouncementActions, useAnnouncements } from "../hooks/useAnnouncements";

const VISIBLE = 4;

/**
 * Anuncios del estudio en Mi día: fijados primero y luego los más nuevos. Los ven admin y socios; solo
 * el admin publica y fija o desfija. Un colaborador no ve la tarjeta. Los anuncios no se borran.
 */
export function AnnouncementsCard() {
  const { user } = useAuth();
  const studio = canAccessStudio(user?.role);
  const announcements = useAnnouncements(studio);
  const members = useMembers();
  const { create, setPinned } = useAnnouncementActions();
  const [text, setText] = useState("");
  const [pinned, setPinnedDraft] = useState(false);
  const [touched, setTouched] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!user || !studio) return null;
  const isAdmin = user.role === "admin";
  const items = announcements.data ?? [];
  const shown = showAll ? items : items.slice(0, VISIBLE);
  const error = touched ? (validateAnnouncementText(text) ?? undefined) : undefined;
  const nameOf = (id: string) => members.data?.find((m) => m.id === id)?.name ?? "Administración";

  const publish = async () => {
    setTouched(true);
    if (validateAnnouncementText(text)) return;
    try {
      await create.mutateAsync({ text, pinned });
      setText("");
      setPinnedDraft(false);
      setTouched(false);
    } catch {
      // El aviso de error lo muestra el hook y el texto se conserva.
    }
  };

  return (
    <Card className="day-announcements-card">
      <div className="day-card-title">
        <h2>
          <Megaphone size={18} aria-hidden="true" /> Anuncios
        </h2>
      </div>

      {announcements.isLoading ? (
        <Skeleton className="h-16" />
      ) : announcements.isError ? (
        <ErrorState
          title="No se pudieron cargar los anuncios"
          onRetry={() => void announcements.refetch()}
        />
      ) : items.length === 0 ? (
        <p className="day-note">No hay anuncios por ahora.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 rounded-lg border border-border bg-surface-2 p-3"
            >
              <p className="whitespace-pre-wrap break-words text-sm">{item.text}</p>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="num text-xs text-muted">
                  {item.pinned && (
                    <span className="mr-2 inline-flex items-center gap-1 font-medium text-primary-text">
                      <Pin size={12} aria-hidden="true" /> Fijado
                    </span>
                  )}
                  {nameOf(item.authorId)} · {formatDateTime(item.createdAt)}
                </span>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={setPinned.isPending}
                    aria-label={`${item.pinned ? "Desfijar" : "Fijar"} el anuncio: ${item.text.slice(0, 40)}`}
                    onClick={() => setPinned.mutate({ id: item.id, pinned: !item.pinned })}
                  >
                    {item.pinned ? (
                      <PinOff size={14} aria-hidden="true" />
                    ) : (
                      <Pin size={14} aria-hidden="true" />
                    )}
                    {item.pinned ? "Desfijar" : "Fijar"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > VISIBLE && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Ver menos" : `Ver todos (${items.length})`}
        </Button>
      )}

      {isAdmin && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void publish();
          }}
        >
          <TextareaField
            label="Nuevo anuncio"
            value={text}
            maxLength={ANNOUNCEMENT_MAX_LENGTH}
            placeholder="Comparte algo importante con el equipo"
            error={error}
            disabled={create.isPending}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(event) => setPinnedDraft(event.target.checked)}
                className="size-4 accent-primary"
              />
              Fijar arriba
            </label>
            <Button type="submit" size="sm" disabled={create.isPending || !text.trim()}>
              <Send className="size-4" aria-hidden="true" />
              {create.isPending ? "Publicando…" : "Publicar"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
