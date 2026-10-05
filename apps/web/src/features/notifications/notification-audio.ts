let context: AudioContext | undefined;

/** Se llama tras una interacción para desbloquear audio en el navegador. */
export async function prepareNotificationSound() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") await context.resume();
  } catch {
    /* La campana y el punto funcionan aunque el navegador bloquee audio. */
  }
}

export function notificationChime(tone: "soft" | "bell" = "bell") {
  if (!context || context.state !== "running") return;
  const notes =
    tone === "soft"
      ? [
          [0, 440],
          [0.1, 554],
        ]
      : [
          [0, 784],
          [0.12, 1046],
        ];
  for (const [delay, frequency] of notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      tone === "soft" ? 0.04 : 0.09,
      start + 0.015,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + 0.26);
  }
}
