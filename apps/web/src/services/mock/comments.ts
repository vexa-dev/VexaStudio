import { canAccessStudio } from "@vexa/domain/access";
import {
  MAX_MENTIONS,
  normalizeCommentText,
  validateCommentText,
} from "@vexa/domain/comments";
import type { Comment, CommentEntity, Id, Profile } from "@vexa/domain/types";
import type { CommentService } from "@vexa/services";
import { getDb, getSessionUserId, save } from "./db";
import { delay } from "./utils";

function currentUser(): Profile {
  const user = getDb().profiles.find((p) => p.id === getSessionUserId() && p.active);
  if (!user) throw new Error("Inicia sesión para continuar");
  return user;
}

/**
 * Espeja `private.user_can_view_comment_entity` de SQL: quién puede leer la entidad padre.
 * Tarea: admin, responsable o miembro del proyecto. Horas: el dueño, o (si no es borrador) admin, socios
 * y etiquetados. Gasto: admin y socios.
 */
export function canViewCommentEntity(user: Profile, entity: CommentEntity, entityId: Id): boolean {
  if (!user.active) return false;
  const db = getDb();
  if (entity === "task") {
    const task = db.tasks.find((t) => t.id === entityId);
    if (!task) return false;
    if (user.role === "admin" || task.assigneeId === user.id) return true;
    const project = task.projectId ? db.projects.find((p) => p.id === task.projectId) : undefined;
    return Boolean(project?.memberIds?.includes(user.id));
  }
  if (entity === "time_entry") {
    const entry = db.timeEntries.find((e) => e.id === entityId);
    if (!entry) return false;
    if (entry.userId === user.id) return true;
    if (entry.draft) return false;
    return canAccessStudio(user.role) || Boolean(entry.participants?.some((p) => p.userId === user.id));
  }
  return db.expenses.some((e) => e.id === entityId) && canAccessStudio(user.role);
}

const ENTITY_PLACE: Record<CommentEntity, string> = {
  task: "en una tarea",
  time_entry: "en un registro de horas",
  expense: "en un gasto",
};

/**
 * Comentarios del mock. Espeja `comments` de SQL: se leen los hilos de entidades que la persona puede
 * leer; se comenta solo como uno mismo; nadie edita ni borra. Las menciones se depuran (sin duplicados,
 * sin el autor, solo personas activas que pueden leer la entidad) y cada una recibe un aviso `mention`
 * en `db.notifications` (lo que en Supabase hace un trigger).
 */
export const commentService: CommentService = {
  async list(entity, entityId) {
    const user = currentUser();
    if (!canViewCommentEntity(user, entity, entityId)) return delay([]);
    return delay(
      getDb()
        .comments.filter((c) => c.entity === entity && c.entityId === entityId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    );
  },
  async add(input) {
    const user = currentUser();
    const message = validateCommentText(input.text);
    if (message) throw new Error(message);
    if (!canViewCommentEntity(user, input.entity, input.entityId))
      throw new Error("Tu rol no permite esta acción");
    const db = getDb();
    const mentions = [...new Set(input.mentions ?? [])]
      .filter((id) => {
        const person = db.profiles.find((p) => p.id === id);
        return id !== user.id && person && canViewCommentEntity(person, input.entity, input.entityId);
      })
      .slice(0, MAX_MENTIONS);
    const now = new Date().toISOString();
    const text = normalizeCommentText(input.text);
    const comment: Comment = {
      id: `c-${crypto.randomUUID()}`,
      entity: input.entity,
      entityId: input.entityId,
      userId: user.id,
      text,
      mentions,
      createdAt: now,
    };
    db.comments.push(comment);
    const task = input.entity === "task" ? db.tasks.find((t) => t.id === input.entityId) : undefined;
    for (const id of mentions) {
      const person = db.profiles.find((p) => p.id === id);
      db.notifications.push({
        id: `n-${crypto.randomUUID()}`,
        userId: id,
        type: "mention",
        payload: {
          title: "Te mencionaron en un comentario",
          message: `${user.name} te mencionó ${task ? `en la tarea «${task.title}»` : ENTITY_PLACE[input.entity]}.`,
          actorName: user.name,
          recipientName: person?.name ?? "",
          entity: input.entity,
          entityId: input.entityId,
          commentId: comment.id,
          details: text.slice(0, 300),
          nextStep: "Abre el comentario y responde si hace falta.",
          ...(task ? { taskId: task.id, taskName: task.title } : {}),
          ...(task?.projectId ? { projectId: task.projectId } : {}),
        },
        read: false,
        createdAt: now,
      });
    }
    save();
    return delay(comment);
  },
};
