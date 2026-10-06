import { Download, FileX } from "lucide-react";
import type { ChatAttachment, ChatPurgedAttachment } from "@vexa/domain/chat";
import { KIND_ICONS } from "./AttachMenu";
import {
  INLINE_VIDEO_BYTES,
  dataUrlBytes,
  formatBytes,
  kindOfFile,
} from "./attachment-kinds";
import { attachmentCopy } from "./chat-copy";

/**
 * A file in a message. `onOpen` fires when the person opens or downloads it
 * (the click on the link, or pressing play on an inline video).
 */
export function AttachmentView({
  attachment,
  onOpen,
}: {
  attachment: ChatAttachment;
  onOpen?: () => void;
}) {
  const kind = kindOfFile(attachment);
  const bytes = dataUrlBytes(attachment.data);
  const Icon = KIND_ICONS[kind.id];
  if (kind.id === "image" && attachment.type.startsWith("image/"))
    return (
      <a
        href={attachment.data}
        download={attachment.name}
        className="chat-attachment"
        onClick={onOpen}
      >
        <img
          src={attachment.data}
          alt={attachment.name}
          loading="lazy"
          decoding="async"
        />
        {attachment.name}
      </a>
    );
  if (kind.id === "video" && bytes <= INLINE_VIDEO_BYTES)
    return (
      <div className="chat-attachment">
        <video
          src={attachment.data}
          controls
          preload="metadata"
          onPlay={onOpen}
        />
        <span>
          {attachment.name} · {formatBytes(bytes)}
        </span>
      </div>
    );
  return (
    <a
      href={attachment.data}
      download={attachment.name}
      className="chat-attachment chat-attachment-card"
      onClick={onOpen}
      aria-label={`Descargar ${attachment.name}, ${kind.label}, ${formatBytes(bytes)}`}
    >
      <span className="chat-attachment-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className="chat-attachment-meta">
        <strong>{attachment.name}</strong>
        <small>
          {kind.label} · {formatBytes(bytes)}
        </small>
      </span>
      <Download size={16} aria-hidden="true" />
    </a>
  );
}

/** Text placeholder of a file removed to free space; name and size survive as text. */
export function PurgedAttachmentView({
  attachment,
}: {
  attachment: ChatPurgedAttachment;
}) {
  return (
    <div className="chat-attachment chat-attachment-card chat-attachment-purged">
      <span className="chat-attachment-icon" aria-hidden="true">
        <FileX size={20} />
      </span>
      <span className="chat-attachment-meta">
        <strong>{attachmentCopy.purged}</strong>
        <small>
          {attachment.name} · {formatBytes(attachment.size)}
        </small>
      </span>
    </div>
  );
}
