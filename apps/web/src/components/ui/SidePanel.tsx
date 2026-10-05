import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";

export function SidePanel({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    dialog.showModal();
    const dismiss = (event: PointerEvent) => {
      if (event.target === dialog) closeRef.current();
    };
    dialog.addEventListener("pointerdown", dismiss);
    return () => {
      dialog.removeEventListener("pointerdown", dismiss);
      dialog.close();
      root.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      className={`user-drawer ${className}`}
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="user-drawer-body">
        <header className="notification-panel-heading">
          <h2 id={titleId}>{title}</h2>
          <Button
            variant="ghost"
            className="w-11 px-0"
            aria-label={`Cerrar ${title}`}
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </Button>
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
