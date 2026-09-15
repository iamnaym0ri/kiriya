// Fails the build if anything private reached the files a visitor's browser can download.
// Private content must be served by /api/me/* after the passphrase, never bundled.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DIST = path.resolve("dist");

// Words that would reveal something personal if they appeared in the public build.
const FORBIDDEN = [
  /pansexual/i,
  /panromantic/i,
  /gender[\s-]?fluid/i,
  /non[\s-]?binary/i,
  /\bbinder\b/i,
  /transtape/i,
  /\bpronoun/i,
  // Anything exported from server/ carries this marker.
  /KIRIYA_SERVER_ONLY/,
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    }),
  );
  return files.flat();
}

const files = (await walk(DIST)).filter((file) => /\.(js|css|html|json|webmanifest|txt|map)$/.test(file));
const hits = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const pattern of FORBIDDEN) {
    const match = text.match(pattern);
    if (match) {
      const at = match.index;
      hits.push(`${path.relative(DIST, file)}: ${pattern} near "…${text.slice(Math.max(0, at - 40), at + 40)}…"`);
    }
  }
}

if (hits.length) {
  console.error(`\n✗ Private content found in the public build (${hits.length}):\n  ${hits.join("\n  ")}\n`);
  process.exit(1);
}
console.log(`✓ Leak check passed (${files.length} files scanned).`);
