import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../server/db/schema.js";
import {
  hashPassphrase,
  isPassphraseHash,
  verifyPassphrase,
} from "../server/auth/passphrase.js";

// Never load .env files or use a real database/provider. These requests run through the actual
// production API adapter with an isolated in-memory database and blocked external networking.
for (const name of [
  "DATABASE_URL",
  "kData_DATABASE_URL",
  "BLOB_READ_WRITE_TOKEN",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "VAPID_PUBLIC_KEY",
  "VITE_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "CRON_SECRET",
  "OPENAI_API_KEY",
])
  process.env[name] = "";
const phrases = {
  kiriya: randomBytes(24).toString("hex"),
  admin: randomBytes(24).toString("hex"),
};
process.env.NODE_ENV = "production";
process.env.VERCEL_ENV = "production";
process.env.SITE_URL = "https://kiriya.love";
process.env.KIRIYA_TZ = "Asia/Singapore";
process.env.SESSION_SECRET = randomBytes(32).toString("base64url");
process.env.KIRIYA_PASSPHRASE_HASH = await hashPassphrase(phrases.kiriya);
process.env.ADMIN_PASSPHRASE_HASH = await hashPassphrase(phrases.admin);
process.env.BLOB_STORE_ID = "store_localcheck";
process.env.BLOB_WEBHOOK_PUBLIC_KEY = randomBytes(32).toString("base64url");
process.env.VERCEL_BLOB_RETRIES = "0";
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
process.env.VERCEL_OIDC_TOKEN = `${encode({ alg: "none" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
const sdkRequire = createRequire(import.meta.resolve("@vercel/blob"));
const { MockAgent, getGlobalDispatcher, setGlobalDispatcher } =
  sdkRequire("undici");
const originalDispatcher = getGlobalDispatcher();
const mockNetwork = new MockAgent();
mockNetwork.disableNetConnect();
setGlobalDispatcher(mockNetwork);
const originalFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error(
    "External network is disabled in production regression tests",
  );
};

const client = new PGlite();
const db = drizzle({ client, schema });
await migrate(db, {
  migrationsFolder: new URL("../server/db/migrations", import.meta.url)
    .pathname,
});
globalThis.__kiriyaDb = Promise.resolve({ db, driver: "pglite" });
const { env } = await import("../server/env.js");
const { productionConfigurationIssues } = await import(
  "../server/configuration.js"
);
const { GET, POST, HEAD } = await import("../api/index.js");
const { default: app } = await import("../server/app.js");
app.onError((error) => {
  throw error;
});

function request(route, { method = "GET", cookie, body, headers = {} } = {}) {
  const original = new URL(`/api/${route}`, "https://kiriya.love");
  const rewritten = new URL("/api", original);
  rewritten.search = original.search;
  rewritten.searchParams.set("__route", original.pathname.slice(5));
  return (method === "HEAD" ? HEAD : method === "GET" ? GET : POST)(
    new Request(rewritten, {
      method,
      headers: {
        "x-kw": "1",
        ...(cookie ? { cookie } : {}),
        ...headers,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function unlock(role) {
  const response = await request("session/unlock", {
    method: "POST",
    body: { passphrase: phrases[role] },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).role, role);
  const header = response.headers.get("set-cookie");
  assert.match(header, /HttpOnly/i);
  assert.match(header, /Secure/i);
  assert.match(header, /SameSite=Lax/i);
  return header.split(";")[0];
}

await test("Production configuration uses the existing Neon prefix and excludes optional services", () => {
  const config = {
    ...env,
    databaseUrl: "postgresql://test:test@example.invalid/neondb",
  };
  assert.deepEqual(productionConfigurationIssues(config), []);
  const invalid = productionConfigurationIssues({
    ...config,
    adminPassphraseHash: "",
    sessionSecret: "",
    databaseUrl: undefined,
  });
  assert(invalid.some((issue) => issue.startsWith("ADMIN_PASSPHRASE_HASH:")));
  assert(invalid.some((issue) => issue.startsWith("SESSION_SECRET:")));
  assert(invalid.some((issue) => issue.startsWith("DATABASE_URL")));
  assert(!invalid.join(" ").includes(config.kiriyaPassphraseHash));
  const probe = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const {env}=await import('./server/env.js'); console.log(JSON.stringify({prefix:env.databaseUrl===process.env.kData_DATABASE_URL}));",
    ],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "production",
        DATABASE_URL: "",
        kData_DATABASE_URL: config.databaseUrl,
      },
    },
  );
  assert.equal(probe.status, 0);
  assert.equal(JSON.parse(probe.stdout).prefix, true);
  const migration = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, NODE_ENV: "production" },
  });
  assert.equal(migration.status, 1);
  assert.match(migration.stderr, /Database connection missing/);
});

await test("Secure production login, admin separation, expired/changed sessions and rewrite routing", async () => {
  assert.equal((await request("health")).status, 200);
  assert.equal((await request("health", { method: "HEAD" })).status, 200);
  assert.equal((await request("admin/status")).status, 401);
  const kiriya = await unlock("kiriya");
  const admin = await unlock("admin");
  assert.equal((await request("admin/status", { cookie: kiriya })).status, 401);
  const status = await request("admin/status", { cookie: admin });
  assert.equal(status.status, 200);
  const services = (await status.json()).services;
  assert.equal(services.fileStorage, true);
  assert.equal(services.push, false);
  assert.equal(services.scheduler, false);
  assert.equal(
    (await request("me/curation?kind=maomao", { cookie: kiriya })).status,
    200,
  );
  const config = await request("uploads/config", { cookie: kiriya });
  assert.deepEqual(await config.json(), {
    mode: "blob",
    uploadType: "presigned",
    maxBytes: 15 * 1024 * 1024,
    allowed: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "audio/mpeg",
      "audio/mp4",
      "audio/x-m4a",
      "audio/aac",
      "audio/wav",
    ],
  });
  assert.equal(
    (
      await request("uploads/local", {
        method: "POST",
        cookie: kiriya,
        body: {},
      })
    ).status,
    404,
  );
  const previous = env.sessionSecret;
  const [, payload] = admin.slice(3).split(".");
  const expired = encode({
    ...JSON.parse(Buffer.from(payload, "base64url")),
    exp: 1,
  });
  const signature = createHmac("sha256", previous)
    .update(expired)
    .digest("base64url");
  assert.equal(
    (await request("admin/status", { cookie: `kw=v1.${expired}.${signature}` }))
      .status,
    401,
  );
  env.sessionSecret = randomBytes(32).toString("base64url");
  assert.equal((await request("admin/status", { cookie: admin })).status, 401);
  env.sessionSecret = previous;
  assert.equal(
    (await request("session/lock", { method: "POST", cookie: kiriya })).status,
    200,
  );
});

await test("Malformed Kiriya hash cannot crash or block a valid admin login", async () => {
  const previous = env.kiriyaPassphraseHash;
  for (const broken of [
    "not-a-hash",
    "scrypt$999$8$1$x$x",
    "scrypt$15$8$1$$",
    `${previous}$extra`,
  ]) {
    assert.equal(isPassphraseHash(broken), false);
    assert.equal(await verifyPassphrase(phrases.kiriya, broken), false);
  }
  env.kiriyaPassphraseHash = "scrypt$999$8$1$x$x";
  await unlock("admin");
  env.kiriyaPassphraseHash = previous;
  const secret = env.sessionSecret;
  env.sessionSecret = undefined;
  assert.equal(
    (
      await request("session/unlock", {
        method: "POST",
        body: { passphrase: phrases.kiriya },
      })
    ).status,
    503,
  );
  env.sessionSecret = secret;
});

await test("OIDC uploads require a session and issue a bounded, single-file upload grant", async () => {
  const body = {
    type: "blob.generate-presigned-url",
    payload: {
      pathname: "art/local-check.png",
      multipart: false,
      clientPayload: null,
    },
  };
  assert.equal(
    (await request("uploads/blob", { method: "POST", body })).status,
    401,
  );
  const cookie = await unlock("kiriya");
  assert.equal(
    (
      await request("uploads/blob", {
        method: "POST",
        cookie,
        body: {
          ...body,
          payload: { ...body.payload, pathname: "art/../../private.png" },
        },
      })
    ).status,
    400,
  );
  let constraints;
  mockNetwork
    .get("https://vercel.com")
    .intercept({ path: "/api/blob/signed-token", method: "POST" })
    .reply((options) => {
      constraints = JSON.parse(options.body);
      return {
        statusCode: 200,
        data: JSON.stringify({
          delegationToken: `${encode({ ...constraints, storeId: "localcheck" })}.test`,
          clientSigningToken: randomBytes(32).toString("base64url"),
          validUntil: constraints.validUntil,
        }),
        responseOptions: { headers: { "content-type": "application/json" } },
      };
    });
  const response = await request("uploads/blob", {
    method: "POST",
    cookie,
    body,
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.type, "blob.generate-presigned-url");
  assert(result.presignedUrlPayload);
  assert.deepEqual(constraints.operations, ["put"]);
  assert.equal(constraints.pathname, "art/local-check.png");
  assert.equal(constraints.maximumSizeInBytes, 15 * 1024 * 1024);
  assert(constraints.allowedContentTypes.includes("image/png"));
  assert(constraints.validUntil <= Date.now() + 10 * 60 * 1000);
  assert(!JSON.stringify(result).includes(env.sessionSecret));
  assert(!JSON.stringify(result).includes(process.env.VERCEL_OIDC_TOKEN));
  const callback = await request("uploads/blob", {
    method: "POST",
    body: { type: "blob.upload-completed", payload: {} },
  });
  assert.equal(callback.status, 400);
  mockNetwork.assertNoPendingInterceptors();
});

await test("Private Blob delivery checks sessions, explicit public selection, ranges and HEAD", async () => {
  const cookie = await unlock("kiriya");
  const route = "uploads/media?path=art%2Fprivate-check.png";
  assert.equal((await request(route)).status, 401);
  const bytes = Buffer.from("private image bytes");
  let reads = 0;
  mockNetwork
    .get("https://localcheck.private.blob.vercel-storage.com")
    .intercept({ path: "/art/private-check.png", method: "GET" })
    .reply((options) => {
      const headers = new Headers(options.headers);
      assert(headers.get("authorization").startsWith("Bearer "));
      reads++;
      const range = headers.get("range");
      return {
        statusCode: range ? 206 : 200,
        data: range ? bytes.subarray(0, 4) : bytes,
        responseOptions: {
          headers: {
            "content-type": "image/png",
            "content-length": String(range ? 4 : bytes.length),
            ...(range ? { "content-range": `bytes 0-3/${bytes.length}` } : {}),
          },
        },
      };
    })
    .persist();
  try {
    const image = await request(route, { cookie });
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("cache-control"), "private, no-store");
    assert.equal(image.headers.get("x-content-type-options"), "nosniff");
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.equal(await image.text(), bytes.toString());
    const range = await request(route, {
      cookie,
      headers: { range: "bytes=0-3" },
    });
    assert.equal(range.status, 206);
    assert.equal(
      range.headers.get("content-range"),
      `bytes 0-3/${bytes.length}`,
    );
    assert.equal((await range.arrayBuffer()).byteLength, 4);
    assert.equal(
      (await request(route, { cookie, headers: { range: "bytes=0-1,3-4" } }))
        .status,
      416,
    );
    assert.equal(
      (await request(route, { method: "HEAD", cookie })).status,
      200,
    );
    const before = reads;
    assert.equal((await request(route)).status, 401);
    assert.equal(reads, before);
    await db
      .insert(schema.settings)
      .values({ key: "public_profile", value: { avatarUrl: `/api/${route}` } });
    assert.equal((await request(route)).status, 200);
    await db
      .delete(schema.settings)
      .where(eq(schema.settings.key, "public_profile"));
    assert.equal((await request(route)).status, 401);
  } finally {
    globalThis.fetch = () => {
      throw new Error("External network is disabled");
    };
  }
});

await test("Hash utility keeps phrases and hashes out of logs when private files are requested", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kiriya-hash-check-"));
  try {
    const phraseFile = path.join(dir, "phrase.txt");
    const hashFile = path.join(dir, "phrase.hash");
    await writeFile(phraseFile, phrases.kiriya, { mode: 0o600 });
    const result = spawnSync(
      process.execPath,
      [
        "scripts/hash-passphrase.mjs",
        "--file",
        phraseFile,
        "--output",
        hashFile,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0);
    const hash = (await readFile(hashFile, "utf8")).trim();
    assert.equal(await verifyPassphrase(phrases.kiriya, hash), true);
    assert(!result.stdout.includes(phrases.kiriya));
    assert(!result.stdout.includes(hash));
    assert.equal((await stat(hashFile)).mode & 0o777, 0o600);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

globalThis.fetch = originalFetch;
setGlobalDispatcher(originalDispatcher);
await mockNetwork.close();
await client.close();
