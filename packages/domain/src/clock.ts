/**
 * Pure maths for the interactive clock used to pick a start time.
 * Angles are degrees measured clockwise from twelve o'clock.
 */
import type { IsoDate } from './types'

export type Meridiem = 'am' | 'pm'

export interface ClockTime {
  /** 0-23. */
  hour24: number
  /** 0-59. */
  minute: number
}

/** Lima has no daylight saving time: it is always UTC-5. */
const LIMA_OFFSET_HOURS = 5

const mod = (value: number, size: number) => ((value % size) + size) % size

/** 0 -> 12 a. m., 12 -> 12 p. m. */
export function to12h(hour24: number): { hour12: number; meridiem: Meridiem } {
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return { hour12, meridiem: hour24 < 12 ? 'am' : 'pm' }
}

export function from12h(hour12: number, meridiem: Meridiem): number {
  return (hour12 % 12) + (meridiem === 'pm' ? 12 : 0)
}

export function minuteToAngle(minute: number): number {
  return minute * 6
}

/** The hour hand creeps forward with the minutes: half a degree per minute. */
export function hourToAngle(hour12: number, minute: number): number {
  return (hour12 % 12) * 30 + minute * 0.5
}

/** Angle of a pointer position around a centre, clockwise from twelve o'clock. */
export function angleFromPoint(cx: number, cy: number, x: number, y: number): number {
  const degrees = (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI
  return mod(degrees, 360)
}

/** Rounds to `step` minutes (1 or 5) and wraps at sixty. */
export function snapMinute(minute: number, step = 1): number {
  return mod(Math.round(minute / step) * step, 60)
}

export function angleToMinute(angle: number, step = 1): number {
  return snapMinute(angle / 6, step)
}

/** The minutes push the hour hand forward, so remove that drift before reading the hour. */
export function angleToHour12(angle: number, minute = 0): number {
  const hour = Math.round(mod(angle - minute * 0.5, 360) / 30) % 12
  return hour === 0 ? 12 : hour
}

const pad = (value: number) => String(value).padStart(2, '0')

/** `HH:mm`, the shape the hours form stores. */
export function formatClockTime({ hour24, minute }: ClockTime): string {
  return `${pad(hour24)}:${pad(minute)}`
}

export function parseClockTime(value: string): ClockTime | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour24 = Number(match[1])
  const minute = Number(match[2])
  if (hour24 > 23 || minute > 59) return null
  return { hour24, minute }
}

/** `9:05 a. m.` for people; `formatClockTime` is for storage. */
export function formatClockLabel({ hour24, minute }: ClockTime): string {
  const { hour12, meridiem } = to12h(hour24)
  return `${hour12}:${pad(minute)} ${meridiem === 'am' ? 'a. m.' : 'p. m.'}`
}

/** The UTC instant of a Lima wall-clock date and time. */
export function limaInstant(date: IsoDate, { hour24, minute }: ClockTime): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hour24 + LIMA_OFFSET_HOURS, minute))
}
