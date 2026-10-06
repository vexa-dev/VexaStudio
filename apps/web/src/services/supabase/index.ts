import type {
  AnnouncementService,
  CommentService,
  DailyService,
  MeetingService,
  Services,
} from "@vexa/services";
import { getSupabase, type VexaSupabase } from "@/lib/supabase";
import { createChatService } from "./chat";
import { createAuditService } from "./audit";
import { createAuthService } from "./auth";
import { createDashboardService } from "./dashboard";
import { notImplemented } from "./errors";
import { createExpenseService } from "./expenses";
import { createMemberService, createSettingsService } from "./members";
import { createSignedUrlResolver } from "./profile-media";
import { createNotificationService } from "./notifications";
import { createProjectService } from "./projects";
import { requireStudioAccess } from "./session";
import { createSprintService } from "./sprints";
import { createTaskService } from "./tasks";
import { createTimeService } from "./time";

/**
 * Servicios respaldados por Supabase. Lo que ni el mock ni la base implementan todavía (daily,
 * comentarios, anuncios, reuniones) falla con un mensaje claro, igual que el mock.
 */
export function createSupabaseServices(
  client: VexaSupabase = getSupabase(),
): Services {
  // Una sola caché de URLs firmadas para el acceso y el equipo.
  const media = createSignedUrlResolver(client);
  const pendingDaily = notImplemented<DailyService>("DailyService");
  return {
    auth: createAuthService(client, media),
    settings: createSettingsService(client),
    members: createMemberService(client, media),
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
    notifications: createNotificationService(client),
    audit: createAuditService(client),
    chat: createChatService(client),
  };
}
