import type { Profile, Task, TimeEntry } from "@vexa/domain/types";
export interface LocalCollaborator extends Profile {
  email: string;
  access: "pending";
  phone?: string;
  position?: string;
  supervisorId?: string;
  startDate?: string;
  endDate?: string;
  workMode?: "remote" | "hybrid" | "onsite";
  engagement?: "collaborator" | "internship" | "freelance";
  compensation?: "fixed" | "unpaid" | "commission" | "mixed";
  amount?: number;
  currency?: "PEN" | "USD";
  paymentFrequency?: "monthly" | "weekly" | "project";
  commissionRate?: number;
  commissionBasis?: string;
  notes?: string;
  documents?: {
    kind: "cv" | "contract";
    name: string;
    data: string;
    size: number;
  }[];
}
export const TEAM_MEMBERS_KEY = "vexa.team.collaborators.v1";
export function readCollaborators(): LocalCollaborator[] {
  try {
    const saved = JSON.parse(localStorage.getItem(TEAM_MEMBERS_KEY) ?? "[]");
    return Array.isArray(saved)
      ? saved.filter(
          (p) =>
            typeof p.id === "string" &&
            typeof p.name === "string" &&
            typeof p.email === "string" &&
            p.role === "collaborator" &&
            typeof p.active === "boolean",
        )
      : [];
  } catch {
    return [];
  }
}
export function memberMetrics(
  profile: Profile,
  tasks: Task[],
  entries: TimeEntry[],
  from?: string,
) {
  const assigned = tasks.filter((t) => t.assigneeId === profile.id);
  const logged = entries.filter(
    (e) =>
      e.userId === profile.id &&
      !e.voidedAt &&
      !e.draft &&
      Boolean(e.endedAt) &&
      (!from || e.startedAt.slice(0, 10) >= from),
  );
  const done = assigned.filter((t) => t.status === "done").length;
  return {
    profile,
    assigned,
    done,
    total: assigned.length,
    todo: assigned.filter((t) => t.status === "todo").length,
    progress: assigned.filter((t) => t.status === "in_progress").length,
    review: assigned.filter((t) => t.status === "review").length,
    pending: assigned.length - done,
    completion: assigned.length
      ? Math.round((done / assigned.length) * 100)
      : 0,
    hours: logged.reduce((sum, e) => sum + e.hours, 0),
    validatedHours: logged
      .filter((e) => e.validated)
      .reduce((sum, e) => sum + e.hours, 0),
  };
}
export const compensationLabels = {
  fixed: "Pago fijo",
  unpaid: "Sin pago · Prácticas",
  commission: "Solo comisiones",
  mixed: "Pago fijo + comisiones",
};
export const workModeLabels = {
  remote: "Remoto",
  hybrid: "Híbrido",
  onsite: "Presencial",
};
export const engagementLabels = {
  collaborator: "Colaborador",
  internship: "Prácticas",
  freelance: "Freelance / por proyecto",
};
