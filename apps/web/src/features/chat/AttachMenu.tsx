import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import {
  Archive,
  FileText,
  Image,
  PenTool,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  ATTACHMENT_KINDS,
  type AttachmentKind,
  type AttachmentKindId,
} from "./attachment-kinds";

export const KIND_ICONS: Record<AttachmentKindId, LucideIcon> = {
  image: Image,
  video: Video,
  document: FileText,
  archive: Archive,
  design: PenTool,
  file: FileText,
};

/** Menu of attachment kinds; each one opens the file chooser with its filter. */
export function AttachMenu({
  trigger,
  onPick,
  onClose,
}: {
  trigger: RefObject<HTMLButtonElement | null>;
  onPick: (kind: AttachmentKind) => void;
  onClose: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const items = () =>
    Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ??
        [],
    );

  useEffect(() => {
    items()[0]?.focus();
    function outside(event: PointerEvent) {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target))
        onClose();
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
    // Mount-only: focus the first item and listen for outside presses.
  }, []);

  function close() {
    onClose();
    trigger.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const all = items();
    const index = all.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      all[(index + step + all.length) % all.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      all[event.key === "Home" ? 0 : all.length - 1]?.focus();
    } else if (event.key === "Tab") close();
  }

  return (
    <div
      className="chat-attach-menu"
      role="menu"
      aria-label="Tipo de adjunto"
      ref={menu}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {ATTACHMENT_KINDS.map((kind) => {
        const Icon = KIND_ICONS[kind.id];
        return (
          <button
            key={kind.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => onPick(kind)}
          >
            <Icon size={18} aria-hidden="true" />
            {kind.label}
          </button>
        );
      })}
    </div>
  );
}
