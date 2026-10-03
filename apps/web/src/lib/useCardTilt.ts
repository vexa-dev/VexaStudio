import { useEffect, type CSSProperties, type PointerEvent } from "react";
import { motionTokens } from "./motion-tokens";
import { useReducedMotion } from "./useReducedMotion";

const CARDS = ".glass-card, .daily-update";

function cardAt(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>(CARDS) : null;
}
function reset(card: HTMLElement) {
  card.style.setProperty("--tilt-x", "0deg");
  card.style.setProperty("--tilt-y", "0deg");
}

/** One delegated handler also covers cards rendered outside the shared Card component. */
export function useCardTilt() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) document.querySelectorAll<HTMLElement>(CARDS).forEach(reset);
  }, [reduced]);
  return {
    style: { "--card-tilt-duration": `${motionTokens.duration.fast}s` } as CSSProperties,
    onPointerMoveCapture(event: PointerEvent<HTMLElement>) {
      if (reduced || event.pointerType !== "mouse" || !window.matchMedia("(pointer: fine)").matches) return;
      const card = cardAt(event.target);
      if (!card) return;
      const box = card.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
      const y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
      card.style.setProperty("--tilt-x", `${(.5 - y) * motionTokens.tilt.maxDegrees * 2}deg`);
      card.style.setProperty("--tilt-y", `${(x - .5) * motionTokens.tilt.maxDegrees * 2}deg`);
    },
    onPointerOutCapture(event: PointerEvent<HTMLElement>) {
      const card = cardAt(event.target);
      const next = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (card && !card.contains(next)) reset(card);
    },
  };
}
