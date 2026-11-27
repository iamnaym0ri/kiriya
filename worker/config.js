// The events worker's configuration, all from the environment (Railway service variables).
// Nothing here is secret in itself; `describe()` reports which keys are present, never their values.

const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : fallback);

export function workerConfig(env = process.env) {
  return {
    // No ANTHROPIC_API_KEY, or EVENTS_DRY_RUN=1: Claude is replaced by a stand-in, nothing is billed,
    // and pushes are only logged.
    dryRun: env.EVENTS_DRY_RUN === "1" || !env.ANTHROPIC_API_KEY,
    tickSeconds: num(env.EVENTS_TICK_SECONDS, 60),
    sourcesPerTick: num(env.EVENTS_SOURCES_PER_TICK, 6),
    signalsPerTick: num(env.EVENTS_SIGNALS_PER_TICK, 3),
    weatherEveryMinutes: num(env.EVENTS_WEATHER_EVERY_MINUTES, 180),
    deliverEveryMinutes: num(env.EVENTS_DELIVER_EVERY_MINUTES, 10),
    // Where the API lives, for push delivery (push keys stay in Vercel).
    apiOrigin: (env.EVENTS_API_ORIGIN || "https://kiriya.love").replace(/\/$/, ""),
    cronSecret: env.CRON_SECRET || null,
    port: num(env.PORT, 8080),
  };
}

export function describe(env = process.env) {
  const c = workerConfig(env);
  return {
    dryRun: c.dryRun,
    tickSeconds: c.tickSeconds,
    keys: {
      anthropic: Boolean(env.ANTHROPIC_API_KEY),
      database: Boolean(env.DATABASE_URL || env.kData_DATABASE_URL),
      apify: Boolean(env.APIFY_TOKEN),
      gmail: Boolean(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN),
      lta: Boolean(env.LTA_DATAMALL_KEY),
      dataGov: Boolean(env.DATA_GOV_SG_API_KEY),
      blob: Boolean(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID),
      cronSecret: Boolean(env.CRON_SECRET),
    },
    pushAudience: ["admin", "kiriya", "both"].includes(env.EVENTS_PUSH_AUDIENCE) ? env.EVENTS_PUSH_AUDIENCE : "admin",
  };
}
