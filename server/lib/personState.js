import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { schema } from "../db/client.js";
import { ADDRESS_OPTIONS, moodByKey } from "../content/moods.js";

export const PEOPLE = ["kiriya", "admin"];
export const MAX_PINS = 6;
export const SHARING_KEYS = ["address", "presentation", "feeling", "energy"];
// Which parts of today's check-in the public profile may show.
export const SHARING_DEFAULTS = { address: false, presentation: false, feeling: false, energy: false };
// Little one-time suggestions she can dismiss for good.
export const HINT_KEYS = ["install", "sharing", "widget", "notifications"];
export const PROFILE_LIMITS = { bioLines: 6, bioLine: 80, loves: 12, love: 40 };
export const SOCIAL_HANDLE = /^[A-Za-z0-9._]{0,30}$/;

const prefsSchema = z.object({
  address: z.partialRecord(z.enum(Object.keys(moodByKey)), z.enum(Object.keys(ADDRESS_OPTIONS))).optional(),
  sharing: z.object(Object.fromEntries(SHARING_KEYS.map((key) => [key, z.boolean()]))).partial().optional(),
  pins: z.array(z.object({ id: z.string().uuid(), at: z.string().datetime() })).max(MAX_PINS).optional(),
  motion: z.enum(["lively", "quiet"]).optional(),
  cornerSmall: z.boolean().optional(),
  hints: z.partialRecord(z.enum(HINT_KEYS), z.boolean()).optional(),
  // What the public page says about this person. Unset parts fall back to the site's profile.
  profile: z
    .object({
      bioLines: z.array(z.string().trim().min(1).max(PROFILE_LIMITS.bioLine)).max(PROFILE_LIMITS.bioLines),
      socials: z.object({ tiktok: z.string().regex(SOCIAL_HANDLE), instagram: z.string().regex(SOCIAL_HANDLE) }).partial(),
      loves: z.array(z.string().trim().min(1).max(PROFILE_LIMITS.love)).max(PROFILE_LIMITS.loves),
      introSongId: z.union([z.string().uuid(), z.literal("none")]),
      showViews: z.boolean(),
    })
    .partial()
    .optional(),
});

export async function readPersonState(db, person) {
  const [row] = await db.select().from(schema.personState).where(eq(schema.personState.person, person));
  return row
    ? { ...row, prefs: row.prefs ?? {}, exists: true }
    : { person, status: null, prefs: {}, revision: 0, exists: false };
}

/**
 * Applies `change(current)` → `{ status?, prefs? }` with a revision check, retrying when another
 * request saved first, so two quick taps can't erase each other's choice.
 */
export async function updatePersonState(db, person, change) {
  if (!PEOPLE.includes(person)) throw new Error("Unknown person");
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await readPersonState(db, person);
    const next = await change(current);
    const values = {
      status: next.status === undefined ? current.status : next.status,
      prefs: prefsSchema.parse(next.prefs === undefined ? current.prefs : next.prefs),
      revision: current.revision + 1,
      updatedAt: new Date(),
    };
    const [row] = current.exists
      ? await db
          .update(schema.personState)
          .set(values)
          .where(and(eq(schema.personState.person, person), eq(schema.personState.revision, current.revision)))
          .returning()
      : await db.insert(schema.personState).values({ person, ...values }).onConflictDoNothing().returning();
    if (row) return row;
  }
  throw Object.assign(new Error("Your choices changed at the same moment. Try again."), { status: 409 });
}

/** Preferences as the interface uses them, with defaults filled in. */
export function resolvePrefs(prefs = {}) {
  return {
    // null: this device keeps its own motion setting until she picks one while unlocked.
    motion: prefs.motion ?? null,
    cornerSmall: prefs.cornerSmall ?? false,
    sharing: { ...SHARING_DEFAULTS, ...prefs.sharing },
    sharingChosen: Boolean(prefs.sharing),
    pins: prefs.pins ?? [],
    hints: prefs.hints ?? {},
  };
}
