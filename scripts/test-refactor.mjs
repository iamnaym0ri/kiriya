// Connection refactor (docs/refactor/PLAN.md), phase 1: the retired sections stay retired.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

delete process.env.FEED_RETIRED_SECTIONS;
process.env.QSTASH_TOKEN = "";
const { retiredSections, activeSections } = await import("../server/feeds/config.js");
const { sourceRegistry } = await import("../server/feeds/sources/registry.js");
const { composeDay } = await import("../server/engine/compose.js");
const { birthdayInfo } = await import("../server/lib/birthday.js");
const { isApprovedPush } = await import("../server/content/collection.js");

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Memes, Maomao club, music and dress-up are retired by default; merch stays active", () => {
  assert.deepEqual(retiredSections(), ["maomao", "music", "dressup", "meme"]);
  assert.deepEqual(activeSections(), ["merch"]);
  process.env.FEED_RETIRED_SECTIONS = "";
  try {
    assert.deepEqual(activeSections(), ["maomao", "music", "dressup", "meme", "merch"]);
  } finally {
    delete process.env.FEED_RETIRED_SECTIONS;
  }
});

test("Collectors that only fed retired sections stop; merch collectors keep running", async () => {
  const registry = await sourceRegistry({ fixtures: false });
  const byId = Object.fromEntries(registry.map((entry) => [entry.id, entry]));
  for (const id of ["danbooru-maomao", "youtube-music", "bluesky-memes", "tumblr-cosplay", "youtube-memes", "sekai-global"])
    assert.equal(byId[id].enabled, false, `${id} should be retired`);
  for (const id of ["solaris-merch", "gsc-merch", "piapro-goods"])
    assert.equal(byId[id].enabled, true, `${id} should keep collecting merch`);
  const retired = retiredSections();
  for (const entry of registry.filter((e) => e.enabled))
    assert(entry.sections.some((s) => !retired.includes(s)), `${entry.id} is enabled but feeds no active section`);
});

test("Daily notifications no longer point at the retired music shelf or Maomao club", () => {
  for (const day of ["2026-11-24", "2026-12-25", "2027-01-03"]) {
    const { pushes } = composeDay(day, { birthday: birthdayInfo(day) });
    assert(pushes.every(isApprovedPush));
    for (const push of pushes) {
      assert(!/\/world\/(stage|apothecary|atelier)/.test(push.navigate), push.navigate);
      assert(!/music shelf|maomao corner/i.test(`${push.title} ${push.body}`), push.title);
    }
  }
});

test("Home shows the letters & notes hub and none of the retired sections", async () => {
  const home = await source("src/world/today/TodayPage.jsx");
  for (const gone of ["MemeOfTheDay", "MaomaoSpread", "MusicSpread", "CosplaySpread", "#memes", "#music", "#cosplay"])
    assert(!home.includes(gone), `home still mentions ${gone}`);
  assert(home.indexOf("<LettersHub") < home.indexOf("<NoteJar"), "the hub sits above the note jar");
  assert(home.indexOf("<NoteJar") < home.indexOf("<PlayDesk"));
  assert(home.indexOf("<PlayDesk") < home.indexOf("<EventsStrip"));
  const shell = await source("src/world/WorldShell.jsx");
  for (const gone of ["#maomao", "#music", "#cosplay"]) assert(!shell.includes(gone), `nav still links ${gone}`);
  const routes = await source("src/world/World.jsx");
  for (const page of ["stage", "atelier", "apothecary"])
    assert.match(routes, new RegExp(`path="${page}" element={<Navigate replace to="/world" />}`));
});

test("The home song player plays only songs chosen for her, featured first", async () => {
  const pick = await source("src/world/stage/ListeningPick.jsx");
  assert(!pick.includes("useFeed"), "the retired music feed must not supply songs");
  assert.match(pick, /useState\(0\)/);
});

test("Her song shelf survives the music page: it lives in Settings, next to the intro song", async () => {
  const settings = await source("src/world/settings/SettingsPage.jsx");
  assert.match(settings, /import SongShelf from "\.\.\/stage\/SongShelf\.jsx"/);
  assert.match(settings, /id="songs">\s*<SongShelf \/>/);
  assert(!settings.includes("/world/stage"));
});
