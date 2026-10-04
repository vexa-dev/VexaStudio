import type {
  AnnouncementService,
  CommentService,
  DailyService,
  MeetingService,
  NotificationService,
  Services,
} from "@vexa/services";
import { getSupabase, type VexaSupabase } from "@/lib/supabase";
import { createAuditService } from "./audit";
import { createAuthService } from "./auth";
import { createDashboardService } from "./dashboard";
import { notImplemented } from "./errors";
import { createExpenseService } from "./expenses";
import { createMemberService, createSettingsService } from "./members";
import { createProjectService } from "./projects";
import { requireStudioAccess } from "./session";
import { createSprintService } from "./sprints";
import { createTaskService } from "./tasks";
import { createTimeService } from "./time";

/**
 * Servicios respaldados por Supabase. Lo que ni el mock ni la base implementan todavía (daily,
 * comentarios, anuncios, reuniones, notificaciones) falla con un mensaje claro, igual que el mock.
 */
export function createSupabaseServices(
  client: VexaSupabase = getSupabase(),
): Services {
  const pendingDaily = notImplemented<DailyService>("DailyService");
  return {
    auth: createAuthService(client),
    settings: createSettingsService(client),
    members: createMemberService(client),
    projects: createProjectService(client),
    sprints: createSprintService(client),
    tasks: createTaskService(client),
    time: createTimeService(client),
    expenses: createExpenseService(client),
    dashboard: createDashboardService(client),
    daily: {
      // La base aún no tiene tabla de dailies: la lectura devuelve vacío y las escrituras fallan.
      async list() {
        await requireStudioAccess(client);
        return [];
      },
      submit: (...args) => pendingDaily.submit(...args),
      suggestDone: (...args) => pendingDaily.suggestDone(...args),
    },
    comments: notImplemented<CommentService>("CommentService"),
    announcements: notImplemented<AnnouncementService>("AnnouncementService"),
    meetings: notImplemented<MeetingService>("MeetingService"),
    notifications: notImplemented<NotificationService>("NotificationService"),
    audit: createAuditService(client),
  };
}
