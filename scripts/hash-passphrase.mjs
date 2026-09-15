// Prefer private files so neither the phrase nor its hash enters shell history or logs:
// npm run hash -- --file .data/phrase.txt --output .data/passphrase.hash
import { readFile, writeFile } from "node:fs/promises";
import { hashPassphrase } from "../server/auth/passphrase.js";

const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const outputIndex = args.indexOf("--output");
let input;
try {
  if (fileIndex >= 0) input = await readFile(args[fileIndex + 1], "utf8");
  else if (args.includes("--stdin")) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    input = Buffer.concat(chunks).toString("utf8");
  } else input = args.some((arg) => arg.startsWith("--")) ? "" : args.join(" ");
} catch {
  console.error("Could not read the private passphrase file.");
  process.exit(1);
}
if (!input.trim()) {
  console.error(
    "Usage: npm run hash -- --file .data/phrase.txt --output .data/passphrase.hash",
  );
  process.exit(1);
}

const hash = await hashPassphrase(input);
if (outputIndex >= 0) {
  try {
    await writeFile(args[outputIndex + 1], `${hash}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    console.log("✓ Saved the hash to the requested private file.");
  } catch {
    console.error(
      "Could not create the output file (existing files are preserved).",
    );
    process.exitCode = 1;
  }
} else {
  // Explicit CLI use may request a hash on stdout, but never echo the original phrase.
  console.log(hash);
}
