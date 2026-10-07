const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/FxiOS\/|Firefox\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

// iPhone and iPad user agents also say "like Mac OS X", so they go first.
const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Macintosh|Mac OS X/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux|X11/, "Linux"],
];

const match = (table: [RegExp, string][], text: string) =>
  table.find(([pattern]) => pattern.test(text))?.[1];

/** `Chrome en macOS`, `Safari en iPhone`: a short label from a user agent, without a library. */
export function describeDevice(userAgent: string | null | undefined): string {
  const text = userAgent ?? "";
  const browser = match(BROWSERS, text);
  const system = match(SYSTEMS, text);
  if (browser && system) return `${browser} en ${system}`;
  if (browser) return browser;
  if (system) return `Navegador en ${system}`;
  return "Dispositivo desconocido";
}
