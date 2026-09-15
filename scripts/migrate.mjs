// Applies database migrations. On Vercel this runs before every build (see vercel.json);
// locally, PGlite migrates itself on first use, so this is only needed against a real DATABASE_URL.
import { migrationsFolder } from "../server/db/client.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("No DATABASE_URL: skipping migrations (development uses PGlite, which migrates on start).");
  process.exit(0);
}

const { neon } = await import("@neondatabase/serverless");
const { drizzle } = await import("drizzle-orm/neon-http");
const { migrate } = await import("drizzle-orm/neon-http/migrator");

await migrate(drizzle({ client: neon(url) }), { migrationsFolder });
console.log("✓ Migrations applied.");
