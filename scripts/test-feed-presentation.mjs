import assert from "node:assert/strict";
import { test } from "node:test";
import { cosplayCollection, filterCosplays, selectCosplayPicks } from "../src/lib/feedPresentation.js";

const entry = (id, characters, kind = "cosplay", fandoms = []) => ({ key: id, type: "three", primary: { id, kind, tags: { characters, fandoms }, media: [{ type: "image", url: `/${id}.jpg` }] } });
const mao = entry("mao", ["maomao"]), mao2 = entry("mao2", ["maomao"]), miku = entry("miku", ["hatsune miku"]);

test("older editions and reserve entries still present Maomao, Maomao, Miku in order", () => {
  const oldOrder = [miku, entry("reference", ["maomao"], "image"), mao, { ...mao2, type: "cosplay" }];
  assert.deepEqual(selectCosplayPicks(oldOrder).map((pick) => pick?.primary.id), ["mao", "mao2", "miku"]);
  assert.equal(oldOrder[0], miku, "selection must not mutate the published edition");
});
test("thin feeds leave a missing character empty and never substitute illustrations or merch", () => {
  assert.deepEqual(selectCosplayPicks([miku, entry("art", ["maomao"], "image"), entry("doll", ["maomao"], "merch")]), [null, null, miku]);
  const jinshi = entry("jinshi", ["jinshi"], "cosplay", ["the apothecary diaries"]);
  assert.deepEqual(selectCosplayPicks([miku, jinshi, mao]), [mao, jinshi, miku]);
});
test("photo links open the relevant shelf and put the selected look first", () => {
  assert.equal(cosplayCollection(mao.primary), "apothecary");
  assert.equal(cosplayCollection(miku.primary), "miku");
  assert.deepEqual(filterCosplays([miku, mao, mao2], "apothecary", "mao2").map((pick) => pick.primary.id), ["mao2", "mao"]);
  assert.deepEqual(filterCosplays([miku, mao, mao2], "miku"), [miku]);
  assert.deepEqual(filterCosplays([mao], "miku"), []);
});


test("Discovery notes include live companions, deduplicate them, and do not invent copy", async () => {
  const { discoveryEntries, publishedEntries } = await import("../shared/feedContent.js");
  const note = { id: "lore", kind: "lore", title: "A live note", blurb: { text: "Actual published words" } };
  const photo = { key: "photo", primary: { id: "photo", kind: "image" }, companions: [note] };
  const direct = { key: "note", primary: note };
  assert.deepEqual(discoveryEntries([photo, direct]).map((entry) => entry.primary.id), ["lore"]);
  assert.deepEqual(discoveryEntries([{ key: "empty", primary: { id: "empty", kind: "news", title: "No copy supplied" } }]), []);
  assert.deepEqual(publishedEntries({ revision: null, slots: [photo] }), []);
  assert.deepEqual(publishedEntries({ revision: "published", slots: [photo], reserve: [direct], seenEarlier: [photo] }), [photo, direct]);
});
