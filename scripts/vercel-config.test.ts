import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Rule = { source: string; headers: { key: string; value: string }[] };
const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
) as {
  rewrites: { source: string; destination: string }[];
  headers: Rule[];
};

function header(source: string, key: string): string | undefined {
  return config.headers
    .find((rule) => rule.source === source)
    ?.headers.find((h) => h.key === key)?.value;
}

function directive(csp: string, name: string): string {
  const part = csp
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name} `));
  return part ?? "";
}

describe("vercel.json", () => {
  const csp = header("/(.*)", "Content-Security-Policy") ?? "";

  it("defines a strict CSP", () => {
    expect(csp).not.toBe("");
    expect(csp).not.toContain("unsafe-eval");
    expect(directive(csp, "script-src")).toBe("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    const connect = directive(csp, "connect-src");
    expect(connect).toContain("https://*.supabase.co");
    expect(connect).toContain("wss://*.supabase.co");
  });

  it("sends the other security headers on every route", () => {
    expect(header("/(.*)", "X-Content-Type-Options")).toBe("nosniff");
    expect(header("/(.*)", "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(header("/(.*)", "X-Frame-Options")).toBe("DENY");
    expect(header("/(.*)", "Permissions-Policy")).toContain("camera=()");
    expect(header("/(.*)", "Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("revalidates the shell and the service worker, and keeps assets immutable", () => {
    expect(header("/sw.js", "Cache-Control")).toContain("no-cache");
    expect(header("/index.html", "Cache-Control")).toContain("no-cache");
    expect(header("/manifest.webmanifest", "Cache-Control")).toContain(
      "no-cache",
    );
    expect(header("/assets/(.*)", "Cache-Control")).toContain("immutable");
  });

  it("keeps the SPA rewrite", () => {
    expect(config.rewrites).toContainEqual({
      source: "/(.*)",
      destination: "/index.html",
    });
  });
});
