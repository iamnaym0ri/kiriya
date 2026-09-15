// One-time local setup: writes .env.local with a session secret and web-push (VAPID) keys.
// Development passphrases are "kiriya" and "admin" unless you set hashes yourself.
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import webpush from "web-push";

const file = ".env.local";
if (existsSync(file)) {
  console.log(`${file} already exists; leaving it alone.`);
  process.exit(0);
}

const vapid = webpush.generateVAPIDKeys();
const lines = [
  "# Local development only. Never commit this file.",
  `SESSION_SECRET=${randomBytes(32).toString("base64url")}`,
  `CRON_SECRET=${randomBytes(24).toString("base64url")}`,
  `VITE_VAPID_PUBLIC_KEY=${vapid.publicKey}`,
  `VAPID_PUBLIC_KEY=${vapid.publicKey}`,
  `VAPID_PRIVATE_KEY=${vapid.privateKey}`,
  "VAPID_SUBJECT=mailto:you@example.com",
  "# OPENAI_API_KEY=",
  "# VITE_TEXTALIVE_TOKEN=",
  "",
];
await writeFile(file, lines.join("\n"));
console.log(`✓ Wrote ${file}. Dev passphrases: "kiriya" (Kiriya) and "admin" (you).`);
