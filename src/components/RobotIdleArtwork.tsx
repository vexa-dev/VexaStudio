"use client";
import { useId } from "react";
import { motion } from "motion/react";
import { motionTokens, springs } from "@/lib/motion-tokens";

/** Independent layers keep the approved illustration aligned through every blink. */
export function RobotIdleArtwork({
  blinking,
  still,
  gaze = { x: 0, y: 0 },
}: {
  blinking: boolean;
  still: boolean;
  gaze?: { x: number; y: number };
}) {
  const id = useId().replace(/:/g, "");
  const timing = motionTokens.mascot;
  return (
    <svg
      className="robot-idle-art"
      viewBox="150 140 800 1220"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`${id}-head`}>
          <path d="M0 0H1086V670H0Z" />
        </clipPath>
        <clipPath id={`${id}-cape`}>
          <path d="M0 675H1086V1448H0Z" />
        </clipPath>
        <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#25343c" />
          <stop offset=".55" stopColor="#2d3c44" />
          <stop offset="1" stopColor="#26353d" />
        </linearGradient>
        <linearGradient id={`${id}-eyes`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#a7cddd" />
          <stop offset="1" stopColor="#b8d8e5" />
        </linearGradient>
      </defs>
      <motion.g
        className="robot-cape"
        initial={false}
        animate={
          still
            ? { y: 0, rotate: 0 }
            : {
                y: [0, -timing.capeFloatPx, 0],
                rotate: [0, timing.capeSwayDegrees, 0],
              }
        }
        transition={{
          duration: timing.capeFloatSeconds,
          ease: "easeInOut",
          repeat: still ? 0 : Infinity,
        }}
        style={{ transformOrigin: "540px 710px" }}
      >
        <image
          href="/mascot/vexa-robot.png"
          width="1086"
          height="1448"
          clipPath={`url(#${id}-cape)`}
        />
      </motion.g>
      <motion.g
        className="robot-head-follow"
        initial={false}
        animate={
          still
            ? { x: 0, y: 0, rotate: 0, scaleY: 1 }
            : {
                x: gaze.x * timing.headFollowX,
                y: gaze.y * timing.headFollowY,
                rotate: gaze.x * timing.headFollowDegrees,
                scaleY: 1 - Math.abs(gaze.y) * timing.headPitchScale,
              }
        }
        transition={still ? { duration: 0 } : springs.gentle}
        style={{ transformOrigin: "540px 560px" }}
      >
        <motion.g
          className="robot-head"
          initial={false}
          animate={
            still
              ? { y: 0, rotate: 0 }
              : {
                  y: [0, -timing.headFloatPx, 0],
                  rotate: [0, -timing.headSwayDegrees, 0],
                }
          }
          transition={{
            duration: timing.headFloatSeconds,
            ease: "easeInOut",
            repeat: still ? 0 : Infinity,
          }}
          style={{ transformOrigin: "540px 420px" }}
        >
          <image
            href="/mascot/vexa-robot.png"
            width="1086"
            height="1448"
            clipPath={`url(#${id}-head)`}
          />
          <path
            fill={`url(#${id}-visor)`}
            d="M449 313H729V326H751V348H775V488H755V510H731V539H449V521H427V498H417V349H439V326H449Z"
          />
          <g
            className="robot-gaze"
            transform={`translate(${gaze.x} ${gaze.y})`}
          >
            <motion.g
              className="robot-eyes"
              initial={false}
              animate={{ scaleY: blinking && !still ? 0.08 : 1 }}
              transition={{ duration: timing.eyelidSeconds, ease: "easeInOut" }}
              style={{ transformOrigin: "597px 442px" }}
              fill={`url(#${id}-eyes)`}
            >
              <path d="M490 394H516V409H529V473H516V489H490V473H479V409H490Z" />
              <path d="M677 394H704V409H715V473H704V489H677V473H666V409H677Z" />
            </motion.g>
          </g>
        </motion.g>
      </motion.g>
    </svg>
  );
}
