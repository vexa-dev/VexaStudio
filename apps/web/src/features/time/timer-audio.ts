let audio: AudioContext | undefined;
let soundEnabled = false;
export function timerSoundEnabled() {
  return soundEnabled;
}
export function enableTimerSound(enabled: boolean) {
  soundEnabled = enabled;
  if (enabled) {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
  }
}
export function timerChime() {
  if (!soundEnabled || !audio || audio.state !== "running") return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.12, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.7);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.7);
}
