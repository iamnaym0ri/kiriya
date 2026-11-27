import { Hono } from "hono";
import { getDb } from "../db/client.js";
import {
  addPin,
  captionsBody,
  editPin,
  greetingBody,
  homeFor,
  markSeen,
  photosBody,
  pinBody,
  pinPatchBody,
  removePin,
  seenBody,
  setCaptions,
  setGreeting,
  setPhotos,
} from "../lib/homeContent.js";
import { coverImage, lookupCovers } from "../lib/songs.js";
import { present } from "./songs.js";

// The app's home section: GET for both of them, writes for Josh only (docs/refactor/RENOVATION.md,
// "Admin in place"). Mounted at /api/me/home, behind the /me/* sign-in check.
export const homeRoutes = new Hono();

homeRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  await next();
});

const adminOnly = async (c, next) => {
  if (c.get("session")?.role !== "admin")
    return c.json({ error: "forbidden", message: "Only Josh can change this." }, 403);
  await next();
};

const invalid = (c, result, message) =>
  c.json({ error: "bad_request", message: result.error?.issues?.[0]?.message && !/^(Invalid|Expected|Too)/.test(result.error.issues[0].message) ? result.error.issues[0].message : message }, 400);

const body = async (c) => c.req.json().catch(() => null);
const fail = (c, error) =>
  error?.status ? c.json({ error: error.code ?? "bad_request", message: error.message }, error.status) : Promise.reject(error);

homeRoutes.get("/", async (c) => c.json(await homeFor(await getDb(), c.get("session").role, present)));

// Songs she played and when she last looked at the pinboard (each person keeps their own).
homeRoutes.post("/seen", async (c) => {
  const parsed = seenBody.safeParse(await body(c));
  if (!parsed.success) return invalid(c, parsed, "That didn’t look right.");
  return c.json(await markSeen(await getDb(), c.get("session").role, parsed.data));
});

homeRoutes.put("/greeting", adminOnly, async (c) => {
  const parsed = greetingBody.safeParse(await body(c));
  if (!parsed.success) return invalid(c, parsed, "Keep the greeting to one short line.");
  await setGreeting(await getDb(), parsed.data.greeting);
  return c.json(await homeFor(await getDb(), "admin", present));
});

homeRoutes.put("/photos", adminOnly, async (c) => {
  const parsed = photosBody.safeParse(await body(c));
  if (!parsed.success) return invalid(c, parsed, "One of the photos couldn’t be saved. Try adding it again.");
  try {
    await setPhotos(await getDb(), parsed.data.photos);
  } catch (error) {
    return fail(c, error);
  }
  return c.json(await homeFor(await getDb(), "admin", present));
});

homeRoutes.put("/captions", adminOnly, async (c) => {
  const parsed = captionsBody.safeParse(await body(c));
  if (!parsed.success) return invalid(c, parsed, "Each caption needs a few words (160 letters at most).");
  await setCaptions(await getDb(), parsed.data.captions, parsed.data.pinned);
  return c.json(await homeFor(await getDb(), "admin", present));
});

homeRoutes.post("/pins", adminOnly, async (c) => {
  const parsed = pinBody.safeParse(await body(c));
  if (!parsed.success) return invalid(c, parsed, "A pinned note needs a few words (400 letters at most).");
  try {
    const { pin } = await addPin(await getDb(), parsed.data);
    return c.json({ pin, home: await homeFor(await getDb(), "admin", present) }, 201);
  } catch (error) {
    return fail(c, error);
  }
});

homeRoutes.patch("/pins/:id", adminOnly, async (c) => {
  const parsed = pinPatchBody.safeParse(await body(c));
  if (!parsed.success) return invalid(c, parsed, "A pinned note needs a few words (400 letters at most).");
  const result = await editPin(await getDb(), c.req.param("id"), parsed.data);
  if (!result) return c.json({ error: "not_found", message: "That note isn’t on the board any more." }, 404);
  return c.json({ pin: result.pin, home: await homeFor(await getDb(), "admin", present) });
});

homeRoutes.delete("/pins/:id", adminOnly, async (c) => {
  const removed = await removePin(await getDb(), c.req.param("id"));
  if (!removed) return c.json({ error: "not_found", message: "That note isn’t on the board any more." }, 404);
  return c.json({ ok: true, home: await homeFor(await getDb(), "admin", present) });
});

// Cover art for an uploaded song with none in its tags: candidates from MusicBrainz, and each
// candidate's picture from the Cover Art Archive, fetched here so the phone talks only to us.
homeRoutes.get("/covers", adminOnly, async (c) => {
  const { title = "", artist = "", album = "" } = c.req.query();
  const covers = await lookupCovers({ title, artist, album });
  return c.json({ covers });
});

homeRoutes.get("/covers/:id", adminOnly, async (c) => {
  const image = await coverImage(c.req.param("id"), { size: c.req.query("size") === "250" ? 250 : 500 });
  if (!image) return c.json({ error: "not_found", message: "No cover for that one." }, 404);
  return new Response(image.bytes, {
    headers: { "Content-Type": image.type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
});

// ---------- YouTube's player, from this site's own address ----------
// YouTube's embedded player wants to know which site it's on (the Referer header). The iPhone app
// runs on capacitor://localhost, which sends none, so the app frames this small page from
// https://kiriya.love instead and the player sits inside it. It is YouTube's own visible player.
// It also reports the video's length and play state to the page around it (postMessage).
export const homeEmbedRoutes = new Hono();
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

homeEmbedRoutes.get("/youtube", (c) => {
  const id = c.req.query("v") ?? "";
  if (!YOUTUBE_ID.test(id)) return c.text("Not found", 404);
  const autoplay = c.req.query("autoplay") === "1";
  const probe = c.req.query("probe") === "1";
  c.header("Content-Type", "text/html; charset=utf-8");
  c.header("Cache-Control", "public, max-age=86400");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  return c.body(youtubePage(id, { autoplay, probe }));
});

function youtubePage(id, { autoplay, probe }) {
  const config = JSON.stringify({ id, autoplay, probe });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><title>player</title>
<style>html,body{margin:0;height:100%;background:#1d1424;overflow:hidden}#player{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head>
<body><div id="player"></div>
<script>
var cfg=${config},player=null,probing=cfg.probe;
function post(m){m.source="kw-youtube";m.v=cfg.id;try{parent.postMessage(m,"*")}catch(e){}}
function length(){try{return player.getDuration()||0}catch(e){return 0}}
window.onYouTubeIframeAPIReady=function(){player=new YT.Player("player",{videoId:cfg.id,host:"https://www.youtube-nocookie.com",
playerVars:{playsinline:1,rel:0,autoplay:cfg.autoplay?1:0,origin:location.origin},
events:{onReady:function(){var d=length();post({type:"ready",duration:d});if(probing&&!d){player.mute();player.playVideo()}else{probing=false}if(cfg.autoplay)player.playVideo()},
onStateChange:function(e){var d=length();if(probing&&e.data===1){probing=false;player.pauseVideo();player.seekTo(0,true);player.unMute();post({type:"duration",duration:d});return}
post({type:"state",state:e.data,duration:d})},
onError:function(e){post({type:"error",code:e.data})}}})};
var s=document.createElement("script");s.src="https://www.youtube.com/iframe_api";document.head.appendChild(s);
</script></body></html>`;
}
