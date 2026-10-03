"use client";
import { useId } from "react";
import { motion } from "motion/react";
import { motionTokens, springs } from "@/lib/motion-tokens";

/** Independent layers keep the approved illustration aligned through every blink. */
export function RobotIdleArtwork({
  blinking,
  still,
  resting = false,
  gaze = { x: 0, y: 0 },
}: {
  blinking: boolean;
  still: boolean;
  resting?: boolean;
  gaze?: { x: number; y: number };
}) {
  const id = useId().replace(/:/g, "");
  const timing = motionTokens.mascot;
  const look = resting ? { x: gaze.x * 0.35 + 8, y: gaze.y * 0.25 + 4 } : gaze;
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
        {resting && (
          <g className="robot-rest-cape" shapeRendering="crispEdges">
            <path
              fill="#244b40"
              d="M638 708H694V732H740V755H787V777H862V837H821V859H771V836H725V815H681V791H638Z"
            />
            <path
              fill="#3f8a6e"
              d="M651 723H689V749H736V772H782V791H841V821H783V806H739V791H695V768H651Z"
            />
            <path
              fill="#62aa88"
              d="M651 723H675V748H719V762H736V780H690V758H651Z"
            />
            <path
              fill="#2e6955"
              d="M699 775H724V799H769V819H816V842H789V831H744V812H699Z"
            />
          </g>
        )}
      </motion.g>
      {resting && (
        <motion.g
          className="robot-rest-coffee"
          initial={false}
          animate={
            still
              ? { y: 0, rotate: 0 }
              : {
                  y: [0, -timing.coffeeFloatPx, 0],
                  rotate: [0, -timing.coffeeSwayDegrees, 0],
                }
          }
          transition={{
            duration: timing.breatheSeconds,
            ease: "easeInOut",
            repeat: still ? 0 : Infinity,
          }}
          style={{ transformOrigin: "839px 779px" }}
          shapeRendering="crispEdges"
        >
          <motion.g
            className="robot-coffee-steam"
            initial={false}
            animate={
              still
                ? { y: 0, opacity: 0.6 }
                : { y: [0, -timing.steamRisePx, 0], opacity: [0.35, 0.8, 0.35] }
            }
            transition={{
              duration: timing.breatheSeconds,
              ease: "easeInOut",
              repeat: still ? 0 : Infinity,
            }}
          >
            <path
              fill="#a7cddd"
              d="M776 606H787V632H776V649H787V669H776V654H765V632H776ZM825 592H836V615H825V632H836V654H825V637H814V615H825Z"
            />
          </motion.g>
          <path
            fill="#283c45"
            d="M746 684H879V696H923V710H936V765H923V785H877V814H862V827H770V814H757V789H746Z"
          />
          <path
            fill="#b8d8e5"
            d="M760 699H865V800H851V812H784V800H772V777H760Z"
          />
          <path
            fill="#ecf1eb"
            d="M760 699H782V780H795V800H784V790H772V765H760ZM879 710H913V724H922V751H911V765H879V748H902V727H879Z"
          />
          <path fill="#668c98" d="M841 715H865V800H850V812H799V800H841Z" />
          <path fill="#795743" d="M768 698H855V710H768Z" />
          <path fill="#dec8a4" d="M774 698H849V703H774Z" />
        </motion.g>
      )}
      <motion.g
        className="robot-head-follow"
        initial={false}
        animate={
          still
            ? { x: 0, y: 0, rotate: 0, scaleY: 1 }
            : {
                x: look.x * timing.headFollowX,
                y: look.y * timing.headFollowY,
                rotate: look.x * timing.headFollowDegrees,
                scaleY: 1 - Math.abs(look.y) * timing.headPitchScale,
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
            transform={`translate(${look.x} ${look.y})`}
          >
            <motion.g
              className="robot-eyes"
              initial={false}
              animate={{ scaleY: blinking && !still ? 0.08 : 1 }}
              data-expression={resting ? "relaxed" : "awake"}
              transition={{ duration: timing.eyelidSeconds, ease: "easeInOut" }}
              style={{ transformOrigin: "597px 442px" }}
              fill={`url(#${id}-eyes)`}
            >
              {resting ? (
                <>
                  <path d="M478 436H490V422H516V436H530V451H516V440H490V451H478Z" />
                  <path d="M665 436H677V422H704V436H716V451H704V440H677V451H665Z" />
                </>
              ) : (
                <>
                  <path d="M490 394H516V409H529V473H516V489H490V473H479V409H490Z" />
                  <path d="M677 394H704V409H715V473H704V489H677V473H666V409H677Z" />
                </>
              )}
            </motion.g>
          </g>
        </motion.g>
      </motion.g>
    </svg>
  );
}
