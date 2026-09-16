import { eq, sql } from "drizzle-orm";
import { schema } from "../db/client.js";
import { NOTE_JAR_NOTES } from "../content/noteJar.js";
import { readCheckin } from "./checkin.js";
import { localDay } from "./time.js";

const STATE = "notejar:state";
const PREFIX = "notejar:pull:";
const json = value => sql`${JSON.stringify(value)}::jsonb`;
const rows = result => result.rows ?? result;
const empty = () => ({ revision: 0, seen: [], ever: [], recent: [], last: null, daily: null });
async function valueAt(db, key) {
  const [row] = await db.select({ value: schema.kv.value }).from(schema.kv).where(eq(schema.kv.key, key));
  return row?.value ?? null;
}

export function chooseNote(state, { feeling = null, energy = 2, random = Math.random, pool = NOTE_JAR_NOTES } = {}) {
  // Keep mood-specific hype/nudges out of difficult moments, even after many pulls.
  // With no check-in, the library remains available; low battery still limits teasing.
  const eligible = pool.filter(note =>
    (!feeling || !note.feelings.length || note.feelings.includes(feeling)) &&
    !(note.avoidFeelings ?? []).includes(feeling) && energy >= (note.minEnergy ?? 0));
  let candidates = eligible.filter(note => !state.seen.includes(note.id));
  const reset = candidates.length === 0;
  if (reset) candidates = eligible.filter(note => note.id !== state.lastNote);
  const recent = state.recent ?? [];
  const scored = candidates.map(note => {
    let score = random() * 4;
    if (note.feelings.includes(feeling)) score += 4;
    if (!note.feelings.length) score += 1;
    if (note.feelings.length && !note.feelings.includes(feeling)) score -= 3;
    if (recent[0] === note.theme) score -= 9;
    else if (recent.includes(note.theme)) score -= 3;
    if (energy <= 1 && note.text.length < 155) score += 2;
    if (energy <= 1 && ["rest", "sad", "anxious", "overwhelmed", "angry"].includes(note.theme)) score += 2;
    return { note, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return { note: scored[0].note, reset, resetIds: reset ? eligible.map(note => note.id) : [] };
}

export async function readNoteJar(db, day = localDay()) {
  const state = await valueAt(db, STATE) ?? empty();
  const [current, daily] = await Promise.all([
    state.last ? valueAt(db, PREFIX + state.last) : null,
    state.daily?.day === day ? valueAt(db, PREFIX + state.daily.id) : null,
  ]);
  return { day, current, daily, total: NOTE_JAR_NOTES.length, pulled: state.revision };
}

// Each pull has its own immutable snapshot; state contains only bounded selection metadata.
// One compare-and-swap SQL statement advances state and stores the delivery together on Neon HTTP.
export async function pullNote(db, requestId, { day = localDay(), now = new Date(), preview = false, random = Math.random } = {}) {
  const key = PREFIX + requestId;
  const { current } = await readCheckin(db, day);
  const context = { feeling: current?.feeling?.key, energy: current?.energy ?? 2, random };
  if (preview) {
    const { note } = chooseNote(empty(), context);
    return { id: requestId, note, day, at: now.toISOString(), saved: false, revisited: false, preview: true };
  }
  await db.insert(schema.kv).values({ key: STATE, value: empty() }).onConflictDoNothing();
  for (let attempt = 0; attempt < 20; attempt++) {
    const existing = await valueAt(db, key);
    if (existing) return existing;
    const state = await valueAt(db, STATE);
    const { note, resetIds } = chooseNote(state, context);
    const record = { id: requestId, note, day, at: now.toISOString(), ordinal: state.revision + 1, saved: false, revisited: state.ever.includes(note.id) };
    const next = {
      revision: state.revision + 1,
      // Only refresh the exhausted mood-compatible set. Switching moods must not
      // forget notes already read in another mood; immutable history stays intact.
      seen: [...state.seen.filter(id => !resetIds.includes(id)), note.id],
      ever: [...new Set([...state.ever, note.id])],
      recent: [note.theme, ...state.recent].slice(0, 4),
      last: requestId, lastNote: note.id,
      daily: state.daily?.day === day ? state.daily : { day, id: requestId },
    };
    const result = rows(await db.execute(sql`
      WITH advanced AS (
        UPDATE kv SET value=${json(next)}, updated_at=now()
        WHERE key=${STATE} AND (value->>'revision')::integer=${state.revision}
          AND NOT EXISTS (SELECT 1 FROM kv WHERE key=${key})
        RETURNING key
      )
      INSERT INTO kv(key,value) SELECT ${key},${json(record)} FROM advanced
      ON CONFLICT(key) DO NOTHING RETURNING value
    `));
    if (result[0]) return result[0].value;
  }
  const existing = await valueAt(db, key);
  if (existing) return existing;
  throw Object.assign(new Error("The jar is busy. Try the same pull again."), { status: 409 });
}

export async function noteHistory(db, { before = null, saved = false } = {}) {
  const found = rows(await db.execute(sql`
    SELECT value FROM kv WHERE key LIKE ${PREFIX + "%"}
    ${saved ? sql`AND value->>'saved'='true'` : sql``}
    ${before ? sql`AND (value->>'ordinal')::integer < ${before}` : sql``}
    ORDER BY (value->>'ordinal')::integer DESC LIMIT 25
  `)).map(row => row.value);
  return { items: found.slice(0, 24), next: found.length > 24 ? found[23].ordinal : null };
}

export async function keepNote(db, id, saved) {
  const result = rows(await db.execute(sql`
    UPDATE kv SET value=jsonb_set(value,'{saved}',${json(saved)}),updated_at=now()
    WHERE key=${PREFIX + id} RETURNING value
  `));
  return result[0]?.value ?? null;
}
