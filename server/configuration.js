import { isPassphraseHash } from "./auth/passphrase.js";
import { blobUploadMode } from "./lib/blob.js";

// Reports variable names, never values. Optional music, AI, scheduling and push integrations
// are deliberately absent: the private world and uploads must work without them.
export function productionConfigurationIssues(config) {
  const issues = [];
  for (const [name, value] of [
    ["KIRIYA_PASSPHRASE_HASH", config.kiriyaPassphraseHash],
    ["ADMIN_PASSPHRASE_HASH", config.adminPassphraseHash],
  ]) {
    if (!isPassphraseHash(value))
      issues.push(`${name}: missing or invalid scrypt hash`);
  }
  if (
    config.kiriyaPassphraseHash &&
    config.kiriyaPassphraseHash === config.adminPassphraseHash
  ) {
    issues.push("The Kiriya and admin passphrase hashes must be separate");
  }
  if (
    typeof config.sessionSecret !== "string" ||
    config.sessionSecret.length < 32 ||
    config.sessionSecret.startsWith("dev-only-")
  ) {
    issues.push(
      "SESSION_SECRET: use a random secret of at least 32 characters",
    );
  }
  try {
    const url = new URL(config.databaseUrl);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      !url.password ||
      url.pathname.length < 2
    )
      throw new Error();
  } catch {
    issues.push(
      "DATABASE_URL / kData_DATABASE_URL: missing or invalid Postgres connection",
    );
  }
  try {
    const url = new URL(config.siteUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw new Error();
  } catch {
    issues.push("SITE_URL: use the site's HTTPS origin");
  }
  if (config.timeZone !== "Asia/Singapore")
    issues.push("KIRIYA_TZ: must be Asia/Singapore");
  if (!blobUploadMode(config)) {
    issues.push(
      "Blob: connect BLOB_STORE_ID and BLOB_WEBHOOK_PUBLIC_KEY, or set BLOB_READ_WRITE_TOKEN",
    );
  }
  return issues;
}
