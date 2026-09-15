// Bounded moving-media inspection. Frames are sampled evenly across the clip and tiled into
// contact sheets for moderation/vision. This is sampling: it cannot prove every frame is safe,
// and the recorded evidence says exactly what was inspected. Failures keep the item withheld.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { FeedError } from "./config.js";

export const MOTION_LIMITS = {
  framesPerSheet: 4,
  maxSheets: 2,
  tile: 256,
  sheet: 512,
  gifBytes: 8 * 1024 * 1024,
  videoBytes: 8 * 1024 * 1024,
  playlistBytes: 256 * 1024,
  segmentBytes: 3 * 1024 * 1024,
  hlsSegments: 4,
  ffmpegTimeoutMs: 20_000,
  maxDurationSeconds: 900,
};
const PLAYLIST_TYPES = [
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "audio/mpegurl",
];
const SEGMENT_TYPES = [
  "video/mp2t",
  "video/mp4",
  "video/iso.segment",
  "application/octet-stream",
];

export function evenlySpaced(count, wanted) {
  if (count <= 0) return [];
  if (count <= wanted) return [...Array(count).keys()];
  return [...Array(wanted).keys()].map((i) =>
    Math.min(count - 1, Math.floor(((i + 0.5) * count) / wanted)),
  );
}

let binary;
export async function ffmpegBinary() {
  if (binary !== undefined) return binary;
  try {
    const mod = await import("@ffmpeg-installer/ffmpeg");
    binary = (mod.default ?? mod).path ?? null;
  } catch {
    binary = null;
  }
  return binary;
}

function run(bin, args, { allowFail = false } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      {
        timeout: MOTION_LIMITS.ffmpegTimeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error && !allowFail) reject(new FeedError("motion_decode_failed"));
        else resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

function checkDeadline(deadline, reserveMs = 25_000) {
  if (deadline && Date.now() + reserveMs > deadline)
    throw new FeedError("deadline", 409);
}

/** Tiles up to 8 frames into ≤2 letterboxed 2×2 JPEG sheets (512×512). */
export async function contactSheets(frames) {
  const { framesPerSheet, maxSheets, tile, sheet } = MOTION_LIMITS;
  const sheets = [];
  for (let s = 0; s < maxSheets && s * framesPerSheet < frames.length; s++) {
    const group = frames.slice(s * framesPerSheet, (s + 1) * framesPerSheet);
    const composites = await Promise.all(
      group.map(async (buffer, i) => ({
        input: await sharp(buffer, { limitInputPixels: 40_000_000 })
          .resize(tile, tile, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0 },
          })
          .jpeg({ quality: 80 })
          .toBuffer(),
        left: (i % 2) * tile,
        top: Math.floor(i / 2) * tile,
      })),
    );
    sheets.push(
      await sharp({
        create: {
          width: sheet,
          height: sheet,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      })
        .composite(composites)
        .jpeg({ quality: 82 })
        .toBuffer(),
    );
  }
  return sheets;
}

/** Animated GIF/WebP pages decoded with sharp. A single-page file is a still. */
export async function sampleAnimatedImage(buffer) {
  const wanted = MOTION_LIMITS.framesPerSheet * MOTION_LIMITS.maxSheets;
  const meta = await sharp(buffer, {
    animated: true,
    limitInputPixels: 40_000_000,
    failOn: "error",
  }).metadata();
  if (!["gif", "webp"].includes(meta.format))
    throw new FeedError("unexpected_content_type");
  const pages = Math.max(1, meta.pages ?? 1);
  const frames = [];
  for (const page of evenlySpaced(pages, wanted))
    frames.push(
      await sharp(buffer, { page, limitInputPixels: 40_000_000 })
        .png()
        .toBuffer(),
    );
  const delays = Array.isArray(meta.delay) ? meta.delay : [];
  return {
    method: "animated-image-pages",
    totalFrames: pages,
    sampledFrames: frames.length,
    duration: delays.length
      ? Math.round(delays.reduce((a, b) => a + b, 0)) / 1000
      : null,
    coverage: pages <= wanted ? "all frames" : "evenly spaced across all frames",
    frames,
  };
}

async function probeDuration(bin, file) {
  const { stderr } = await run(
    bin,
    ["-hide_banner", "-nostdin", "-protocol_whitelist", "file", "-i", file],
    { allowFail: true },
  );
  const m = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

// Input seeking is fast for MP4; streams whose timestamps don't start at zero (HLS/TS segments)
// need output seeking, which decodes from the start of the short file. A missing input-seek frame
// is retried once with output seeking.
async function framesAt(bin, file, times, dir, prefix, { seek = "input" } = {}) {
  const frames = [];
  const extract = async (t, out, mode) => {
    const at = Math.max(0, t).toFixed(3);
    const before = mode === "input" ? ["-ss", at] : [];
    const after = mode === "output" ? ["-ss", at] : [];
    await run(bin, [
      "-hide_banner",
      "-nostdin",
      "-loglevel",
      "error",
      "-protocol_whitelist",
      "file",
      ...before,
      "-i",
      file,
      ...after,
      "-frames:v",
      "1",
      "-an",
      "-vf",
      `scale=${MOTION_LIMITS.tile}:${MOTION_LIMITS.tile}:force_original_aspect_ratio=decrease`,
      "-y",
      out,
    ]);
    try {
      return await readFile(out);
    } catch {
      return null;
    }
  };
  for (const [i, t] of times.entries()) {
    const out = path.join(dir, `${prefix}-${i}.png`);
    const frame =
      (await extract(t, out, seek)) ??
      (seek === "input" ? await extract(t, out, "output") : null);
    // A seek past the last decodable frame produces no output; other samples still count.
    if (frame) frames.push(frame);
  }
  return frames;
}

/** MP4/WebM file on local disk; ffmpeg can only read local files (no network protocols). */
export async function sampleVideoFile(file, { deadline } = {}) {
  const bin = await ffmpegBinary();
  if (!bin) throw new FeedError("motion_sampler_unavailable", 503);
  const duration = await probeDuration(bin, file);
  if (!duration || duration <= 0) throw new FeedError("motion_decode_failed");
  if (duration > MOTION_LIMITS.maxDurationSeconds)
    throw new FeedError("motion_too_long");
  checkDeadline(deadline);
  const wanted = MOTION_LIMITS.framesPerSheet * MOTION_LIMITS.maxSheets;
  const times = [...Array(wanted).keys()].map(
    (i) => ((i + 0.5) * duration) / wanted,
  );
  const frames = await framesAt(bin, file, times, path.dirname(file), "frame");
  if (frames.length < Math.min(wanted, 2))
    throw new FeedError("motion_decode_failed");
  return {
    method: "ffmpeg-evenly-spaced-seek",
    duration,
    sampledFrames: frames.length,
    coverage: `${frames.length} frames evenly spaced across ${duration.toFixed(1)}s`,
    frames,
  };
}

export function parsePlaylist(text, base) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (lines[0] !== "#EXTM3U") throw new FeedError("invalid_playlist");
  const variants = [],
    segments = [];
  let init = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#EXT-X-KEY") && !/METHOD=NONE/.test(line))
      throw new FeedError("motion_encrypted");
    if (line.startsWith("#EXT-X-MAP")) {
      const uri = line.match(/URI="([^"]+)"/)?.[1];
      if (uri) init = new URL(uri, base).href;
    }
    if (line.startsWith("#EXT-X-STREAM-INF")) {
      const next = lines.slice(i + 1).find((l) => l && !l.startsWith("#"));
      if (next)
        variants.push({
          bandwidth: Number(line.match(/BANDWIDTH=(\d+)/)?.[1] ?? Infinity),
          url: new URL(next, base).href,
        });
    }
    if (line.startsWith("#EXTINF:")) {
      const next = lines.slice(i + 1).find((l) => l && !l.startsWith("#"));
      if (next)
        segments.push({
          duration: Number(line.slice(8).split(",")[0]) || 0,
          url: new URL(next, base).href,
        });
    }
  }
  return {
    variants: variants.sort((a, b) => a.bandwidth - b.bandwidth),
    segments,
    init,
  };
}

/** HLS: the lowest-bandwidth rendition, evenly chosen segments, two frames per segment. */
export async function sampleHls(url, { http, dir, deadline }) {
  const bin = await ffmpegBinary();
  if (!bin) throw new FeedError("motion_sampler_unavailable", 503);
  const read = async (target, types, maxBytes) =>
    http.binary(target, { types, maxBytes });
  let response = await read(url, PLAYLIST_TYPES, MOTION_LIMITS.playlistBytes);
  let playlist = parsePlaylist(
    response.buffer.toString("utf8"),
    response.url ?? url,
  );
  if (playlist.variants.length) {
    const variant = playlist.variants[0].url;
    response = await read(variant, PLAYLIST_TYPES, MOTION_LIMITS.playlistBytes);
    playlist = parsePlaylist(response.buffer.toString("utf8"), variant);
  }
  const { segments } = playlist;
  if (!segments.length) throw new FeedError("invalid_playlist");
  const duration = segments.reduce((sum, s) => sum + s.duration, 0);
  if (duration > MOTION_LIMITS.maxDurationSeconds)
    throw new FeedError("motion_too_long");
  const init = playlist.init
    ? (await read(playlist.init, SEGMENT_TYPES, MOTION_LIMITS.segmentBytes))
        .buffer
    : null;
  const frames = [];
  const chosen = evenlySpaced(segments.length, MOTION_LIMITS.hlsSegments);
  for (const index of chosen) {
    checkDeadline(deadline);
    const segment = segments[index];
    const body = (
      await read(segment.url, SEGMENT_TYPES, MOTION_LIMITS.segmentBytes)
    ).buffer;
    const file = path.join(dir, `segment-${index}.${init ? "mp4" : "ts"}`);
    await writeFile(file, init ? Buffer.concat([init, body]) : body);
    const span = segment.duration || 2;
    frames.push(
      ...(await framesAt(
        bin,
        file,
        [span * 0.25, span * 0.75],
        dir,
        `hls-${index}`,
        { seek: "output" },
      )),
    );
  }
  if (frames.length < 2) throw new FeedError("motion_decode_failed");
  return {
    method: "ffmpeg-hls-segments",
    duration,
    sampledFrames: frames.length,
    coverage: `${chosen.length} of ${segments.length} segments, two frames each`,
    frames,
  };
}

/**
 * Samples one media entry. `http` must be the source's sourceHttp so host/DNS/byte policies
 * apply to every download. Returns contact sheets as JPEG buffers plus evidence.
 */
export async function sampleMotion(media, { http, deadline }) {
  const dir = await mkdtemp(path.join(tmpdir(), "kiriya-motion-"));
  try {
    checkDeadline(deadline);
    let sample;
    if (media.type === "gif") {
      const r = await http.binary(media.url, {
        types: ["image/gif", "image/webp"],
        maxBytes: MOTION_LIMITS.gifBytes,
      });
      sample = await sampleAnimatedImage(r.buffer);
    } else if (media.type === "mp4") {
      const r = await http.binary(media.url, {
        types: ["video/mp4", "video/webm"],
        maxBytes: MOTION_LIMITS.videoBytes,
      });
      const file = path.join(
        dir,
        r.contentType === "video/webm" ? "clip.webm" : "clip.mp4",
      );
      await writeFile(file, r.buffer);
      sample = await sampleVideoFile(file, { deadline });
    } else if (media.type === "hls") {
      sample = await sampleHls(media.url, { http, dir, deadline });
    } else throw new FeedError("unsupported_motion_type");
    const sheets = await contactSheets(sample.frames);
    const { frames, ...evidence } = sample;
    return { sheets, evidence: { ...evidence, sheets: sheets.length } };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
