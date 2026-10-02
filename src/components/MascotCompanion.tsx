"use client";
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Moon, PawPrint } from "lucide-react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { motionTokens } from "@/lib/motion-tokens";
import "./mascot-companion.css";
import { RobotIdleArtwork } from "./RobotIdleArtwork";

type Position = { x: number; y: number };
type Pose = "idle" | "blink" | "sleep";
const STORAGE = "vexa-studio.mascot";

export function MascotCompanion({ hasTimer }: { hasTimer: boolean }) {
  const reduced = useReducedMotion();
  const [position, setPosition] = useState<Position | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [pose, setPose] = useState<Pose>("idle");
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ x: number; y: number; origin: Position; moved: boolean } | null>(null);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function constrain(point: Position): Position {
    const mobile = window.innerWidth < 1024;
    const size = mobile ? 67.584 : 81.664;
    const height = mobile ? 95.744 : 115.456;
    const bottom = mobile ? (hasTimer ? 176 : 92) : (hasTimer ? 88 : 12);
    return {
      x: Math.max(mobile ? 8 : 96, Math.min(point.x, window.innerWidth - size - 8)),
      y: Math.max(72, Math.min(point.y, window.innerHeight - height - 36 - bottom)),
    };
  }
  function remember(point: Position | null, asleep: boolean) {
    try { localStorage.setItem(STORAGE, JSON.stringify({ position: point, sleeping: asleep })); } catch { /* Session-only when storage is unavailable. */ }
  }
  useEffect(() => {
    let initial: Position = { x: window.innerWidth - 140, y: window.innerHeight - 220 };
    let asleep = false;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
      if (Number.isFinite(saved?.position?.x) && Number.isFinite(saved?.position?.y)) initial = saved.position;
      asleep = saved?.sleeping === true;
    } catch { /* Use the initial position. */ }
    setPosition(constrain(initial));
    setSleeping(asleep);
    return () => { if (sleepTimer.current) clearTimeout(sleepTimer.current); };
    // Load the browser preference once, independently of navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const resize = () => setPosition(current => current ? constrain(current) : current);
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
    if (sleeping || dragging || pose === "sleep") return;
    if (pose === "idle" && reduced) return;
    const timing = motionTokens.mascot;
    const delay = pose === "idle" ? timing.blinkPauseMs.min + Math.random() * (timing.blinkPauseMs.max - timing.blinkPauseMs.min)
      : timing.blinkMs;
    const timer = setTimeout(() => setPose(pose === "idle" ? "blink" : "idle"), delay);
    return () => clearTimeout(timer);
  }, [pose, sleeping, dragging, reduced]);

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!position || pose === "sleep" || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { x: event.clientX, y: event.clientY, origin: position, moved: false };
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = gesture.current;
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) { drag.moved = true; setDragging(true); setPose("idle"); }
    if (drag.moved) setPosition(constrain({ x: drag.origin.x + dx, y: drag.origin.y + dy }));
  }
  function pointerEnd(event: PointerEvent<HTMLButtonElement>) {
    gesture.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    remember(position, false);
  }
  function keyboardMove(event: KeyboardEvent<HTMLButtonElement>) {
    if (!position || pose === "sleep") return;
    const step = event.shiftKey ? 4 : 16;
    const delta: Record<string, Position> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    if (!delta[event.key]) return;
    event.preventDefault();
    const next = constrain({ x: position.x + delta[event.key].x, y: position.y + delta[event.key].y });
    setPosition(next); remember(next, false);
  }
  function sleep() {
    if (pose === "sleep") return;
    setPose("sleep");
    sleepTimer.current = setTimeout(() => { setSleeping(true); remember(position, true); }, reduced ? 0 : motionTokens.mascot.sleepMs);
  }
  function wake() { setSleeping(false); setPose("idle"); remember(position, false); }

  if (!position) return null;
  return <>
    <AnimatePresence>
      {!sleeping && <motion.div key="mascot" className="mascot-companion" data-pose={pose} data-dragging={dragging} data-reduced={reduced}
        style={{ left: position.x, top: position.y }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: .85, filter: "blur(5px)" }}
        transition={{ duration: reduced ? motionTokens.duration.fast : motionTokens.mascot.fadeSeconds }}>
        <button type="button" className="mascot-handle" aria-label="Mascota: arrastra para moverla o usa las flechas"
          aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight" title="Arrastra para mover"
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
          onKeyDown={keyboardMove}>
          <RobotIdleArtwork blinking={pose === "blink"} still={reduced || dragging || pose === "sleep"} />
        </button>
        <button type="button" className="mascot-sleep" onClick={sleep} disabled={pose === "sleep"} aria-label="Mandar a dormir a la mascota" title="Mandar a dormir"><Moon size={15} aria-hidden="true" /></button>
      </motion.div>}
    </AnimatePresence>
    {sleeping && <button type="button" className={`mascot-wake ${hasTimer ? "mascot-wake-timer" : ""}`} onClick={wake} aria-label="Despertar mascota" title="Despertar mascota"><PawPrint size={18} aria-hidden="true" /></button>}
  </>;
}
