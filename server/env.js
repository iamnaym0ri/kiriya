// Server configuration. Everything secret comes from environment variables (Vercel project settings,
// or `.env.local` in development). Development gets safe stand-ins so the app runs with zero setup;
// production refuses to authenticate anyone if a required secret is missing.

// If a client bundle ever imports server code, this marker lands in it and the leak check fails the build.
globalThis.__kiriyaServerOnly = "KIRIYA_SERVER_ONLY";

const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

function optional(name, fallback = undefined) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export const env = {
  isProd,
  siteUrl: optional("SITE_URL", isProd ? "https://kiriya.love" : "http://localhost:5173"),
  timeZone: optional("KIRIYA_TZ", "Asia/Singapore"),

  // The existing kiriyaa integration uses the kData prefix. Keep explicit overrides first.
  databaseUrl: optional("DATABASE_URL", optional("kData_DATABASE_URL")),

  sessionSecret: optional("SESSION_SECRET", isProd ? undefined : "dev-only-session-secret-change-me-0123456789"),
  kiriyaPassphraseHash: optional("KIRIYA_PASSPHRASE_HASH"),
  adminPassphraseHash: optional("ADMIN_PASSPHRASE_HASH"),

  cronSecret: optional("CRON_SECRET"),
  qstashToken: optional("QSTASH_TOKEN"),
  qstashUrl: optional("QSTASH_URL"),
  qstashCurrentSigningKey: optional("QSTASH_CURRENT_SIGNING_KEY"),
  qstashNextSigningKey: optional("QSTASH_NEXT_SIGNING_KEY"),

  vapidPublicKey: optional("VAPID_PUBLIC_KEY", optional("VITE_VAPID_PUBLIC_KEY")),
  vapidPrivateKey: optional("VAPID_PRIVATE_KEY"),
  vapidSubject: optional("VAPID_SUBJECT"),

  blobToken: optional("BLOB_READ_WRITE_TOKEN"),
  blobStoreId: optional("BLOB_STORE_ID"),
  blobWebhookPublicKey: optional("BLOB_WEBHOOK_PUBLIC_KEY"),

  openaiApiKey: optional("OPENAI_API_KEY"),
  openaiModel: optional("OPENAI_MODEL", "gpt-5.4-mini-2026-03-17"),
};

export function requireEnv(key) {
  const value = env[key];
  if (!value) throw new Error(`Missing configuration: ${key}`);
  return value;
}
