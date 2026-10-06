export type AttachmentKindId =
  "image" | "video" | "document" | "archive" | "design" | "file";

export interface AttachmentKind {
  id: AttachmentKindId;
  label: string;
  /** Value for the file input `accept` attribute. */
  accept: string;
  /** Lowercase extensions (no dot) used when the MIME type is unknown. */
  extensions: string[];
}

/** Demo limit: attachments are stored as base64 in localStorage. */
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
export const SUPABASE_ATTACHMENT_BYTES = 25 * 1024 * 1024;
/** Videos up to this size play inline; larger ones show a download card. */
export const INLINE_VIDEO_BYTES = 2 * 1024 * 1024;

export const ATTACHMENT_KINDS: AttachmentKind[] = [
  {
    id: "image",
    label: "Foto o captura",
    accept: "image/*",
    extensions: ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic"],
  },
  {
    id: "video",
    label: "Video",
    accept: "video/*",
    extensions: ["mp4", "mov", "webm", "m4v"],
  },
  {
    id: "document",
    label: "Documento",
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv",
    extensions: [
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
      "txt",
      "md",
      "csv",
    ],
  },
  {
    id: "archive",
    label: "Comprimido",
    accept: ".zip,.rar,.7z",
    extensions: ["zip", "rar", "7z"],
  },
  {
    id: "design",
    label: "Diseño",
    accept: ".svg,.psd,.ai,.fig,.sketch",
    extensions: ["svg", "psd", "ai", "fig", "sketch"],
  },
];

export const GENERIC_KIND: AttachmentKind = {
  id: "file",
  label: "Archivo",
  accept: "",
  extensions: [],
};

export function kindOfFile(file: {
  name: string;
  type: string;
}): AttachmentKind {
  // SVG is an image MIME type but belongs with design files.
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "svg") return ATTACHMENT_KINDS[4];
  if (file.type.startsWith("image/")) return ATTACHMENT_KINDS[0];
  if (file.type.startsWith("video/")) return ATTACHMENT_KINDS[1];
  return (
    ATTACHMENT_KINDS.find((kind) => kind.extensions.includes(extension)) ??
    GENERIC_KIND
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${Number(value.toFixed(1))} ${units[unit]}`;
}

export type AttachmentCheck = { ok: true } | { ok: false; message: string };

export function validateAttachment(
  file: {
    name: string;
    type: string;
    size: number;
  },
  limit = MAX_ATTACHMENT_BYTES,
): AttachmentCheck {
  if (file.size <= 0) return { ok: false, message: "El archivo está vacío." };
  if (file.size > limit)
    return {
      ok: false,
      message: `El archivo pesa ${formatBytes(file.size)} y el límite es de ${formatBytes(limit)}. ${limit === MAX_ATTACHMENT_BYTES ? "La demo guarda los adjuntos en el navegador; con almacenamiento en la nube el límite será mayor." : ""}`,
    };
  return { ok: true };
}

/** Approximate decoded size of a base64 data URL. */
export function dataUrlBytes(data: string): number {
  const comma = data.indexOf(",");
  const base64 = comma >= 0 ? data.slice(comma + 1) : data;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
