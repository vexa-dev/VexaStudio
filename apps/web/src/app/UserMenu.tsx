import {
  Check,
  Users,
  History,
  LogOut,
  UserRound,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { canAccessStudio } from "@vexa/domain/access";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLoginProfiles } from "@/features/auth/hooks/useLoginProfiles";
import { areaLabel } from "@/lib/labels";

const itemClass =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2";
const ITEM_SELECTOR = '[role^="menuitem"]';

/**
 * Menú del usuario. Arriba, la navegación de la persona (perfil, proyectos, salir). Abajo, el bloque
 * "Modo de pruebas" con el cambio rápido de socio: se retira en la etapa 2 sin rediseñar el menú.
 */
export function UserMenu({
  mascotVisible,
  onToggleMascot,
}: {
  mascotVisible: boolean;
  onToggleMascot: () => void;
}) {
  const { user, signIn, signOut } = useAuth();
  const { data: profiles } = useLoginProfiles();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  /** Cierra el menú; con `restoreFocus` el foco vuelve al botón (teclado), no al hacer clic fuera. */
  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // Al abrir, el foco entra al menú, en el primer ítem.
    menuRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();

    const onPointer = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, close]);

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === "Tab") {
      // El menú no atrapa el foco: Tab lo cierra y sigue el orden normal de la página.
      setOpen(false);
      return;
    }
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: items.length - 1,
    }[e.key];
    if (move === undefined || items.length === 0) return;
    e.preventDefault();
    items[(move + items.length) % items.length].focus();
  };

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${user.name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
      >
        <Avatar name={user.name} size="sm" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Menú de usuario"
          onKeyDown={onMenuKeyDown}
          className="pop-in absolute right-0 z-30 mt-2 w-72 rounded-xl border border-border bg-surface p-2 shadow-pop"
        >
          <Link
            role="menuitem"
            to="/perfil"
            className={itemClass}
            onClick={() => close(false)}
          >
            <UserRound className="size-4" aria-hidden="true" /> Mi perfil
          </Link>
          <Link
            role="menuitem"
            to="/equipo"
            className={`${itemClass} lg:hidden`}
            onClick={() => close(false)}
          >
            <Users className="size-4" aria-hidden="true" /> Equipo
          </Link>
          {canAccessStudio(user.role) ? (
            <Link
              role="menuitem"
              to="/actividad"
              className={`${itemClass} lg:hidden`}
              onClick={() => close(false)}
            >
              <History className="size-4" aria-hidden="true" /> Actividad
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              onToggleMascot();
              close(true);
            }}
          >
            {mascotVisible ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
            {mascotVisible ? "Ocultar mascota" : "Mostrar mascota"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut className="size-4" aria-hidden="true" /> Cerrar sesión
          </button>

          {profiles?.length ? (
            <>
              <hr className="my-2 border-border" />
              <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
                <p className="text-xs font-medium text-muted">
                  Cambiar de usuario
                </p>
                <Badge tone="warning">Modo de pruebas</Badge>
              </div>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={p.id === user.id}
                  className={itemClass}
                  onClick={async () => {
                    await signIn(p.id);
                    close(true);
                  }}
                >
                  <Avatar name={p.name} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-muted">
                      {areaLabel[p.area]}
                    </span>
                  </span>
                  {p.id === user.id ? (
                    <Check
                      className="size-4 text-primary-text"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
