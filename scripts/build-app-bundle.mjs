// After `vite build`: turns dist/ into the iPhone app's web bundle (docs/refactor/PLAN.md 4b).
//  - dist/app-bundle/latest.json: this deploy's version and every app file with its SHA-256 and its
//    public URL on kiriya.love. The app (src/lib/appUpdates.js → Capgo's updater) downloads only the
//    files it doesn't have yet, so an update is usually a few hundred KB.
//  - dist-app/ (skipped on Vercel): the same files for `npx cap sync ios` to build into the app, plus
//    ota-builtin-hashes.json so the updater doesn't have to hash them on the phone.
// Left out of the app: the website's service worker and install page, and the .woff fallbacks
// (WebKit reads the .woff2 next to each).
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const dist = path.join(root, "dist");
const out = path.join(root, "dist-app");
const site = (process.env.SITE_URL || "https://kiriya.love").replace(/\/+$/, "");

const EXCLUDE = [/^app-bundle\//, /^install\//, /^sw\.js$/, /^workbox-[\w-]+\.js$/, /^manifest\.webmanifest$/, /^app-version\.json$/, /\.woff$/, /\.map$/];

async function walk(dir, base = "") {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(path.join(dir, entry.name), relative)));
    else files.push(relative);
  }
  return files;
}

const { version } = JSON.parse(await readFile(path.join(dist, "app-version.json"), "utf8"));
const { minBuild } = JSON.parse(await readFile(path.join(root, "mobile/app-native.json"), "utf8"));
const files = (await walk(dist)).filter((file) => !EXCLUDE.some((pattern) => pattern.test(file))).sort();
if (!files.includes("index.html")) throw new Error("dist/index.html is missing: run vite build first");

const manifest = [];
const hashes = {};
let bytes = 0;
for (const file of files) {
  const data = await readFile(path.join(dist, file));
  const sha256 = createHash("sha256").update(data).digest("hex");
  bytes += data.length;
  hashes[file] = { sha256, size: data.length };
  manifest.push({ file_name: file, file_hash: sha256, download_url: `${site}/${file.split("/").map(encodeURIComponent).join("/")}` });
}

await mkdir(path.join(dist, "app-bundle"), { recursive: true });
await writeFile(path.join(dist, "app-bundle/latest.json"), JSON.stringify({ version, minBuild, builtAt: new Date().toISOString(), files: files.length, bytes, manifest }));

if (!process.env.VERCEL) {
  await rm(out, { recursive: true, force: true });
  for (const file of files) {
    await mkdir(path.dirname(path.join(out, file)), { recursive: true });
    await cp(path.join(dist, file), path.join(out, file));
  }
  await writeFile(path.join(out, "ota-builtin-hashes.json"), JSON.stringify({ files: hashes }));
}
const size = (await stat(path.join(dist, "app-bundle/latest.json"))).size;
console.log(`[app-bundle] ${version}: ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB${process.env.VERCEL ? "" : " → dist-app/"} (manifest ${(size / 1024).toFixed(0)} KB)`);
