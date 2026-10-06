import type { HoursParticipant, Id, TimeEntry } from './types'

/** People that can be tagged on one entry. */
export const MAX_PARTICIPANTS = 10

type Credited = Pick<TimeEntry, 'userId' | 'hours'> & {
  participants?: HoursParticipant[]
}

/** Percentage (0-100) of the entry's hours credited to a person: owner 100, tagged their share, else 0. */
export function creditShare(entry: Credited, userId: Id): number {
  if (entry.userId === userId) return 100
  return entry.participants?.find((p) => p.userId === userId)?.sharePercent ?? 0
}

/**
 * Hours that count for a person's POINTS: only validated, unpaid, non-voided entries, at the person's
 * share. Same rule as the SQL view `member_points`.
 */
export function pointsCredit(
  entry: Credited & Pick<TimeEntry, 'paid' | 'validated' | 'voidedAt'>,
  userId: Id,
): number {
  if (entry.paid || !entry.validated || entry.voidedAt) return 0
  return (entry.hours * creditShare(entry, userId)) / 100
}

/**
 * Hours that count toward a person's MONTHLY MINIMUM. The owner counts every finished entry (pending
 * included); a tagged person counts only validated ones. Voided entries and clock drafts never count;
 * paid ones still do. Same rule as the SQL function `monthly_summary`.
 */
export function complianceCredit(
  entry: Credited & Pick<TimeEntry, 'validated' | 'voidedAt' | 'draft'>,
  userId: Id,
): number {
  if (entry.voidedAt || entry.draft) return 0
  if (entry.userId === userId) return entry.hours
  return entry.validated ? (entry.hours * creditShare(entry, userId)) / 100 : 0
}

/**
 * The entries as a person's month sees them: their own at 100 % and the validated ones they were tagged
 * in, scaled to their share. Feed the result to `monthlyActivity` to get the credited hours of the month.
 */
export function entriesCreditedTo(entries: TimeEntry[], userId: Id): TimeEntry[] {
  return entries.flatMap((entry) => {
    if (entry.userId === userId) return [entry]
    const hours = complianceCredit(entry, userId)
    return hours > 0 ? [{ ...entry, hours }] : []
  })
}

/**
 * Validates the tags a person sends and fills the default share (100). Throws the same messages as the
 * SQL function `private.apply_participants` and its guard.
 */
export function normalizeParticipants(
  input: { userId: Id; sharePercent?: number | null }[] | undefined | null,
  ownerId: Id,
  isActive: (userId: Id) => boolean,
): HoursParticipant[] {
  const list = input ?? []
  if (list.length > MAX_PARTICIPANTS) throw new Error('Puedes etiquetar hasta 10 personas')
  const seen = new Set<Id>()
  return list.map(({ userId, sharePercent }) => {
    if (seen.has(userId)) throw new Error('No repitas a una persona')
    seen.add(userId)
    const share = sharePercent ?? 100
    if (!Number.isInteger(share) || share < 1 || share > 100)
      throw new Error('El porcentaje debe ser un entero entre 1 y 100')
    if (userId === ownerId) throw new Error('No puedes etiquetarte a ti mismo')
    if (!isActive(userId)) throw new Error('La persona etiquetada no está disponible')
    return { userId, sharePercent: share }
  })
}
