/** Static line drawing behind the translucent workspace surfaces. */
export function BackgroundLines() {
  return (
    <div className="background-lines" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M860 -80C920 110 1250 20 1290 220S1150 440 1530 480" />
          <path d="M910 -90C970 85 1300 0 1340 210S1200 450 1570 490" />
          <path d="M960 -100C1020 60 1350 -20 1390 200S1250 460 1610 500" />
          <path d="M-100 540L210 360L510 540L510 880M-100 585L210 405L470 560L470 920" />
          <path d="M740 980C700 730 960 800 1040 660S1250 540 1480 700" />
          <path d="M785 990C745 760 980 835 1080 690S1270 580 1500 740" />
          <circle cx="210" cy="360" r="5" />
          <circle cx="1040" cy="660" r="5" />
        </g>
      </svg>
    </div>
  );
}
