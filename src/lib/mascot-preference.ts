type MascotPreference = {
  position: { x: number; y: number } | null;
  sleeping: boolean;
};
const STORAGE = "vexa-studio.mascot";

export function readMascotPreference(): MascotPreference {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
    const position =
      Number.isFinite(saved?.position?.x) && Number.isFinite(saved?.position?.y)
        ? { x: saved.position.x, y: saved.position.y }
        : null;
    return { position, sleeping: saved?.sleeping === true };
  } catch {
    return { position: null, sleeping: false };
  }
}

export function saveMascotPreference(patch: Partial<MascotPreference>) {
  try {
    localStorage.setItem(
      STORAGE,
      JSON.stringify({ ...readMascotPreference(), ...patch }),
    );
  } catch {
    /* Keep the current session preference when storage is unavailable. */
  }
}
