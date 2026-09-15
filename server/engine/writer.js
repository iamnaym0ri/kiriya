// The AI writer: turns the day's facts and fetched items into Maomao-voice text.
// It may only rephrase what it's given. Anything invalid falls back to the template text.
import OpenAI from "openai";
import { z } from "zod";
import { env } from "../env.js";
import { PERSONA_GUIDE } from "../content/voice.js";
import { kiriya } from "../content/kiriya.js";

const EXPRESSIONS = ["deadpan", "smug", "sparkle", "happy", "sleepy", "party", "ew"];

const line = {
  type: "object",
  additionalProperties: false,
  required: ["text", "expression"],
  properties: { text: { type: "string" }, expression: { type: "string", enum: EXPRESSIONS } },
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["greetings", "finds", "pushes", "songNote", "artNote"],
  properties: {
    greetings: {
      type: "object",
      additionalProperties: false,
      required: ["morning", "afternoon", "evening", "late", "birthday"],
      properties: { morning: line, afternoon: line, evening: line, late: line, birthday: line },
    },
    finds: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "headline", "blurb"],
        properties: { sourceId: { type: "string" }, headline: { type: "string" }, blurb: { type: "string" } },
      },
    },
    pushes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body"],
        properties: { title: { type: "string" }, body: { type: "string" } },
      },
    },
    songNote: { type: "string" },
    artNote: { type: "string" },
  },
};

const OutputCheck = z.object({
  greetings: z.object(
    Object.fromEntries(
      ["morning", "afternoon", "evening", "late", "birthday"].map((k) => [k, z.object({ text: z.string().min(8).max(240), expression: z.enum(EXPRESSIONS) })]),
    ),
  ),
  finds: z.array(z.object({ sourceId: z.string(), headline: z.string().min(4).max(90), blurb: z.string().min(10).max(260) })).max(4),
  pushes: z.array(z.object({ title: z.string().min(3).max(60), body: z.string().min(8).max(140) })).length(3),
  songNote: z.string().max(220),
  artNote: z.string().max(220),
});

const RULES = `
Rules:
- Write in English. Second person ("you"); never use he/him, she/her or they/them about Kiriya.
- Only use facts present in the input. Do not add dates, numbers, names or claims that aren't there.
  If a summary is thin, say less rather than guessing.
- Fresh finds: pick at most 4 items that are uplifting and genuinely about Kiriya's interests. Skip anything
  about deaths, abuse, scandals, lawsuits, politics, incidents, or layoffs. Light-novel spoilers and ships are allowed.
  Skip items that aren't clearly about the interest they were filed under. It's fine to return fewer.
  headline ≤ 70 characters, blurb ≤ 200 characters, and blurbs should make the item sound fun to open.
  Japanese-language items: translate the gist faithfully into English.
- Greetings: one short line per time of day (≤ 180 characters), lightly nodding to today's content.
  "birthday" is used only during birthday week: warm, dry, a little extra.
- Pushes: exactly 3 notifications for different times of day. title ≤ 40 characters, body ≤ 110 characters.
  Each points at something real from today's content (a fact, the song, a find, the drawer). One of them is a
  sincere reminder of something that makes Kiriya special, taken from the traits given.
  Notifications show on a lock screen: never quote a card whose "spoiler" is not null; tease it instead.
- songNote and artNote: ≤ 160 characters each, only from the metadata given; empty string if nothing is given.
- Tone: cute, clean, sassy-dry like the persona. At most one ♡ or ✦ per piece. No hashtags.
`.trim();

export function aiWriterAvailable() {
  return Boolean(env.openaiApiKey);
}

/** Returns a bundle with AI text merged in; throws if the model output can't be used. */
export async function writeWithAi(bundle, { birthday }) {
  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const candidates = (bundle.findCandidates ?? []).slice(0, 16);

  const input = {
    date: bundle.day,
    city: "Singapore",
    birthday,
    kiriya: {
      interests: kiriya.interests,
      favorites: kiriya.favorites,
      cosplaysDone: kiriya.cosplays.done,
      traits: kiriya.traits,
    },
    todaysCards: bundle.cards.map((c) => ({ kind: c.kind, title: c.title, fact: c.body, spoiler: c.spoiler ?? null })),
    songOfTheDay: bundle.song ? { title: bundle.song.title, artist: bundle.song.artist, bpm: bundle.song.bpm, tags: bundle.song.tags } : null,
    artworkOfTheDay: bundle.artwork ? { title: bundle.artwork.title, artist: bundle.artwork.artist, date: bundle.artwork.date, medium: bundle.artwork.medium } : null,
    apothecary: bundle.apothecary ?? null,
    specialDates: bundle.specials ?? [],
    candidates: candidates.map((c) => ({ sourceId: c.id, source: c.source, category: c.category, title: c.title, summary: c.summary })),
  };

  const response = await client.responses.create({
    model: env.openaiModel,
    instructions: `${PERSONA_GUIDE}\n\n${RULES}`,
    input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(input) }] }],
    text: { format: { type: "json_schema", name: "kiriya_day", strict: true, schema: SCHEMA } },
    reasoning: { effort: "low" },
    max_output_tokens: 6000,
    store: false,
  });

  if (response.status !== "completed") throw new Error(`writer status ${response.status}`);
  const parsed = OutputCheck.safeParse(JSON.parse(response.output_text));
  if (!parsed.success) throw new Error(`writer output rejected: ${parsed.error.issues[0]?.message}`);
  const out = parsed.data;

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const finds = out.finds
    .filter((f) => byId.has(f.sourceId))
    .map((f) => {
      const item = byId.get(f.sourceId);
      return { id: item.id, category: item.category, source: item.source, url: item.url, headline: f.headline, blurb: f.blurb, publishedAt: item.publishedAt };
    });

  const greetings = { ...bundle.greetings, morning: out.greetings.morning, afternoon: out.greetings.afternoon, evening: out.greetings.evening, late: out.greetings.late };
  if (birthday.isBirthdayWeek) greetings.birthday = out.greetings.birthday;

  return {
    ...bundle,
    writer: "ai",
    greetings,
    finds: finds.length ? finds : bundle.finds,
    pushes: out.pushes.map((p) => ({ ...p, navigate: "/world" })),
    song: bundle.song ? { ...bundle.song, note: out.songNote || bundle.song.note } : null,
    artwork: bundle.artwork ? { ...bundle.artwork, note: out.artNote || bundle.artwork.note } : null,
    usage: { input: response.usage?.input_tokens ?? null, output: response.usage?.output_tokens ?? null },
  };
}
