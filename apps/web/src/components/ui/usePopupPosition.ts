import { useLayoutEffect, useState, type RefObject } from "react";

/** Mantiene el menú dentro de la pantalla o del modal, incluso con transforms. */
export function usePopupPosition(
  trigger: RefObject<HTMLElement | null>,
  popup: RefObject<HTMLDivElement | null>,
  open: boolean,
  minimumWidth = 190,
  maximumHeight = 320,
  maximumWidth = Infinity,
) {
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: minimumWidth,
    maxHeight: 320,
  });
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const host = trigger.current!.closest("dialog");
      const bounds = host?.getBoundingClientRect();
      const hostStyle = host ? getComputedStyle(host) : null;
      const relative = Boolean(
        hostStyle &&
        (hostStyle.transform !== "none" ||
          hostStyle.filter !== "none" ||
          hostStyle.backdropFilter !== "none"),
      );
      const boundaryTop = bounds ? bounds.top + 8 : 12;
      const boundaryBottom = bounds ? bounds.bottom - 8 : innerHeight - 12;
      const boundaryLeft = bounds ? bounds.left + 8 : 12;
      const boundaryRight = bounds ? bounds.right - 8 : innerWidth - 12;
      const below = boundaryBottom - rect.bottom - 6;
      const above = rect.top - boundaryTop - 6;
      const flip = below < 180 && above > below;
      const maxHeight = Math.max(
        44,
        Math.min(maximumHeight, flip ? above : below),
      );
      const width = Math.min(
        Math.max(rect.width, minimumWidth),
        maximumWidth,
        boundaryRight - boundaryLeft,
      );
      const top = flip
        ? rect.top -
          Math.min(maxHeight, popup.current?.scrollHeight ?? maxHeight) -
          6
        : rect.bottom + 6;
      const left = Math.max(
        boundaryLeft,
        Math.min(rect.left, boundaryRight - width),
      );
      setPosition({
        top: top - (relative ? bounds!.top + host!.clientTop : 0),
        left: left - (relative ? bounds!.left + host!.clientLeft : 0),
        width,
        maxHeight,
      });
    };
    update();
    const host = trigger.current?.closest("dialog");
    host?.addEventListener("animationend", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      host?.removeEventListener("animationend", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, minimumWidth, maximumHeight, maximumWidth, trigger, popup]);

  return position;
}
