import type {
  AuthService,
  MemberService,
  ProjectService,
  Services,
  SettingsService,
} from '../types'
import { getDb, getSessionUserId, setSessionUserId } from './db'
import { dashboard } from './dashboard'
import { comments, expenses } from './expenses'
import { notifications } from './notifications'
import { announcements, daily, meetings } from './team'
import { sprints, tasks, time } from './work'
import { delay } from './utils'

const auth: AuthService = {
  async listLoginProfiles() {
    return delay(getDb().profiles.filter((p) => p.active))
  },
  async getSession() {
    const id = getSessionUserId()
    const profile = getDb().profiles.find((p) => p.id === id && p.active)
    return delay(profile ?? null)
  },
  async signIn(userId) {
    const profile = getDb().profiles.find((p) => p.id === userId && p.active)
    if (!profile) throw new Error('Usuario no encontrado o inactivo')
    setSessionUserId(profile.id)
    return delay(profile)
  },
  async signOut() {
    setSessionUserId(null)
    return delay(undefined)
  },
}

const settings: SettingsService = {
  async get() {
    return delay(getDb().settings)
  },
}

const members: MemberService = {
  async list() {
    return delay(getDb().profiles)
  },
  async get(id) {
    return delay(getDb().profiles.find((p) => p.id === id) ?? null)
  },
}

const projects: ProjectService = {
  async list() {
    return delay(getDb().projects)
  },
  async get(id) {
    return delay(getDb().projects.find((p) => p.id === id) ?? null)
  },
}

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
    comments,
    announcements,
    meetings,
    notifications,
  }
}

export { resetMock } from './db'
