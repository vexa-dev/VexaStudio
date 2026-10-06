import { chatCopy } from "./chat-copy";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Paperclip, Send, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { isSupabaseSource } from "@/services/supabase/data-source";
import { AttachMenu, KIND_ICONS } from "./AttachMenu";
import {
  SUPABASE_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_BYTES,
  dataUrlBytes,
  formatBytes,
  kindOfFile,
  validateAttachment,
  type AttachmentKind,
} from "./attachment-kinds";
import type { ChatAttachment, ChatMessage } from "./chat-store";

const MAX_ROWS_PX = 120; // about five lines

export function ChatComposer({
  draft,
  onDraftChange,
  attachment,
  onAttachmentChange,
  reply,
  edit,
  replyAuthor,
  onCancelContext,
  emojiOpen,
  onToggleEmoji,
  onSubmit,
  inputRef,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  attachment?: ChatAttachment;
  onAttachmentChange: (value: ChatAttachment | undefined) => void;
  reply: ChatMessage | null;
  edit: ChatMessage | null;
  replyAuthor: string;
  onCancelContext: () => void;
  emojiOpen: boolean;
  onToggleEmoji: () => void;
  onSubmit: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const attachButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accept, setAccept] = useState("");
  // Auto-grow: reset to auto so it can also shrink, then clamp to ~5 lines.
  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, MAX_ROWS_PX)}px`;
  }, [draft, inputRef]);

  function readFile(file: File) {
    const check = validateAttachment(
      file,
      isSupabaseSource() ? SUPABASE_ATTACHMENT_BYTES : MAX_ATTACHMENT_BYTES,
    );
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string")
        onAttachmentChange({
          name: file.name,
          type: file.type || "application/octet-stream",
          data: reader.result,
        });
    };
    reader.onerror = () => toast.error("No se pudo abrir el adjunto.");
    reader.readAsDataURL(file);
  }

  function pickKind(kind: AttachmentKind) {
    setMenuOpen(false);
    setAccept(kind.accept);
    // The accept attribute must be committed before the chooser opens.
    requestAnimationFrame(() => fileInput.current?.click());
  }

  const attachmentKind = attachment ? kindOfFile(attachment) : null;
  const AttachmentIcon = attachmentKind ? KIND_ICONS[attachmentKind.id] : null;
  const context = edit ?? reply;
  return (
    <>
      {context && (
        <div className="chat-composer-context">
          <span>
            <strong>
              {edit ? "Editar mensaje" : `Responder a ${replyAuthor}`}
            </strong>
            <small>{context.text || "Archivo adjunto"}</small>
          </span>
          <button
            type="button"
            aria-label="Cancelar respuesta o edición"
            onClick={onCancelContext}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      {attachment && attachmentKind && AttachmentIcon && (
        <div className="chat-composer-context chat-attachment-chip">
          {attachmentKind.id === "image" ? (
            <img src={attachment.data} alt="" />
          ) : (
            <span className="chat-attachment-icon" aria-hidden="true">
              <AttachmentIcon size={18} />
            </span>
          )}
          <span>
            <strong>{attachment.name}</strong>
            <small>
              {attachmentKind.label} ·{" "}
              {formatBytes(dataUrlBytes(attachment.data))}
            </small>
          </span>
          <button
            type="button"
            aria-label="Quitar adjunto"
            onClick={() => onAttachmentChange(undefined)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {menuOpen && (
          <AttachMenu
            trigger={attachButton}
            onPick={pickKind}
            onClose={() => setMenuOpen(false)}
          />
        )}
        <div className="chat-composer-box">
          <button
            type="button"
            aria-label="Seleccionar emoji"
            aria-expanded={emojiOpen}
            onClick={onToggleEmoji}
          >
            <Smile size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            ref={attachButton}
            aria-label="Adjuntar archivo"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={!!edit}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Paperclip size={19} aria-hidden="true" />
          </button>
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-label="Seleccionar adjunto"
            accept={accept || undefined}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) readFile(file);
            }}
          />
          <textarea
            ref={inputRef}
            value={draft}
            maxLength={4000}
            aria-label="Escribir mensaje"
            placeholder="Escribe un mensaje…"
            rows={1}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
        </div>
        <button
          className="chat-send"
          type="submit"
          aria-label={edit ? "Guardar edición" : chatCopy.send}
          disabled={!draft.trim() && !attachment}
        >
          <Send size={19} aria-hidden="true" />
        </button>
      </form>
    </>
  );
}
