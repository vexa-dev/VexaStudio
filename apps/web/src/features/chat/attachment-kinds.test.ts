import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_KINDS,
  MAX_ATTACHMENT_BYTES,
  dataUrlBytes,
  formatBytes,
  kindOfFile,
  validateAttachment,
} from "./attachment-kinds";

describe("ATTACHMENT_KINDS", () => {
  it("offers the five menu kinds in order with Spanish labels", () => {
    expect(ATTACHMENT_KINDS.map((kind) => kind.label)).toEqual([
      "Foto o captura",
      "Video",
      "Documento",
      "Comprimido",
      "Diseño",
    ]);
  });
});

describe("kindOfFile", () => {
  it("uses the mime type first", () => {
    expect(kindOfFile({ name: "a.bin", type: "image/png" }).id).toBe("image");
    expect(kindOfFile({ name: "a.bin", type: "video/mp4" }).id).toBe("video");
  });

  it("falls back to the extension, case-insensitively", () => {
    expect(kindOfFile({ name: "Plan.PDF", type: "" }).id).toBe("document");
    expect(kindOfFile({ name: "src.zip", type: "" }).id).toBe("archive");
    expect(kindOfFile({ name: "logo.fig", type: "" }).id).toBe("design");
  });

  it("falls back to a generic file", () => {
    const kind = kindOfFile({ name: "mystery", type: "" });
    expect(kind.id).toBe("file");
    expect(kind.label).toBe("Archivo");
  });
});

describe("formatBytes", () => {
  it("formats common sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3 MB");
  });
});

describe("validateAttachment", () => {
  it("accepts a file within the limit", () => {
    expect(
      validateAttachment({
        name: "a.pdf",
        type: "application/pdf",
        size: 1000,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects an oversized file mentioning the limit and the demo storage", () => {
    const result = validateAttachment({
      name: "a.zip",
      type: "",
      size: MAX_ATTACHMENT_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("3 MB");
      expect(result.message).toContain("navegador");
      expect(result.message).toContain("nube");
    }
  });

  it("rejects an empty file", () => {
    expect(validateAttachment({ name: "a.txt", type: "", size: 0 }).ok).toBe(
      false,
    );
  });
});

describe("dataUrlBytes", () => {
  it("estimates the decoded size of a base64 data URL", () => {
    expect(dataUrlBytes("data:text/plain;base64,aG9sYQ==")).toBe(4);
    expect(dataUrlBytes("data:text/plain;base64,aG9s")).toBe(3);
  });
});

it("keeps the mock 3 MiB cap while explicitly allowing 25 MiB", () => {
  const file = {
    name: "large.pdf",
    type: "application/pdf",
    size: 4 * 1024 * 1024,
  };
  expect(validateAttachment(file).ok).toBe(false);
  expect(validateAttachment(file, 25 * 1024 * 1024).ok).toBe(true);
  expect(
    validateAttachment({ ...file, size: 26 * 1024 * 1024 }, 25 * 1024 * 1024)
      .ok,
  ).toBe(false);
});
