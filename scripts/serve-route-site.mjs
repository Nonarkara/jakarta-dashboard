#!/usr/bin/env node
/**
 * Serve the built route site the way the Worker serves it.
 *
 * The atlas ships as a Cloudflare Worker whose ASSETS binding holds `public/`.
 * The Worker rewrites the pathname before the asset lookup (src/index.ts):
 *
 *   /research      -> /research.html
 *   /atlas         -> /index.html
 *   / , /index.html-> /dashboard.html
 *
 * So a plain static serve of `public/` measures the wrong page at `/` and
 * 404s at `/atlas`. This server implements the same table.
 *
 * It exists so the spatial gate can measure the BUILD rather than the edge:
 * the gate's own `--dir` server is a plain static server, and it cannot serve
 * the atlas the way the Worker does.
 *
 * Usage: node scripts/serve-route-site.mjs [dir] [port]
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.resolve(process.argv[2] || path.join(ROOT, "out", "route-site"));
const PORT = Number(process.argv[3] || 0);

// The Worker's route table: URL pathname -> file in the build.
const ROUTES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/atlas", "atlas.html"],
  ["/atlas/", "atlas.html"],
  ["/atlas-open", "atlas-open.html"],
  ["/research", "research.html"],
  ["/research/", "research.html"],
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".zip": "application/zip",
  ".py": "text/plain; charset=utf-8",
  ".geojson": "application/geo+json",
};

if (!existsSync(path.join(DIR, "index.html"))) {
  console.error(`\nFAIL — no built site at ${DIR}. Run scripts/build-route-site.mjs first.\n`);
  process.exit(1);
}

const server = createServer((req, res) => {
  const raw = decodeURIComponent((req.url || "/").split("?")[0]);
  const url = path.posix.normalize(raw).replace(/\/+$/, "") || "/";
  if (url.includes("..")) {
    res.writeHead(400);
    return res.end("bad path");
  }
  const routed = ROUTES.get(url) || url.replace(/^\//, "");
  for (const c of [path.join(DIR, routed), path.join(DIR, routed + ".html")]) {
    try {
      if (existsSync(c) && statSync(c).isFile()) {
        res.writeHead(200, { "content-type": MIME[path.extname(c)] || "application/octet-stream" });
        return res.end(readFileSync(c));
      }
    } catch {
      /* try the next candidate */
    }
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  const { port } = server.address();
  console.log(`route site on http://127.0.0.1:${port}  (dir: ${DIR})`);
});
