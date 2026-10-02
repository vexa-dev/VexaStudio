"use client";
import { useAnimate, useReducedMotion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { motionTokens, shouldAnimate } from "@/lib/motion-tokens";

export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [scope, animate] = useAnimate();
  useEffect(() => {
    const moving = !reduced && shouldAnimate(true);
    const controls = animate(
      scope.current,
      {
        opacity: [0.6, 1],
        ...(moving ? { y: [motionTokens.distance.lg, 0] } : {}),
      },
      {
        duration: reduced
          ? motionTokens.duration.fast
          : motionTokens.duration.slow,
        ease: motionTokens.easing.smooth,
      },
    );
    return () => controls.stop();
  }, [animate, reduced, scope]);
  return (
    <div ref={scope} className="page-view">
      {children}
    </div>
  );
}
