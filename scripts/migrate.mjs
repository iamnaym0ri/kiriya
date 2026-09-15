// Applies database migrations. On Vercel this runs before every build (see vercel.json);
// locally, PGlite migrates itself on first use, so this is only needed against a real DATABASE_URL.
import { migrationsFolder } from "../server/db/client.js";
import { env } from "../server/env.js";

const url = env.databaseUrl;
if (!url) {
  if (env.isProd) {
    console.error(
      "Database connection missing: set DATABASE_URL or connect kiriyaa with kData_DATABASE_URL.",
    );
    process.exit(1);
  }
  console.log(
    "No production database configured; development uses PGlite, which migrates on start.",
  );
  process.exit(0);
}

const { neon } = await import("@neondatabase/serverless");
const { drizzle } = await import("drizzle-orm/neon-http");
const { migrate } = await import("drizzle-orm/neon-http/migrator");

try {
  await migrate(drizzle({ client: neon(url) }), { migrationsFolder });
  console.log("✓ Migrations applied.");
} catch {
  // Provider errors may include connection strings or query values. Keep build logs secret-free.
  console.error(
    "Database migration failed. Check the Neon connection and migration state before retrying.",
  );
  process.exitCode = 1;
}
