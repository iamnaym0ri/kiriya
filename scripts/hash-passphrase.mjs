// Usage: npm run hash -- "the passphrase"
// Prints the value to paste into KIRIYA_PASSPHRASE_HASH or ADMIN_PASSPHRASE_HASH on Vercel.
import { hashPassphrase, normalizePassphrase } from "../server/auth/passphrase.js";

const input = process.argv.slice(2).join(" ");
if (!input.trim()) {
  console.error('Usage: npm run hash -- "the passphrase"');
  process.exit(1);
}

console.log(`\nNormalised as: "${normalizePassphrase(input)}" (capitals and extra spaces don't matter)\n`);
console.log(await hashPassphrase(input));
console.log();
