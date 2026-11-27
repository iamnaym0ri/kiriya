// The events worker (Railway, always on). Every minute it runs one tick (worker/tick.js); a small
// HTTP server answers /health for Railway. Start: `node worker/index.js`.
// Configuration: see worker/config.js and docs/refactor/EVENTS-API.md "Running the worker".
import { createServer } from "node:http";
import { getDb } from "../server/db/client.js";
import { checkRegistry } from "../server/lib/events/registry.js";
import { describe, workerConfig } from "./config.js";
import { VERSION, tick } from "./tick.js";

const config = workerConfig();
const problems = checkRegistry();
if (problems.length) {
  console.error("[events-worker] registry problems:", problems);
  process.exit(1);
}

let last = null;
let running = false;
let stopping = false;

const log = (kind, data) => console.log(`[events-worker] ${kind}`, JSON.stringify(data));

async function once() {
  if (running || stopping) return;
  running = true;
  try {
    const db = await getDb();
    last = await tick(db, { config, log });
    log("tick", Object.fromEntries(Object.entries(last).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])));
  } catch (error) {
    // Never print connection strings or keys: just the kind of failure.
    console.error("[events-worker] tick failed:", error.name, String(error.message).slice(0, 200));
  } finally {
    running = false;
  }
}

const server = createServer((req, res) => {
  if (req.url === "/health") {
    const healthy = Boolean(last) && Date.now() - Date.parse(last.at) < Math.max(10 * 60_000, config.tickSeconds * 5000);
    res.writeHead(healthy || !last ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: healthy || !last, version: VERSION, lastTickAt: last?.at ?? null, ...describe() }));
    return;
  }
  res.writeHead(404).end();
});
server.listen(config.port, () => log("start", { version: VERSION, port: config.port, ...describe() }));

const timer = setInterval(once, config.tickSeconds * 1000);
once();

for (const sig of ["SIGTERM", "SIGINT"])
  process.on(sig, async () => {
    stopping = true;
    clearInterval(timer);
    server.close();
    const deadline = Date.now() + 25_000;
    while (running && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
    process.exit(0);
  });
