import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { schema } from "../db/client.js";
import { kiriya } from "../content/kiriya.js";

// A letter opened right inside its notification on the phone (ios/App/KiriyaNotificationContent).
// Its push carries the letter (trimmed to fit, apns.js letterPayload); the card fetches the whole
// letter when it opens (GET /api/widget/letters/:id) and counts it as opened, as the Letters page does.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where a letter's notification goes: the Letters page, opening that letter. */
export const letterLink = (id) => (id ? `/world/letters?open=${id}` : "/world/letters");

/** The letter a notification's link points at (letterLink), if any. */
export function letterIdFromLink(link) {
  const match = /^\/world\/letters\?open=([0-9a-f-]{36})$/i.exec(String(link ?? ""));
  return match && UUID.test(match[1]) ? match[1] : null;
}

/** Josh's name as he signs it (Settings → signature), the same rule as the chat's (lib/chat.js names). */
export async function signatureName(db) {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, "signature"));
  return String(row?.value ?? kiriya.signature).replace(/\s*<3\s*$/, "").trim() || "Josh";
}

/**
 * The letter as the notification card shows it. A letter that isn't ready to open yet never
 * carries its words (the Letters page hides them too).
 */
export async function letterForCard(db, id, { now = new Date() } = {}) {
  if (!id || !UUID.test(id)) return null;
  const [row] = await db.select().from(schema.letters).where(eq(schema.letters.id, id));
  if (!row) return null;
  const locked = Boolean(row.unlockAt && row.unlockAt.getTime() > now.getTime());
  return {
    id: row.id,
    title: row.title,
    text: locked ? null : row.body,
    from: row.author === "maomao" ? "Maomao" : await signatureName(db),
    kind: row.kind,
    openWhen: row.openWhen ?? null,
    date: row.createdAt?.toISOString?.() ?? null,
    lockedUntil: locked ? row.unlockAt.toISOString() : null,
  };
}

/** Opening a letter in its notification: hers count as opened (like POST /me/letters/:id/open). */
export async function openLetterInPlace(db, person, id, { now = new Date() } = {}) {
  const letter = await letterForCard(db, id, { now });
  if (!letter) return { status: 404 };
  if (letter.lockedUntil) return { status: 403 };
  if (person === "kiriya") {
    const [row] = await db.select({ openedAt: schema.letters.openedAt }).from(schema.letters).where(eq(schema.letters.id, id));
    if (!row.openedAt) await db.update(schema.letters).set({ openedAt: now }).where(eq(schema.letters.id, id));
    await openLetterAnnouncements(db, id, now);
  }
  return { status: 200, letter };
}

/**
 * A letter's announcement is a little note that links to it (letterLink). Opening the letter itself
 * opens its announcement too, so the "new" mark and the icon badge don't linger after she read it.
 */
export async function openLetterAnnouncements(db, letterId, now = new Date()) {
  if (!letterId || !UUID.test(letterId)) return 0;
  const opened = await db
    .update(schema.loveNotes)
    .set({ openedAt: now })
    .where(
      and(
        eq(schema.loveNotes.recipient, "kiriya"),
        eq(schema.loveNotes.link, letterLink(letterId)),
        lte(schema.loveNotes.sendAt, now),
        inArray(schema.loveNotes.status, ["scheduled", "sending", "sent"]),
        isNull(schema.loveNotes.openedAt),
      ),
    )
    .returning({ id: schema.loveNotes.id });
  return opened.length;
}
