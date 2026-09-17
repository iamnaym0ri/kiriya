// Live adapter list, in stable collection order within each stage. Order changes invalidate
// in-flight `{sourceIndex,cursor}` checkpoints, so append new adapters rather than reordering.
import { vocadb, vocadbSongs } from "./vocadb.js";
import { eventsCountdown, favesCreators } from "./internal.js";
import { danbooruMaomao, danbooruVocaloid, danbooruMemes } from "./danbooru.js";
import { sakugabooruMaomao } from "./sakugabooru.js";
import { anilistApothecary } from "./anilist.js";
import { newsAnn, newsCrunchyroll, newsAnimeCorner, newsMal } from "./animenews.js";
import { fandomApothecary } from "./fandom.js";
import { wikipediaApothecary } from "./wikipedia.js";
import { solarisMerch, gscMerch } from "./merch.js";
import { ardaWigs, soranewsCosplay, kamuiCosplay } from "./cosplaynews.js";
import { acdcRagLooks } from "./fashion.js";
import { shootSpots } from "./shootspots.js";
import { tumblrMemes, tumblrMaomao, tumblrCosplay } from "./tumblr.js";
import { blueskyMaomao, blueskyArt, blueskyCosplay, blueskyFashion, blueskyMemes } from "./bluesky.js";
import { lemmyMemes } from "./lemmy.js";
import { sekaiGlobal, sekaiNewsGlobal } from "./sekai.js";
import { piaproNews, piaproGoods } from "./piapro.js";
import { annPressVocaloid, siliconeraMiku } from "./musicnews.js";
import { youtubeMusic, youtubeTutorials, youtubeApothecary, youtubeMemes } from "./youtube.js";

export const LIVE_ADAPTERS = [
  // The foundation's VocaDB entry keeps its position (and its contract test) but no longer collects:
  // `vocadb-songs` replaces it with recorded YouTube playback checks and the approved rotation.
  {
    ...vocadb,
    enabled: false,
    status: "unavailable",
    notes: "Superseded by vocadb-songs (playback-checked, rotation-aware). Kept disabled for stable order.",
  },
  eventsCountdown,
  favesCreators,
  danbooruMaomao,
  danbooruVocaloid,
  danbooruMemes,
  sakugabooruMaomao,
  anilistApothecary,
  newsAnn,
  newsCrunchyroll,
  newsAnimeCorner,
  newsMal,
  fandomApothecary,
  wikipediaApothecary,
  solarisMerch,
  gscMerch,
  ardaWigs,
  soranewsCosplay,
  kamuiCosplay,
  acdcRagLooks,
  shootSpots,
  tumblrMemes,
  blueskyMaomao,
  blueskyArt,
  blueskyCosplay,
  blueskyFashion,
  blueskyMemes,
  tumblrMaomao,
  tumblrCosplay,
  lemmyMemes,
  vocadbSongs,
  // SEKAI events before their news: an event and its official article share a URL and merge on ingest.
  sekaiGlobal,
  sekaiNewsGlobal,
  piaproNews,
  piaproGoods,
  annPressVocaloid,
  siliconeraMiku,
  youtubeMusic,
  youtubeTutorials,
  youtubeApothecary,
  // Appended 2026-09-17 (never reordered): most of the feed now comes from YouTube.
  youtubeMemes,
];
