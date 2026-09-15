import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env.js";
import * as schema from "./schema.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const migrationsFolder = path.join(here, "migrations");

// Production talks to Neon over HTTP. Development (no DATABASE_URL) uses PGlite, a real Postgres
// compiled to WASM that keeps its files in `.data/pglite`, so nothing needs installing or running.
async function connect() {
  if (env.databaseUrl) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return { db: drizzle({ client: neon(env.databaseUrl), schema }), driver: "neon" };
  }

  if (env.isProd) throw new Error("DATABASE_URL is required in production");

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { mkdir, rename, rm } = await import("node:fs/promises");
  const dataDir = path.resolve(here, "../../.data/pglite");
  await mkdir(path.dirname(dataDir), { recursive: true });

  const open = async () => {
    // A dev server killed mid-flight leaves a stale lock; only one dev server uses this folder.
    await rm(path.join(dataDir, "postmaster.pid"), { force: true });
    const client = new PGlite(dataDir);
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder });
    const close = () => client.close().catch(() => {});
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    return db;
  };

  try {
    return { db: await open(), driver: "pglite" };
  } catch (error) {
    // PGlite can't always recover files from a killed process. Development data is disposable:
    // set the broken copy aside and start fresh rather than leaving the dev server dead.
    const aside = `${dataDir}-broken-${Date.now()}`;
    console.warn(`[db] local database wouldn't open (${error.cause?.message ?? error.message}); moved it to ${aside} and started a fresh one.`);
    await rename(dataDir, aside).catch(() => {});
    return { db: await open(), driver: "pglite" };
  }
}

// One connection per process. The dev server reloads modules on change, so the handle lives on globalThis.
export function getDb() {
  globalThis.__kiriyaDb ??= connect().catch((error) => {
    // Don't cache a failed connection; the next request tries again.
    globalThis.__kiriyaDb = undefined;
    throw error;
  });
  return globalThis.__kiriyaDb.then((c) => c.db);
}

export { schema };
