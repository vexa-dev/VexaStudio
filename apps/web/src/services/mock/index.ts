import type {
  AnnouncementService,
  AuthService,
  CommentService,
  DailyService,
  ExpenseService,
  MeetingService,
  MemberService,
  NotificationService,
  Services,
  SettingsService,
} from "@vexa/services";
import { auditService } from "./audit";
import { chatService } from "./chat";
import { getDb, getSessionUserId, setSessionUserId } from "./db";
import { requireStudioAccess } from "./studio-access";
import { dashboard } from "./dashboard";
import { projects, sprints, tasks, time } from "./work";
import { delay, notImplemented } from "./utils";
import {
  resetProfileMedia,
  updateProfileMedia,
  withMedia,
  withMediaAll,
} from "./profile-media";

const auth: AuthService = {
  async listLoginProfiles() {
    return delay(withMediaAll(getDb().profiles.filter((p) => p.active)));
  },
  async getSession() {
    const id = getSessionUserId();
    const profile = getDb().profiles.find((p) => p.id === id && p.active);
    return delay(profile ? withMedia(profile) : null);
  },
  async signIn(userId) {
    const profile = getDb().profiles.find((p) => p.id === userId && p.active);
    if (!profile) throw new Error("Usuario no encontrado o inactivo");
    setSessionUserId(profile.id);
    return delay(withMedia(profile));
  },
  async signOut() {
    setSessionUserId(null);
    return delay(undefined);
  },
  async updateProfileMedia(patch) {
    return delay(updateProfileMedia(patch));
  },
};

const settings: SettingsService = {
  async get() {
    return delay(getDb().settings);
  },
};

const members: MemberService = {
  async list() {
    return delay(withMediaAll(getDb().profiles));
  },
  async get(id) {
    const profile = getDb().profiles.find((p) => p.id === id);
    return delay(profile ? withMedia(profile) : null);
  },
};

const daily: DailyService = {
  async list(filter) {
    requireStudioAccess();
    return delay(getDb().dailyUpdates.filter((update) =>
      (!filter?.userId || update.userId === filter.userId) &&
      (!filter?.date || update.date === filter.date),
    ));
  },
  submit: (...args) => notImplemented<DailyService>("DailyService").submit(...args),
  suggestDone: (...args) => notImplemented<DailyService>("DailyService").suggestDone(...args),
};

const expenses: ExpenseService = {
  async list() {
    requireStudioAccess();
    return delay(getDb().expenses);
  },
  async listVotes(expenseId) {
    requireStudioAccess();
    return delay(
      getDb().expenseVotes.filter((vote) => vote.expenseId === expenseId),
    );
  },
  async listRecurring() {
    requireStudioAccess();
    return delay(getDb().recurringExpenses);
  },
  create: (...args) =>
    notImplemented<ExpenseService>("ExpenseService").create(...args),
  vote: (...args) =>
    notImplemented<ExpenseService>("ExpenseService").vote(...args),
  void: (...args) =>
    notImplemented<ExpenseService>("ExpenseService").void(...args),
};
/** Servicios del mock. Los de F2–F4 se van implementando bloque a bloque. */
export function createMockServices(): Services {
  return {
    auth,
    settings,
    members,
    projects,
    sprints,
    tasks,
    time,
    expenses,
    dashboard,
    daily,
    comments: notImplemented<CommentService>("CommentService"),
    announcements: notImplemented<AnnouncementService>("AnnouncementService"),
    meetings: notImplemented<MeetingService>("MeetingService"),
    notifications: notImplemented<NotificationService>("NotificationService"),
    audit: auditService,
    chat: chatService,
  };
}

import { resetMock as resetDb } from "./db";

/** Borra datos, sesión y fotos/banners simulados. */
export function resetMock(): void {
  resetDb();
  resetProfileMedia();
}
