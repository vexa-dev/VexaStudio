import { MessageSquare, Send } from "lucide-react";
import { useMemo, useState } from "react";
import {
  COMMENT_MAX_LENGTH,
  memberHandle,
  resolveMentions,
  validateCommentText,
} from "@vexa/domain/comments";
import { formatDateTime } from "@vexa/domain/dates";
import type { CommentEntity, Id, Profile } from "@vexa/domain/types";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMembers } from "@/features/team/hooks/useMembers";
import { useAddComment, useComments } from "../hooks/useComments";
import { MentionTextarea } from "./MentionTextarea";

interface CommentThreadProps {
  entity: CommentEntity;
  entityId: Id;
  title?: string;
  /** Texto del campo (por defecto "Escribe un comentario"). */
  label?: string;
  placeholder?: string;
  submitLabel?: string;
}

/** Texto del comentario con las menciones reconocidas resaltadas (el resto es texto plano). */
function CommentText({ text, members }: { text: string; members: Profile[] }) {
  const handles = useMemo(
    () => new Set(members.map((m) => memberHandle(m)).filter(Boolean)),
    [members],
  );
  const parts = text.split(/((?<![\p{L}\p{N}_.@])@[a-z0-9_.]{1,30})/giu);
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {parts.map((part, index) =>
        part.startsWith("@") && handles.has(part.slice(1).toLowerCase().replace(/\.+$/, "")) ? (
          <strong key={index} className="font-semibold text-primary-text">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </p>
  );
}

/**
 * Hilo de comentarios de una entidad con @menciones. Los comentarios no se editan ni se borran. Lo que se
 * puede leer o comentar lo decide el servicio (tarea, registro de horas o gasto visibles para la persona).
 */
export function CommentThread({
  entity,
  entityId,
  title = "Comentarios",
  label = "Escribe un comentario",
  placeholder = "Comparte una duda, un avance o una objeción",
  submitLabel = "Comentar",
}: CommentThreadProps) {
  const { user } = useAuth();
  const comments = useComments(entity, entityId);
  const members = useMembers();
  const add = useAddComment(entity, entityId);
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);

  const people = useMemo(() => (members.data ?? []).filter((m) => m.active), [members.data]);
  const nameOf = (id: Id) => members.data?.find((m) => m.id === id)?.name ?? "Persona";
  const error = touched ? (validateCommentText(text) ?? undefined) : undefined;

  const submit = async () => {
    setTouched(true);
    if (validateCommentText(text)) return;
    try {
      await add.mutateAsync({ text, mentions: resolveMentions(text, people, user?.id) });
      setText("");
      setTouched(false);
    } catch {
      // El aviso de error lo muestra el hook y el texto se conserva para reintentar.
    }
  };

  const headingId = `comments-${entity}-${entityId}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h4 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="size-4" aria-hidden="true" />
        {title}
        {comments.data && comments.data.length > 0 && (
          <span className="num text-muted">({comments.data.length})</span>
        )}
      </h4>

      {comments.isLoading || members.isLoading ? (
        <Skeleton className="h-16" />
      ) : comments.isError ? (
        <ErrorState
          title="No se pudieron cargar los comentarios"
          onRetry={() => void comments.refetch()}
        />
      ) : comments.data && comments.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {comments.data.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar
                name={nameOf(comment.userId)}
                size="sm"
                src={members.data?.find((m) => m.id === comment.userId)?.avatarUrl}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-medium">{nameOf(comment.userId)}</span>
                  <time className="num text-xs text-muted" dateTime={comment.createdAt}>
                    {formatDateTime(comment.createdAt)}
                  </time>
                </div>
                <CommentText text={comment.text} members={members.data ?? []} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Aún no hay comentarios.</p>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <MentionTextarea
          label={label}
          value={text}
          onChange={setText}
          members={people}
          authorId={user?.id}
          maxLength={COMMENT_MAX_LENGTH}
          placeholder={placeholder}
          error={error}
          disabled={add.isPending}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={add.isPending || !text.trim()}>
            <Send className="size-4" aria-hidden="true" />
            {add.isPending ? "Publicando…" : submitLabel}
          </Button>
        </div>
      </form>
    </section>
  );
}
