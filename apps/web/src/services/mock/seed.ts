import { todayLima, weekRange } from "@vexa/domain/dates";
import type { Expense, ExpenseVote, Profile, TimeEntry } from "@vexa/domain/types";
import type { MockDb } from "./db";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const USER = {
  jhony: "u-jhony",
  rober: "u-rober",
  jose: "u-jose",
  diego: "u-diego",
} as const;

const PROFILES: Profile[] = [
  {
    id: USER.jhony,
    name: "Jhony Rivera",
    role: "admin",
    area: "management_finance",
    weeklyHours: 15,
    active: true,
    joinedAt: "2026-01-12T14:00:00.000Z",
  },
  {
    id: USER.rober,
    name: "Rober Vasquez",
    role: "partner",
    area: "technical",
    weeklyHours: 20,
    active: true,
    joinedAt: "2026-01-12T14:00:00.000Z",
  },
  {
    id: USER.jose,
    name: "José Gónzales",
    role: "partner",
    area: "commercial",
    weeklyHours: 15,
    active: true,
    joinedAt: "2026-02-02T14:00:00.000Z",
  },
  {
    id: USER.diego,
    name: "Diego Choque",
    role: "partner",
    area: "design_marketing",
    weeklyHours: 25,
    active: true,
    joinedAt: "2026-02-16T14:00:00.000Z",
  },
];

/**
 * Arma los datos iniciales. Las fechas son relativas a `now` para que el sprint activo,
 * las horas recientes y la convocatoria de la semana siempre se vean vigentes.
 */
export function buildSeed(now: Date): MockDb {
  const ago = (days: number, hour = 0) =>
    new Date(now.getTime() - days * DAY_MS + hour * HOUR_MS).toISOString();
  const dateOffset = (days: number) =>
    todayLima(new Date(now.getTime() + days * DAY_MS));

  const tasks: MockDb["tasks"] = [
    {
      id: "t-1",
      sprintId: "s-1",
      projectId: "p-vexa",
      title: "Definir alcance del MVP",
      status: "done",
      assigneeId: USER.jhony,
      estimateHours: 6,
      link: null,
    },
    {
      id: "t-2",
      sprintId: "s-1",
      projectId: "p-vexa",
      title: "Crear repositorio y pipeline de despliegue",
      status: "done",
      assigneeId: USER.rober,
      estimateHours: 8,
      link: "https://github.com/vexa/vexa-studio/pull/1",
    },
    {
      id: "t-3",
      sprintId: "s-2",
      projectId: "p-vexa",
      title: "Configurar proyecto base y capa de servicios",
      status: "done",
      assigneeId: USER.rober,
      estimateHours: 10,
      link: "https://github.com/vexa/vexa-studio/pull/4",
    },
    {
      id: "t-4",
      sprintId: "s-2",
      projectId: "p-vexa",
      title: "Diseñar login y layout responsive",
      status: "review",
      assigneeId: USER.diego,
      estimateHours: 8,
      link: null,
    },
    {
      id: "t-5",
      sprintId: "s-2",
      projectId: "p-vexa",
      title: "Reglas de puntos y cumplimiento",
      status: "in_progress",
      assigneeId: USER.rober,
      estimateHours: 12,
      link: null,
    },
    {
      id: "t-6",
      sprintId: "s-2",
      projectId: "p-vexa",
      title: "Guía de marca para la app",
      status: "done",
      assigneeId: USER.diego,
      estimateHours: 5,
      link: null,
    },
    {
      id: "t-7",
      sprintId: "s-2",
      projectId: "p-vexa",
      title: "Registrar gastos recurrentes",
      status: "todo",
      assigneeId: USER.jhony,
      estimateHours: 4,
      link: null,
    },
    {
      id: "t-8",
      sprintId: "s-2",
      projectId: "p-vexa",
      title: "Lista de prospectos para Fivuza",
      status: "in_progress",
      assigneeId: USER.jose,
      estimateHours: 6,
      link: null,
    },
    {
      id: "t-9",
      sprintId: "s-2",
      projectId: "p-vexa",
      title: "Plantilla de propuesta comercial",
      status: "todo",
      assigneeId: USER.jose,
      estimateHours: 5,
      link: null,
    },
    {
      id: "t-10",
      sprintId: null,
      projectId: "p-fivuza",
      title: "Landing de Fivuza",
      status: "todo",
      assigneeId: USER.diego,
      estimateHours: 10,
      link: null,
    },
    {
      id: "t-11",
      sprintId: null,
      projectId: "p-fivuza",
      title: "Definir precios del plan inicial",
      status: "todo",
      assigneeId: null,
      estimateHours: 3,
      link: null,
    },
  ];

  // Horas de las últimas 6 semanas: 3 registros por semana, con distinto nivel de cumplimiento.
  const factors: Record<string, number> = {
    [USER.jhony]: 1,
    [USER.rober]: 1.1,
    [USER.jose]: 0.6,
    [USER.diego]: 0.9,
  };
  const timeEntries: TimeEntry[] = [];
  for (const profile of PROFILES) {
    const own = tasks.filter((t) => t.assigneeId === profile.id);
    const hours =
      Math.round(((profile.weeklyHours * factors[profile.id]) / 3) * 2) / 2;
    for (let week = 0; week < 6; week++) {
      for (let slot = 0; slot < 3; slot++) {
        const daysAgo = week * 7 + slot * 2 + (week === 0 ? 0 : 1);
        const startedAt = ago(daysAgo, -hours);
        timeEntries.push({
          id: `h-${profile.id}-${week}-${slot}`,
          userId: profile.id,
          taskId: own[(week + slot) % own.length].id,
          startedAt,
          endedAt: ago(daysAgo),
          hours,
          paid: profile.id === USER.diego && week === 3 && slot === 0,
          // Lo anterior al sprint activo ya se validó en su cierre.
          validated: daysAgo > 7,
          validatedAt: daysAgo > 7 ? ago(daysAgo - 7) : null,
          createdAt: ago(daysAgo),
          voidedAt: null,
          voidReason: null,
        });
      }
    }
  }

  const expense = (
    e: Partial<Expense> &
      Pick<
        Expense,
        "id" | "paidBy" | "amount" | "concept" | "category" | "status"
      >,
  ): Expense => ({
    currency: "PEN",
    receiptUrl: null,
    reimbursed: false,
    beforeSigning: false,
    createdAt: ago(5),
    voidReason: null,
    ...e,
  });
  const expenses: Expense[] = [
    expense({
      id: "e-1",
      paidBy: USER.rober,
      amount: 35,
      concept: "Hosting del entorno de pruebas",
      category: "infrastructure",
      status: "approved",
      createdAt: ago(20),
    }),
    expense({
      id: "e-2",
      paidBy: USER.diego,
      amount: 180,
      concept: "Licencia anual de herramienta de diseño",
      category: "software",
      status: "pending",
      createdAt: ago(2),
    }),
    expense({
      id: "e-3",
      paidBy: USER.jose,
      amount: 120,
      concept: "Registro de marca (trámite)",
      category: "legal",
      status: "approved",
      createdAt: ago(12),
    }),
    expense({
      id: "e-4",
      paidBy: USER.jhony,
      amount: 90,
      concept: "Publicidad en redes",
      category: "marketing",
      status: "rejected",
      createdAt: ago(9),
    }),
    expense({
      id: "e-5",
      paidBy: USER.diego,
      amount: 45,
      concept: "Banco de imágenes",
      category: "software",
      status: "approved",
      reimbursed: true,
      createdAt: ago(16),
    }),
    expense({
      id: "e-6",
      paidBy: USER.jhony,
      amount: 13,
      currency: "USD",
      concept: "Dominio de VEXA (año 1)",
      category: "infrastructure",
      status: "approved",
      beforeSigning: true,
      createdAt: ago(200),
    }),
  ];
  const vote = (
    expenseId: string,
    userId: string,
    inFavor: boolean,
  ): ExpenseVote => ({ expenseId, userId, inFavor });
  const expenseVotes: ExpenseVote[] = [
    vote("e-2", USER.jhony, true),
    vote("e-2", USER.rober, true),
    vote("e-3", USER.jhony, true),
    vote("e-3", USER.rober, true),
    vote("e-3", USER.diego, true),
    vote("e-4", USER.rober, false),
    vote("e-4", USER.jose, false),
  ];

  // Convocatoria de la semana: tres horarios a las 8:00 p. m. de Lima (01:00 UTC del día siguiente).
  const monday = weekRange(now).start;
  const slotAt = (day: number) =>
    new Date(monday.getTime() + (day * 24 + 20) * HOUR_MS).toISOString();

  return {
    profiles: PROFILES.map((profile) => ({ ...profile })),
    settings: {
      pointsPerHour: 20,
      pointsPerSol: 2,
      minCompliance: 0.8,
      weeksPerMonth: 4,
      expenseApprovalLimitPen: 50,
      entryEditDays: 7,
      dailyReminder: { time: "21:00", weekdays: [1, 3, 5] },
      weeklyHoursReminder: { time: "20:00", weekday: 0 },
    },
    projects: [
      { id: "p-vexa", name: "Vexa Studio", type: "internal", status: "active" },
      { id: "p-fivuza", name: "Fivuza", type: "product", status: "active" },
      { id: "p-vantage", name: "Vantage", type: "product", status: "paused" },
    ],
    sprints: [
      {
        id: "s-1",
        projectId: "p-vexa",
        startDate: dateOffset(-21),
        endDate: dateOffset(-8),
        goal: "Alinear alcance y montar la infraestructura",
        status: "closed",
      },
      {
        id: "s-2",
        projectId: "p-vexa",
        startDate: dateOffset(-7),
        endDate: dateOffset(6),
        goal: "Base del frontend con datos simulados",
        status: "active",
      },
    ],
    tasks,
    timeEntries,
    expenses,
    expenseVotes,
    recurringExpenses: [
      {
        id: "r-1",
        concept: "Dominio de VEXA",
        amount: 13,
        currency: "USD",
        nextDate: "2027-02-23",
        periodicity: "yearly",
        beforeSigning: true,
      },
    ],
    dailyUpdates: [
      {
        id: "d-1",
        userId: USER.rober,
        date: dateOffset(-2),
        done: "Configuré el proyecto base",
        willDo: "Reglas de puntos",
        blockers: "",
      },
      {
        id: "d-2",
        userId: USER.diego,
        date: dateOffset(-2),
        done: "Guía de marca",
        willDo: "Diseño del login",
        blockers: "Necesito el logo final en SVG @Rober",
      },
      {
        id: "d-3",
        userId: USER.jose,
        date: dateOffset(-2),
        done: "Reunión con prospecto",
        willDo: "Lista de prospectos",
        blockers: "",
      },
    ],
    comments: [
      {
        id: "c-1",
        entity: "task",
        entityId: "t-5",
        userId: USER.diego,
        text: "@Rober ¿el mínimo se calcula por mes calendario de Lima?",
        mentions: [USER.rober],
        createdAt: ago(1),
      },
      {
        id: "c-2",
        entity: "task",
        entityId: "t-5",
        userId: USER.rober,
        text: "Sí, con corte a medianoche de Lima.",
        mentions: [],
        createdAt: ago(1, 2),
      },
      {
        id: "c-3",
        entity: "expense",
        entityId: "e-2",
        userId: USER.jhony,
        text: "Voto a favor: la usamos para la marca y la app.",
        mentions: [],
        createdAt: ago(1),
      },
    ],
    announcements: [
      {
        id: "a-1",
        authorId: USER.jhony,
        text: "Bienvenidos a Vexa Studio. Registren sus horas con el temporizador desde cada tarea.",
        pinned: true,
        createdAt: ago(6),
      },
      {
        id: "a-2",
        authorId: USER.jhony,
        text: "Esta semana la reunión se define por convocatoria: marquen su disponibilidad.",
        pinned: false,
        createdAt: ago(1),
      },
    ],
    absences: [],
    notifications: [
      {
        id: "n-1",
        userId: USER.rober,
        type: "mention",
        payload: { taskId: "t-5", by: USER.diego },
        read: false,
        createdAt: ago(1),
      },
      {
        id: "n-2",
        userId: USER.jose,
        type: "expense_vote",
        payload: { expenseId: "e-2" },
        read: false,
        createdAt: ago(2),
      },
      {
        id: "n-3",
        userId: USER.diego,
        type: "daily_pending",
        payload: {},
        read: false,
        createdAt: ago(0),
      },
      {
        id: "n-4",
        userId: USER.jose,
        type: "hours_missing",
        payload: {},
        read: true,
        createdAt: ago(3),
      },
    ],
    auditLog: [],
    meetings: [
      {
        id: "m-1",
        week: todayLima(monday),
        status: "polling",
        confirmedSlotId: null,
        meetLink: null,
        attendeeIds: [],
        createdAt: ago(2),
      },
    ],
    meetingSlots: [
      { id: "ms-1", meetingId: "m-1", startsAt: slotAt(2) },
      { id: "ms-2", meetingId: "m-1", startsAt: slotAt(3) },
      { id: "ms-3", meetingId: "m-1", startsAt: slotAt(5) },
    ],
    slotVotes: [
      { slotId: "ms-1", userId: USER.jhony, available: true },
      { slotId: "ms-2", userId: USER.jhony, available: true },
      { slotId: "ms-3", userId: USER.jhony, available: false },
      { slotId: "ms-2", userId: USER.rober, available: true },
    ],
  };
}
