import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./tooltip.css";

/** Tooltips shared by charts, controls and metadata through data-tooltip. */
export function TooltipLayer() {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    below: boolean;
  } | null>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const active = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let opening: ReturnType<typeof setTimeout> | undefined;
    let closing: ReturnType<typeof setTimeout> | undefined;
    function close() {
      clearTimeout(opening);
      clearTimeout(closing);
      active.current = null;
      setAnchor(null);
      setPosition(null);
    }
    function open(element: HTMLElement, immediate = false) {
      clearTimeout(closing);
      if (active.current === element) return;
      clearTimeout(opening);
      active.current = element;
      setAnchor(null);
      setPosition(null);
      opening = setTimeout(
        () => {
          if (element.isConnected) setAnchor(element);
        },
        immediate ? 0 : 160,
      );
    }
    const find = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>("[data-tooltip]")
        : null;
    function enter(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      clearTimeout(closing);
      const element = find(event.target);
      if (element?.dataset.tooltip) open(element);
      else if (
        event.target instanceof Node &&
        !tooltip.current?.contains(event.target)
      )
        closing = setTimeout(close, 100);
      else clearTimeout(closing);
    }
    function leave(event: PointerEvent) {
      if (
        event.relatedTarget instanceof Node &&
        (active.current?.contains(event.relatedTarget) ||
          tooltip.current?.contains(event.relatedTarget))
      )
        return;
      if (
        find(event.target) ||
        (event.target instanceof Node &&
          tooltip.current?.contains(event.target))
      ) {
        clearTimeout(closing);
        closing = setTimeout(close, 100);
      }
    }
    function focus(event: FocusEvent) {
      const element = find(event.target);
      if (element?.dataset.tooltip) open(element, true);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    function check() {
      if (active.current && !active.current.isConnected) close();
    }
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointerover", enter);
    document.addEventListener("pointerout", leave);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", close);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      clearTimeout(opening);
      clearTimeout(closing);
      observer.disconnect();
      document.removeEventListener("pointerover", enter);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", close);
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);
  useLayoutEffect(() => {
    if (!anchor || !tooltip.current) return;
    const rect = anchor.getBoundingClientRect();
    const box = tooltip.current.getBoundingClientRect();
    const margin = 10,
      gap = 9;
    const below = rect.top < box.height + gap + margin;
    setPosition({
      left: Math.max(
        margin,
        Math.min(
          rect.left + rect.width / 2 - box.width / 2,
          window.innerWidth - box.width - margin,
        ),
      ),
      top: Math.max(
        margin,
        Math.min(
          below ? rect.bottom + gap : rect.top - box.height - gap,
          window.innerHeight - box.height - margin,
        ),
      ),
      below,
    });
    const previous = anchor.getAttribute("aria-describedby");
    anchor.setAttribute(
      "aria-describedby",
      [previous, id].filter(Boolean).join(" "),
    );
    return () => {
      const remaining = (anchor.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .filter((value) => value !== id)
        .join(" ");
      if (remaining) anchor.setAttribute("aria-describedby", remaining);
      else anchor.removeAttribute("aria-describedby");
    };
  }, [anchor, id]);
  if (!anchor?.dataset.tooltip) return null;
  return createPortal(
    <div
      ref={tooltip}
      id={id}
      role="tooltip"
      className="vexa-tooltip"
      data-placement={position?.below ? "bottom" : "top"}
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {anchor.dataset.tooltip}
    </div>,
    anchor.closest("dialog") ?? document.body,
  );
}
