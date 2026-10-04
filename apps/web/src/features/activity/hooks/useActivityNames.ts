import { useMemo } from "react";
import { useMembers } from "@/features/team/hooks/useMembers";

/** Nombres de personas para mostrar en el historial, a partir de la lista de miembros. */
export function useActivityNames() {
  const { data: members } = useMembers();
  return useMemo(() => {
    const byId = new Map((members ?? []).map((m) => [m.id, m.name]));
    return {
      /** Nombre completo, o `undefined` si la persona no es visible o no existe. */
      memberName: (id: string) => byId.get(id),
      /** Nombre de pila para la frase del evento. */
      actorName: (id: string) => byId.get(id)?.split(/\s+/)[0] ?? "Alguien",
      /** Nombre completo del actor para avatares y detalle. */
      actorFullName: (id: string) => byId.get(id) ?? "Alguien",
    };
  }, [members]);
}
