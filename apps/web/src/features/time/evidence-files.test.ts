import { describe, it, expect } from "vitest";
import {
  evidenceState,
  formatBytes,
  pickEvidenceFiles,
  storedEvidence,
} from "./evidence-files";

const file = (name: string, type = "image/png", size = 1000) => ({
  name,
  type,
  size,
});
const now = new Date("2026-10-10T00:00:00Z");

describe("evidencia de horas", () => {
  it("formatea tamaños", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3 MB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
  it("distingue vigente, por eliminar y eliminada", () => {
    expect(evidenceState({ purged: true, purgeAt: null }, now)).toBe("purged");
    expect(
      evidenceState({ purged: false, purgeAt: "2026-10-09T00:00:00Z" }, now),
    ).toBe("due");
    expect(
      evidenceState({ purged: false, purgeAt: "2026-10-12T00:00:00Z" }, now),
    ).toBe("available");
    expect(evidenceState({ purged: false, purgeAt: null }, now)).toBe(
      "available",
    );
  });
  it("acepta archivos válidos y explica los rechazados", () => {
    const { accepted, errors } = pickEvidenceFiles(
      [file("a.png"), file("run.exe", "application/octet-stream"), file("big.pdf", "application/pdf", 9_000)],
      0,
      5_000,
    );
    expect(accepted.map((f) => f.name)).toEqual(["a.png"]);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("run.exe");
  });
  it("respeta el máximo de 5 archivos contando los ya adjuntos", () => {
    const picked = pickEvidenceFiles(
      [file("1.png"), file("2.png"), file("3.png")],
      3,
      5_000,
    );
    expect(picked.accepted).toHaveLength(2);
    expect(picked.errors).toEqual(["Máximo 5 archivos por registro."]);
  });
  it("ignora los archivos eliminados al contarlos", () => {
    const list = [
      { id: "1", name: "a", mime: "x", size: 1, createdAt: "", purged: true },
      { id: "2", name: "b", mime: "x", size: 1, createdAt: "", purged: false },
    ];
    expect(storedEvidence(list).map((e) => e.id)).toEqual(["2"]);
    expect(storedEvidence(undefined)).toEqual([]);
  });
});
