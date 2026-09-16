import { readFeed } from "./editions.js";
import { feedConfig } from "./config.js";
import { DISCOVERY_SECTIONS, discoveryEntries, publishedEntries, youtubeSong } from "../../shared/feedContent.js";

export async function readDiscoveryCollection(db, kind) {
  const feed = await readFeed(db, DISCOVERY_SECTIONS[kind], { fixture: feedConfig().fixtureMode });
  return {
    revision: feed.revision,
    items: discoveryEntries(publishedEntries(feed)).map(({ primary }) => ({
      id: primary.id, kind, title: primary.blurb?.headline || primary.title,
      body: primary.blurb.text, source: primary.url, credit: primary.credit,
    })),
  };
}

export async function readSongCollection(db) {
  const feed = await readFeed(db, "music", { fixture: feedConfig().fixtureMode });
  return { revision: feed.revision, songs: publishedEntries(feed)
    .filter((entry) => entry.type === "song")
    .map((entry) => youtubeSong(entry.primary)).filter(Boolean) };
}
