"use client";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  readMascotPreference,
  saveMascotPreference,
} from "@/lib/mascot-preference";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { motionTokens } from "@/lib/motion-tokens";
import "./mascot-companion.css";
import { RobotIdleArtwork } from "./RobotIdleArtwork";

type Position = { x: number; y: number };
type Pose = "idle" | "blink";

export function MascotCompanion({
  hasTimer,
  visible,
  resting = false,
}: {
  hasTimer: boolean;
  visible: boolean;
  resting?: boolean;
}) {
  const reduced = useReducedMotion();
  const [position, setPosition] = useState<Position | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [pose, setPose] = useState<Pose>("idle");
  const [dragging, setDragging] = useState(false);
  const [cursor, setCursor] = useState<Position | null>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    origin: Position;
    moved: boolean;
  } | null>(null);

  function constrain(point: Position): Position {
    const mobile = window.innerWidth < 1024;
    const size = mobile ? 67.584 : 81.664;
    const height = mobile ? 95.744 : 115.456;
    const bottom = mobile ? (hasTimer ? 176 : 92) : hasTimer ? 88 : 12;
    return {
      x: Math.max(
        mobile ? 8 : 96,
        Math.min(point.x, window.innerWidth - size - 8),
      ),
      y: Math.max(72, Math.min(point.y, window.innerHeight - height - bottom)),
    };
  }
  function remember(point: Position | null) {
    saveMascotPreference({ position: point });
  }
  useEffect(() => {
    const initial = readMascotPreference().position ?? {
      x: window.innerWidth - 140,
      y: window.innerHeight - 220,
    };
    setPosition(constrain(initial));
    setViewportWidth(window.innerWidth);
    // Load the browser preference once, independently of navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const resize = () => {
      setViewportWidth(window.innerWidth);
      setPosition((current) => (current ? constrain(current) : current));
    };
    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
    // Bounds also reserve space for the running timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTimer]);
  useEffect(() => {
    if (!visible || reduced) {
      setCursor(null);
      return;
    }
    let frame = 0;
    let point: Position | null = null;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setCursor(point);
      });
    };
    const track = (event: globalThis.PointerEvent) => {
      point =
        event.pointerType === "mouse"
          ? { x: event.clientX, y: event.clientY }
          : null;
      update();
    };
    const reset = () => {
      point = null;
      update();
    };
    const leave = (event: globalThis.PointerEvent) => {
      if (!event.relatedTarget) reset();
    };
    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("pointerout", leave);
    window.addEventListener("blur", reset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", reset);
    };
  }, [visible, reduced]);
  useEffect(() => {
    if (!visible || dragging) return;
    if (pose === "idle" && reduced) return;
    const timing = motionTokens.mascot;
    const delay =
      pose === "idle"
        ? timing.blinkPauseMs.min +
          Math.random() * (timing.blinkPauseMs.max - timing.blinkPauseMs.min)
        : timing.blinkMs;
    const timer = setTimeout(
      () => setPose(pose === "idle" ? "blink" : "idle"),
      delay,
    );
    return () => clearTimeout(timer);
  }, [pose, visible, dragging, reduced]);

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!position || (event.pointerType === "mouse" && event.button !== 0))
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      origin: position,
      moved: false,
    };
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = gesture.current;
    if (!drag) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) {
      drag.moved = true;
      setDragging(true);
      setPose("idle");
    }
    if (drag.moved)
      setPosition(constrain({ x: drag.origin.x + dx, y: drag.origin.y + dy }));
  }
  function pointerEnd(event: PointerEvent<HTMLButtonElement>) {
    gesture.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    remember(position);
  }
  function keyboardMove(event: KeyboardEvent<HTMLButtonElement>) {
    if (!position) return;
    const step = event.shiftKey ? 4 : 16;
    const delta: Record<string, Position> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    if (!delta[event.key]) return;
    event.preventDefault();
    const next = constrain({
      x: position.x + delta[event.key].x,
      y: position.y + delta[event.key].y,
    });
    setPosition(next);
    remember(next);
  }
  if (!position) return null;
  const mascotWidth = viewportWidth < 1024 ? 67.584 : 81.664;
  const facing =
    position.x + mascotWidth / 2 >= viewportWidth / 2 ? "left" : "right";
  const mascotHeight = viewportWidth < 1024 ? 95.744 : 115.456;
  const gaze = cursor
    ? {
        x:
          Math.max(
            -24,
            Math.min(
              24,
              ((cursor.x - position.x - mascotWidth / 2) / 200) * 24,
            ),
          ) * (facing === "left" ? -1 : 1),
        y: Math.max(
          -14,
          Math.min(
            14,
            ((cursor.y - position.y - mascotHeight * 0.25) / 200) * 14,
          ),
        ),
      }
    : { x: 0, y: 0 };
  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="mascot"
            className="mascot-companion"
            data-pose={resting ? "rest" : pose}
            data-dragging={dragging}
            data-reduced={reduced}
            data-facing={facing}
            style={{ left: position.x, top: position.y }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.85, filter: "blur(5px)" }
            }
            transition={{
              duration: reduced
                ? motionTokens.duration.fast
                : motionTokens.mascot.fadeSeconds,
            }}
          >
            <button
              type="button"
              className="mascot-handle"
              aria-label="Mascota: arrastra para moverla o usa las flechas"
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
              data-tooltip="Arrastra para mover"
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerEnd}
              onPointerCancel={pointerEnd}
              onKeyDown={keyboardMove}
            >
              <RobotIdleArtwork
                resting={resting}
                blinking={pose === "blink"}
                still={reduced || dragging}
                gaze={gaze}
              />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
