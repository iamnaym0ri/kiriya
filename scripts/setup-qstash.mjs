// One-time: creates the QStash schedule that runs the daily job at 00:10 Singapore time.
// Usage (with the production values in your shell or .env.production.local):
//   QSTASH_TOKEN=... SITE_URL=https://iloveukiriya.com node scripts/setup-qstash.mjs
import { Client } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN;
const siteUrl = process.env.SITE_URL ?? "https://iloveukiriya.com";
if (!token) {
  console.error("QSTASH_TOKEN is missing. Copy it from the Upstash console (QStash → Request builder).");
  process.exit(1);
}

const client = new Client({ token, ...(process.env.QSTASH_URL ? { baseUrl: process.env.QSTASH_URL } : {}) });
const destination = new URL("/api/jobs/daily", siteUrl).toString();
const cron = "CRON_TZ=Asia/Singapore 10 0 * * *";

const existing = (await client.schedules.list()).filter((s) => s.destination === destination);
if (existing.length) {
  console.log(`A schedule for ${destination} already exists (${existing.map((s) => `${s.scheduleId}: ${s.cron}`).join(", ")}). Nothing to do.`);
  process.exit(0);
}

const { scheduleId } = await client.schedules.create({ destination, cron, retries: 3, body: "{}", headers: { "Content-Type": "application/json" } });
console.log(`✓ Created schedule ${scheduleId}: ${cron} → ${destination}`);
