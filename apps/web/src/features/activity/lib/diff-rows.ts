import type { AuditChange, AuditClient } from "@vexa/domain/audit";
import { fieldLabel, formatFieldValue } from "./format-value";

export interface DiffRow {
  field: string;
  label: string;
  before: string;
  after: string;
}

/** Filas de la tabla campo / antes / después, con los valores ya formateados para mostrar. */
export function diffRows(
  changes: AuditChange[],
  resolveId?: (id: string) => string | undefined,
): DiffRow[] {
  return changes.map((c) => ({
    field: c.field,
    label: fieldLabel(c.field),
    before: formatFieldValue(c.field, c.from, resolveId),
    after: formatFieldValue(c.field, c.to, resolveId),
  }));
}

const PLATFORMS: Record<string, string> = {
  web: "Web",
  desktop: "Escritorio",
  mobile: "Móvil",
};

/** "Web · v1.2.0": plataforma del cliente y versión de la aplicación. */
export function clientLabel(client: AuditClient): string {
  const platform = PLATFORMS[client.platform] ?? client.platform;
  return client.appVersion ? `${platform} · v${client.appVersion}` : platform;
}
