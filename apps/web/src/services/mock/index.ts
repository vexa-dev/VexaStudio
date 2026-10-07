import type {
  AuthService,
  DailyService,
  MeetingService,
  MemberService,
  Services,
  SettingsService,
} from "@vexa/services";
import { announcementService } from "./announcements";
import { auditService } from "./audit";
import { commentService } from "./comments";
import { chatService } from "./chat";
import { getDb, getSessionUserId, setSessionUserId } from "./db";
import { createMockDailyService } from "./daily";
import { dashboard } from "./dashboard";
import { expenseService } from "./expenses";
import { projects, sprints, tasks, time } from "./work";
import { delay, notImplemented } from "./utils";
import { profileAuth } from "./auth";
import { notificationService, resetNotificationPreferences } from "./notifications";
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
  ...profileAuth,
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

const daily: DailyService = createMockDailyService(time, tasks);

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
    expenses: expenseService,
    dashboard,
    daily,
    comments: commentService,
    announcements: announcementService,
    meetings: notImplemented<MeetingService>("MeetingService"),
    notifications: notificationService,
    audit: auditService,
    chat: chatService,
  };
}

import { resetMock as resetDb } from "./db";

/** Borra datos, sesión y fotos/banners simulados. */
export function resetMock(): void {
  resetDb();
  resetProfileMedia();
  resetNotificationPreferences();
}
