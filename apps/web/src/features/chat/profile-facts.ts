import { formatDate } from "@vexa/domain/dates";
import { formatHours } from "@vexa/domain/format";
import type { Profile } from "@vexa/domain/types";
import { areaLabel, roleLabel } from "@/lib/labels";

export type ProfileFactKey = "weekly" | "since" | "account" | "presence";

export interface ProfileFact {
  key: ProfileFactKey;
  label: string;
  value: string;
}

/** Role and area labels, shown as chips under the name. */
export function profileChips(member: Profile): { role: string; area: string } {
  return { role: roleLabel[member.role], area: areaLabel[member.area] };
}

/** Ordered rows for the profile panel. Unknown values are left out. */
export function profileFacts(
  member: Profile,
  { online }: { online: boolean },
): ProfileFact[] {
  const facts: ProfileFact[] = [
    {
      key: "weekly",
      label: "Compromiso semanal",
      value: `${formatHours(member.weeklyHours)} por semana`,
    },
  ];
  if (member.joinedAt)
    facts.push({
      key: "since",
      label: "Miembro desde",
      value: formatDate(member.joinedAt),
    });
  facts.push(
    {
      key: "account",
      label: "Cuenta",
      value: member.active ? "Activo" : "Inactivo",
    },
    {
      key: "presence",
      label: "Conexión",
      value: online ? "En línea" : "Sin conexión",
    },
  );
  return facts;
}
