import { unreadMessages } from "./chat.js";
import { unreadCount } from "./loveNotes.js";
import { readNoteJar } from "./noteJar.js";

/**
 * What's waiting for someone in the app: unread chat messages, plus (for Kiriya) unread little
 * notes and new jar notes she hasn't drawn. The total is the red badge on the app icon; every
 * push sets it, and the app keeps it in step while open.
 */
export async function unreadTotals(db, role) {
  const [chat, notes, jar] = await Promise.all([
    unreadMessages(db, role),
    role === "kiriya" ? unreadCount(db, "kiriya") : 0,
    role === "kiriya" ? readNoteJar(db).then((state) => state.fresh) : 0,
  ]);
  return { chat, notes, jar, total: chat + notes + jar };
}
