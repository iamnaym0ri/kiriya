import { eq } from "drizzle-orm";
import { schema } from "../db/client.js";
import { kiriya } from "../content/kiriya.js";

/** The admin-written bits the daily composer mixes in: Josh's notes and his signature. */
export async function loadPersonal(db) {
  const [[notesRow], [signatureRow]] = await Promise.all([
    db.select().from(schema.kv).where(eq(schema.kv.key, "admin:notes")),
    db.select().from(schema.settings).where(eq(schema.settings.key, "signature")),
  ]);
  return { notes: notesRow?.value ?? [], signature: signatureRow?.value ?? kiriya.signature };
}
