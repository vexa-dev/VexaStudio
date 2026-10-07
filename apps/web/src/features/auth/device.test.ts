import { describe, expect, it } from "vitest";
import { describeDevice } from "./device";

const UA = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  safariIpad:
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

describe("describeDevice", () => {
  it.each([
    [UA.chromeMac, "Chrome en macOS"],
    [UA.safariMac, "Safari en macOS"],
    [UA.safariIphone, "Safari en iPhone"],
    [UA.chromeIphone, "Chrome en iPhone"],
    [UA.safariIpad, "Safari en iPad"],
    [UA.edgeWindows, "Edge en Windows"],
    [UA.firefoxLinux, "Firefox en Linux"],
    [UA.chromeAndroid, "Chrome en Android"],
  ])("describe %#", (userAgent, expected) => {
    expect(describeDevice(userAgent)).toBe(expected);
  });

  it("cae a un texto neutro cuando no reconoce nada", () => {
    expect(describeDevice(null)).toBe("Dispositivo desconocido");
    expect(describeDevice("")).toBe("Dispositivo desconocido");
    expect(describeDevice("curl/8.0")).toBe("Dispositivo desconocido");
  });

  it("muestra solo lo que reconoce", () => {
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) Foo/1")).toBe("Navegador en Windows");
    expect(describeDevice("Firefox/121.0")).toBe("Firefox");
  });
});
