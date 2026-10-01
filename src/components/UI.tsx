import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { ArrowUpRight, X, FolderPlus } from "lucide-react";

export function PageTitle({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <h1>
          {title}
          <span className="title-dot">.</span>
        </h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </header>
  );
}
export function Empty({
  title = "Un espacio por construir",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <FolderPlus size={32} strokeWidth={1.25} />
      <h3>{title}</h3>
      <p>
        {children || "Crea un proyecto para comenzar a organizar tu trabajo."}
      </p>
    </div>
  );
}
export function Panel({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    node?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => {
      node?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="panel-dialog"
      aria-labelledby="panel-title"
      onCancel={onClose}
    >
      <div className="panel-head">
        <h2 id="panel-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Cerrar panel"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="panel-body">{children}</div>
    </dialog>
  );
}
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string }>;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        "aria-describedby": error ? `${id}-error` : undefined,
      })}
      {error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`status ${value === "Completada" || value === "Completado" ? "done" : value === "En curso" || value === "Activo" ? "active" : "pending"}`}
    >
      <i />
      {value}
    </span>
  );
}
export function SectionTitle({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Arrow() {
  return <ArrowUpRight size={18} />;
}
