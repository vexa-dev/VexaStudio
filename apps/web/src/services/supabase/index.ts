import type {
  AnnouncementService,
  CommentService,
  MeetingService,
  Services,
} from "@vexa/services";
import { getSupabase, type VexaSupabase } from "@/lib/supabase";
import { createChatService } from "./chat";
import { createAuditService } from "./audit";
import { createAuthService } from "./auth";
import { createDailyService } from "./daily";
import { createDashboardService } from "./dashboard";
import { notImplemented } from "./errors";
import { createExpenseService } from "./expenses";
import { createMemberService, createSettingsService } from "./members";
import { createSignedUrlResolver } from "./profile-media";
import { createNotificationService } from "./notifications";
import { createProjectService } from "./projects";
import { createSprintService } from "./sprints";
import { createTaskService } from "./tasks";
import { createTimeService } from "./time";

/**
 * Servicios respaldados por Supabase. Lo que ni el mock ni la base implementan todavía
 * (comentarios, anuncios, reuniones) falla con un mensaje claro, igual que el mock.
 */
export function createSupabaseServices(
  client: VexaSupabase = getSupabase(),
): Services {
  // Una sola caché de URLs firmadas para el acceso y el equipo.
  const media = createSignedUrlResolver(client);
  const time = createTimeService(client);
  const tasks = createTaskService(client);
  return {
    auth: createAuthService(client, media),
    settings: createSettingsService(client),
    members: createMemberService(client, media),
    projects: createProjectService(client),
    sprints: createSprintService(client),
    tasks,
    time,
    expenses: createExpenseService(client),
    dashboard: createDashboardService(client),
    daily: createDailyService(client, { time, tasks }),
    comments: notImplemented<CommentService>("CommentService"),
    announcements: notImplemented<AnnouncementService>("AnnouncementService"),
    meetings: notImplemented<MeetingService>("MeetingService"),
    notifications: createNotificationService(client),
    audit: createAuditService(client),
    chat: createChatService(client),
  };
}
