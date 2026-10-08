import { useEffect, useState, useSyncExternalStore } from "react";
import { todayLima } from "@vexa/domain/dates";

export type Attendance = "pending" | "present" | "absent" | "excused";
export type PlannedMeeting = {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  participants: string[];
  location: string;
  agenda: string;
  minutes: string;
  status: "scheduled" | "completed" | "cancelled";
  attendance: Record<string, Attendance>;
};
export type SchedulePoll = {
  id: string;
  title: string;
  participants: string[];
  duration: number;
  closed: boolean;
  options: { date: string; time: string; votes: Record<string, boolean> }[];
};
type Planner = { meetings: PlannedMeeting[]; polls: SchedulePoll[] };
const key = "vexa.meeting-planner.v1";
let snapshot: Planner | undefined;
const listeners = new Set<() => void>();
export function offsetDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00-05:00`);
  date.setUTCDate(date.getUTCDate() + offset);
  return todayLima(date);
}
function seed(userId: string): Planner {
  const today = todayLima();
  const people = [
    ...new Set(["u-jhony", "u-rober", "u-jose", "u-diego", userId]),
  ];
  const meeting = (
    id: string,
    title: string,
    offset: number,
    time: string,
    duration: number,
  ): PlannedMeeting => ({
    id,
    title,
    date: offsetDay(today, offset),
    time,
    duration,
    participants: people,
    location: "",
    agenda:
      "Revisar avances del proyecto\nResolver bloqueos del equipo\nDefinir próximos pasos y responsables",
    minutes:
      offset < 0
        ? "Compartir la propuesta actualizada antes del viernes. Rober revisará el alcance técnico y Diego preparará las pantallas principales."
        : "",
    status: offset < 0 ? "completed" : "scheduled",
    attendance:
      offset < 0
        ? Object.fromEntries(people.map((id) => [id, "present" as const]))
        : {},
  });
  return {
    meetings: [
      meeting("planning", "Planificación del equipo", 0, "18:30", 45),
      meeting("design", "Revisión de diseño", 1, "10:00", 30),
      meeting("weekly", "Reunión semanal", 3, "16:00", 60),
      meeting("past", "Seguimiento de proyectos", -3, "15:00", 45),
    ],
    polls: [
      {
        id: "strategy",
        title: "Coordinar la próxima planificación",
        participants: people,
        duration: 45,
        closed: false,
        options: [1, 2, 3].map((n) => ({
          date: offsetDay(today, n),
          time: n === 2 ? "11:00" : "16:00",
          votes: { "u-rober": true, "u-diego": n !== 2, "u-jose": n === 1 },
        })),
      },
    ],
  };
}
function read(userId: string) {
  if (!snapshot) {
    try {
      snapshot = JSON.parse(localStorage.getItem(key) || "null") as
        Planner | undefined;
    } catch {
      /* Use initial agenda. */
    }
    if (
      !snapshot ||
      !Array.isArray(snapshot.meetings) ||
      !Array.isArray(snapshot.polls)
    )
      snapshot = seed(userId);
  }
  return snapshot;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useMeetingPlanner(userId: string) {
  const data = useSyncExternalStore(subscribe, () => read(userId));
  function update(transform: (current: Planner) => Planner) {
    const next = transform(read(userId));
    // Write before notifying: a failed save keeps the current agenda intact.
    localStorage.setItem(key, JSON.stringify(next));
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  return { ...data, update };
}
export function assignedMeetings(meetings: PlannedMeeting[], userId: string) {
  return meetings.filter((meeting) => meeting.participants.includes(userId));
}
export function upcomingMeetings(meetings: PlannedMeeting[], now = Date.now()) {
  return meetings
    .filter(
      (m) =>
        m.status === "scheduled" &&
        new Date(`${m.date}T${m.time}:00-05:00`).getTime() +
          m.duration * 60000 >
          now,
    )
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}
export function useMeetingClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function hasMeetingConflict(
  meetings: PlannedMeeting[],
  option: { date: string; time: string },
  duration: number,
  participants: string[],
) {
  const start = new Date(`${option.date}T${option.time}:00-05:00`).getTime();
  return meetings.some((m) => {
    const otherStart = new Date(`${m.date}T${m.time}:00-05:00`).getTime();
    return (
      m.status === "scheduled" &&
      m.participants.some((id) => participants.includes(id)) &&
      otherStart < start + duration * 60000 &&
      otherStart + m.duration * 60000 > start
    );
  });
}
export function meetingDate(day: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  }).format(new Date(`${day}T12:00:00-05:00`));
}
