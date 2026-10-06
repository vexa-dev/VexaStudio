import type { WorkingNow } from "./working-now";

/** "Desarrollando {project} · {task}" regardless of how the project was found. */
export function developingLabel(working: WorkingNow | null): string | null {
  if (!working?.projectName) return null;
  return working.taskTitle
    ? `Desarrollando ${working.projectName} · ${working.taskTitle}`
    : `Desarrollando ${working.projectName}`;
}

/** Project line for the chat list: timer wording vs. manually pinned project. */
export function workingLabel(working: WorkingNow | null): string | null {
  if (!working?.projectName) return null;
  return working.source === "manual"
    ? `Trabaja en ${working.projectName}`
    : developingLabel(working);
}
