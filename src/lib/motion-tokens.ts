export const motionTokens = {
  duration: { instant: 0.08, fast: 0.18, normal: 0.35, slow: 0.6 },
  easing: { smooth: [0.22, 1, 0.36, 1] as const },
  distance: { sm: 8, md: 16, lg: 24 },
  scale: { press: 0.97, pop: 1.015 },
  tilt: { maxDegrees: 0.65 },
  liquid: {
    waveMs: 800,
    durationMs: { min: 1800, max: 3000 },
    pauseMs: { min: 1000, max: 2400 },
    staggerMs: 1100,
  },
};
export const springs = {
  snappy: { type: "spring" as const, stiffness: 300, damping: 30 },
  gentle: { type: "spring" as const, stiffness: 120, damping: 22 },
};
export function shouldAnimate(essential = false) {
  return (
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    (essential || typeof navigator === "undefined" || navigator.hardwareConcurrency > 4)
  );
}
