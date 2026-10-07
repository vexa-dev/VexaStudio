"use client";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { NavLink } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import { BrandLogo } from "@/components/BrandLogo";
import { motionTokens, springs } from "@/lib/motion-tokens";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { navigationFor } from "./nav";
import { prefetchHandlers } from "./route-loaders";
import { useEffect, useRef } from "react";

const dropSizes = [
  [6, 8],
  [9, 12],
  [13, 16],
  [8, 11],
  [11, 14],
] as const;

function LiquidEdge({ reduced }: { reduced: boolean | null }) {
  const path = useRef<SVGPathElement>(null);
  const drops = useRef<SVGGElement>(null);
  useEffect(() => {
    if (reduced) {
      path.current?.setAttribute(
        "d",
        "M0 0H80C86 150 76 300 80 500S86 850 80 1000H0Z",
      );
      return;
    }
    let frame = 0;
    let last = 0;
    const random = (min: number, max: number) =>
      min + Math.random() * (max - min);
    const freshDrop = (start: number, index: number) => ({
      start,
      duration: random(
        motionTokens.liquid.durationMs.min,
        motionTokens.liquid.durationMs.max,
      ),
      y: random(70, 930),
      drift: random(-110, 110),
      reach: random(28, 42),
      radius: random(dropSizes[index][0], dropSizes[index][1]),
    });
    const particles = dropSizes.map((_, index) =>
      freshDrop(
        performance.now() + index * motionTokens.liquid.staggerMs,
        index,
      ),
    );
    const draw = (now: number) => {
      if (!document.hidden && now - last > 32 && path.current) {
        last = now;
        const time = now / motionTokens.liquid.waveMs;
        const edge = (y: number) =>
          80 +
          Math.sin(y / 170 + time) * 3.5 +
          Math.sin(y / 95 - time * 0.7) * 1.5;
        let shape = `M 0 0 H ${edge(0)}`;
        for (let y = 0; y < 1000; y += 50) {
          shape += ` C ${edge(y)} ${y + 17}, ${edge(y + 50)} ${y + 33}, ${edge(y + 50)} ${y + 50}`;
        }
        path.current.setAttribute("d", `${shape} H 0 Z`);
        Array.from(drops.current?.children ?? []).forEach((drop, index) => {
          let particle = particles[index];
          if (now >= particle.start + particle.duration) {
            particle = freshDrop(
              now +
                random(
                  motionTokens.liquid.pauseMs.min,
                  motionTokens.liquid.pauseMs.max,
                ),
              index,
            );
            particles[index] = particle;
          }
          const phase = Math.max(0, (now - particle.start) / particle.duration);
          const travel = Math.max(0, (phase - 0.14) / 0.86);
          const radius = particle.radius * (1 - travel * 0.55);
          drop.setAttribute(
            "cx",
            String(edge(particle.y) - 4 + travel * particle.reach),
          );
          drop.setAttribute("cy", String(particle.y + travel * particle.drift));
          drop.setAttribute("rx", String(radius));
          drop.setAttribute("ry", String(radius * (1.2 - travel * 0.2)));
          drop.setAttribute(
            "opacity",
            String(
              now < particle.start ? 0 : phase > 0.65 ? (1 - phase) / 0.35 : 1,
            ),
          );
        });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [reduced]);
  return (
    <svg
      className="lava-surface"
      viewBox="0 0 150 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter
          id="steel-goo"
          x="-20%"
          y="-10%"
          width="160%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
          />
        </filter>
        <linearGradient
          id="steel-liquid"
          gradientUnits="userSpaceOnUse"
          x1="0"
          x2="80"
          y1="0"
          y2="0"
        >
          <stop stopColor="var(--nav-base)" />
          <stop offset=".55" stopColor="var(--nav-body)" />
          <stop offset=".85" stopColor="var(--nav-depth)" />
          <stop offset="1" stopColor="var(--nav-depth)" />
        </linearGradient>
      </defs>
      <g filter="url(#steel-goo)" fill="url(#steel-liquid)">
        <path ref={path} d="M0 0H80C86 150 76 300 80 500S86 850 80 1000H0Z" />
        <g
          ref={drops}
          className="liquid-metaballs"
          style={{ display: reduced ? "none" : undefined }}
        >
          {dropSizes.map((_, index) => (
            <ellipse
              key={index}
              cx="76"
              cy={100 + index * 180}
              rx="5"
              ry="6"
              opacity="0"
            />
          ))}
        </g>
      </g>
    </svg>
  );
}

export function LavaNav() {
  const { user } = useAuth();
  const reduced = useReducedMotion();
  return (
    <aside className="lava-nav" aria-label="Navegación del estudio">
      <div className="lava-vessel" aria-hidden="true">
        <LiquidEdge reduced={reduced} />
      </div>
      <NavLink to="/" className="lava-brand" aria-label="VEXA Studio, inicio">
        <BrandLogo className="size-10" decorative />
      </NavLink>
      <nav aria-label="Principal" className="lava-links">
        {navigationFor(user?.role).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            {...prefetchHandlers(to)}
            className="lava-link"
            aria-label={label}
          >
            {({ isActive }) => (
              <>
                {isActive &&
                  (reduced ? (
                    <span className="lava-selection" />
                  ) : (
                    <motion.span
                      className="lava-selection"
                      layoutId="lava-selection"
                      transition={springs.snappy}
                    />
                  ))}
                <Icon size={21} aria-hidden="true" />
                <span className="lava-tooltip">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <nav className="lava-utilities" aria-label="Más opciones">
        <NavLink
          to="/perfil"
          {...prefetchHandlers("/perfil")}
          className="lava-link lava-link--photo"
          aria-label="Mi perfil"
        >
          <Avatar name={user?.name ?? ""} src={user?.avatarUrl} size="sm" />
          <span className="lava-tooltip">Mi perfil</span>
        </NavLink>
      </nav>
    </aside>
  );
}
