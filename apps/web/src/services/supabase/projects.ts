import type { ProjectService } from "@vexa/services";
import type { Project } from "@vexa/domain/types";
import { newRequestId, type VexaSupabase } from "@/lib/supabase";
import type { TablesUpdate } from "./database.types";
import { unwrap, unwrapMaybe } from "./errors";
import { mapLabel, mapProject, PROJECT_SELECT, type ProjectRow } from "./mappers";
import { tagged } from "./session";

const LABEL_COLOR = /^#[0-9a-f]{6}$/i;

/** Mismas validaciones que el mock, para dar el mismo mensaje antes de ir a la red. */
function labelFields(input: { name: string; color: string }) {
  const name = input.name.trim();
  if (!name || name.length > 40)
    throw new Error("Escribe un nombre de hasta 40 caracteres");
  if (!LABEL_COLOR.test(input.color)) throw new Error("Elige un color válido");
  return { name, color: input.color.toLowerCase() };
}

/**
 * Proyectos y etiquetas. Los permisos los aplica RLS: admin ve y gestiona todo; el resto solo ve
 * los proyectos de los que es miembro. El catálogo de etiquetas es solo del administrador.
 */
export function createProjectService(client: VexaSupabase): ProjectService {
  async function fetchProject(id: string): Promise<Project | null> {
    const row = unwrapMaybe(
      await client
        .from("projects")
        .select(PROJECT_SELECT)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<ProjectRow, { merge: false }>(),
    );
    return row ? mapProject(row) : null;
  }

  return {
    async listLabels(projectId) {
      const rows = unwrap(
        await client
          .from("project_labels")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at")
          .order("id"),
      );
      return rows.map(mapLabel);
    },
    async createLabel(projectId, input) {
      const fields = labelFields(input);
      return mapLabel(
        unwrap(
          await client
            .from("project_labels")
            .insert({ project_id: projectId, ...fields })
            .select()
            .single(),
        ),
      );
    },
    async updateLabel(id, input) {
      const fields = labelFields(input);
      const row = unwrapMaybe(
        await client
          .from("project_labels")
          .update(fields)
          .eq("id", id)
          .select()
          .maybeSingle(),
      );
      if (!row) throw new Error("La etiqueta no existe");
      return mapLabel(row);
    },
    async list() {
      const rows = unwrap(
        await client
          .from("projects")
          .select(PROJECT_SELECT)
          .order("created_at")
          .order("id")
          .overrideTypes<ProjectRow[], { merge: false }>(),
      );
      return rows.map(mapProject);
    },
    async get(id) {
      const project = await fetchProject(id);
      if (!project) throw new Error("No tienes acceso a este proyecto");
      return project;
    },
    async create(input) {
      if (!input.name.trim()) throw new Error("Escribe el nombre del proyecto");
      const memberIds = [...new Set(input.memberIds ?? [])];
      const row = unwrap(
        await client.rpc("create_project", {
          p_name: input.name,
          p_type: input.type,
          p_status: input.status,
          p_member_ids: memberIds,
        }),
      );
      return { id: row.id, name: row.name, type: row.type, status: row.status, memberIds };
    },
    async update(id, patch) {
      if (patch.name !== undefined && !patch.name.trim())
        throw new Error("Escribe el nombre del proyecto");
      // Cambiar campos y miembros son dos escrituras de una misma operación.
      const requestId = newRequestId();
      const columns: TablesUpdate<"projects"> = {};
      if (patch.name !== undefined) columns.name = patch.name.trim();
      if (patch.type !== undefined) columns.type = patch.type;
      if (patch.status !== undefined) columns.status = patch.status;
      if (Object.keys(columns).length > 0) {
        const row = unwrapMaybe(
          await tagged(
            client.from("projects").update(columns).eq("id", id).select().maybeSingle(),
            requestId,
          ),
        );
        if (!row) throw new Error("No tienes acceso a este proyecto");
      }
      if (patch.memberIds !== undefined)
        unwrap(
          await tagged(
            client.rpc("set_project_members", {
              p_project: id,
              p_member_ids: [...new Set(patch.memberIds)],
            }),
            requestId,
          ),
        );
      const project = await fetchProject(id);
      if (!project) throw new Error("No tienes acceso a este proyecto");
      return project;
    },
  };
}
