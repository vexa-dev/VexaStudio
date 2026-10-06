import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { formatDate } from "@vexa/domain/dates";
import type { SharedFile } from "./shared-media";
import "./chat-files.css";

/**
 * Overlay inside the conversation pane that shows one photo or video of the
 * shared history. It must be rendered inside the positioned
 * `.chat-conversation` section.
 */
export function ChatMediaViewer({
  items,
  index,
  authorName,
  onIndexChange,
  onClose,
}: {
  /** Photos and videos, newest first. */
  items: SharedFile[];
  index: number;
  authorName: (id: string) => string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const item = items[index];
  const last = items.length - 1;

  // Focus the close button on open and hand focus back to the opener on close.
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButton.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // Capture phase: the underlying panel must stay open.
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === "ArrowLeft" && index < last) {
        event.preventDefault();
        onIndexChange(index + 1);
      } else if (event.key === "ArrowRight" && index > 0) {
        event.preventDefault();
        onIndexChange(index - 1);
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [index, last, onClose, onIndexChange]);

  if (!item) return null;
  // Items are newest first, so "previous" (left) is the older neighbour and
  // "next" (right) the newer one, like paging through a gallery by date.
  return (
    <div
      className="chat-viewer"
      role="dialog"
      aria-modal="false"
      aria-label="Visor de multimedia"
    >
      <header className="chat-viewer-bar">
        <button
          ref={closeButton}
          type="button"
          className="chat-viewer-button"
          aria-label="Cerrar visor"
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <div className="chat-viewer-meta">
          <strong>{authorName(item.authorId)}</strong>
          <span>{formatDate(new Date(item.sentAt))}</span>
        </div>
        <span className="chat-viewer-count num" aria-live="polite">
          {index + 1} de {items.length}
        </span>
        <a
          className="chat-viewer-button"
          href={item.data}
          download={item.name}
          aria-label={`Descargar ${item.name}`}
        >
          <Download size={20} aria-hidden="true" />
        </a>
      </header>
      <div className="chat-viewer-stage">
        {item.kind === "video" ? (
          <video
            key={item.messageId}
            className="chat-viewer-media"
            src={item.data}
            controls
            playsInline
            aria-label={item.name}
          />
        ) : (
          <img
            key={item.messageId}
            className="chat-viewer-media"
            src={item.data}
            alt={item.name}
          />
        )}
        <button
          type="button"
          className="chat-viewer-button chat-viewer-nav is-prev"
          aria-label="Anterior"
          disabled={index >= last}
          onClick={() => onIndexChange(index + 1)}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="chat-viewer-button chat-viewer-nav is-next"
          aria-label="Siguiente"
          disabled={index <= 0}
          onClick={() => onIndexChange(index - 1)}
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
