// Renders the site's jar (site-jar.html) to PNG stills, pausing the CSS animations at exact times.
// Run from the repo root:
//   PATH=~/.cache/rora-audit-toolchain/node-v22.23.3-darwin-x64/bin:$PATH node ios/CardLab/Jar/reference/capture-site-jar.mjs <outdir>
import { webkit } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const out = process.argv[2] ?? "/tmp/jar-reference";
mkdirSync(out, { recursive: true });
const html = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "site-jar.html")).href;
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 3 });

async function shot(query, name, atMs = 0) {
  await page.goto(`${html}?${query}`);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((t) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; } }, atMs);
  await page.locator("#stage").screenshot({ path: path.join(out, `${name}.png`) });
}

await shot("fresh=0", "site-idle");
await shot("fresh=1", "site-fresh1");
await shot("fresh=3", "site-fresh3");
for (const t of [3375, 3600, 3825, 4050]) await shot("fresh=3", `site-wiggle-${t}`, t);
for (let t = 0; t <= 800; t += 50) await shot("fresh=0&drawing=1", `site-pull-${String(t).padStart(3, "0")}`, t);
await shot("fresh=0&paper=1", "site-paper", 550);
await browser.close();
console.log("wrote", out);
