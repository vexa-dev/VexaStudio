import { normalizeCommentText, validateCommentText } from "@vexa/domain/comments";
import type { CommentService } from "@vexa/services";
import type { VexaSupabase } from "@/lib/supabase";
import type { Tables } from "./database.types";
import { unwrap } from "./errors";
import { mapComment } from "./mappers";
import { requireUserId } from "./session";

/**
 * Comentarios sobre `comments`. RLS decide qué hilos se ven (los de entidades que la persona puede leer)
 * y exige que el comentario sea propio; la base depura las menciones y un trigger avisa a cada
 * persona mencionada. Nadie edita ni borra, así que aquí solo hay lectura e inserción.
 */
export function createCommentService(client: VexaSupabase): CommentService {
  return {
    async list(entity, entityId) {
      await requireUserId(client);
      const rows = unwrap(
        await client
          .from("comments")
          .select("*")
          .eq("entity", entity)
          .eq("entity_id", entityId)
          .order("created_at", { ascending: true })
          .order("id"),
      );
      return rows.map(mapComment);
    },
    async add(input) {
      const message = validateCommentText(input.text);
      if (message) throw new Error(message);
      await requireUserId(client);
      // `user_id` sale de la sesión (default auth.uid()); la base descarta menciones sin acceso.
      const row = unwrap(
        await client
          .from("comments")
          .insert({
            entity: input.entity,
            entity_id: input.entityId,
            text: normalizeCommentText(input.text),
            mentions: [...new Set(input.mentions ?? [])],
          })
          .select("*")
          .single()
          .overrideTypes<Tables<"comments">, { merge: false }>(),
      );
      return mapComment(row);
    },
  };
}
