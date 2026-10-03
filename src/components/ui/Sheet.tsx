import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Hoja modal: se ancla abajo en el celular (al alcance del pulgar) y se centra en escritorio.
 * Usa `<dialog>` nativo: atrapa el foco, cierra con Escape y devuelve el foco a quien la abrió.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clic sobre el fondo (el propio <dialog>), no sobre el contenido.
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      className={cn(
        "sheet m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-2xl border border-border bg-surface p-0 text-fg shadow-pop backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-2xl",
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description ? (
                <p className="text-sm text-muted">{description}</p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 -mt-1 w-11 px-0"
              aria-label="Cerrar"
              onClick={onClose}
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </header>
          <div className="overflow-y-auto overscroll-contain px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
