// Serves apps/web/dist applying the headers and SPA rewrites declared in vercel.json,
// so the CSP can be checked against the real build: npm run preview:headers [port]
import { readFileSync, existsSync, statSync, createReadStream } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const config = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const dist = resolve(root, config.outputDirectory ?? "apps/web/dist");
const port = Number(process.argv[2] ?? 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

// Minimal matcher: "/(.*)" matches everything, "/assets/(.*)" a prefix, anything else an exact path.
function matches(source, pathname) {
  if (source.endsWith("(.*)")) return pathname.startsWith(source.slice(0, -4));
  return source === pathname;
}

function headersFor(pathname) {
  const result = {};
  for (const rule of config.headers ?? []) {
    if (!matches(rule.source, pathname)) continue;
    for (const { key, value } of rule.headers) result[key] = value; // later rules win
  }
  return result;
}

function resolveFile(pathname) {
  const target = normalize(join(dist, pathname));
  if (target !== dist && !target.startsWith(dist + sep)) return null; // path traversal
  if (existsSync(target) && statSync(target).isFile()) return target;
  return undefined;
}

createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(req.url ?? "/", "http://localhost").pathname,
    );
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }
  if (pathname.includes("\0")) {
    res.writeHead(400).end("Bad request");
    return;
  }
  let file = resolveFile(pathname === "/" ? "/index.html" : pathname);
  if (file === null) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (file === undefined) {
    const rewrite = (config.rewrites ?? []).find((r) =>
      matches(r.source, pathname),
    );
    if (!rewrite) {
      res.writeHead(404).end("Not found");
      return;
    }
    file = resolveFile(rewrite.destination);
  }
  if (!file) {
    res.writeHead(404).end("Not found");
    return;
  }
  const headers = headersFor(pathname);
  res.writeHead(200, {
    ...headers,
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
  });
  if (req.method === "HEAD") res.end();
  else createReadStream(file).pipe(res);
}).listen(port, () =>
  console.log(
    `Preview con cabeceras de vercel.json en http://localhost:${port}`,
  ),
);
