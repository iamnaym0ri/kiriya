// While the website is closed for the app surprise (shared/siteClosed.js), nothing notifies Kiriya.
import assert from "node:assert/strict";
import { test } from "node:test";
import { WEBSITE_CLOSED } from "../shared/siteClosed.js";

delete process.env.KIRIYA_NOTIFY_WHILE_CLOSED;
const { sendToSubscribers } = await import("../server/push/webpush.js");

test("Her notifications are held while the website is closed", { skip: !WEBSITE_CLOSED && "the website is open" }, async () => {
  // No database is touched: the hold answers before looking for her subscriptions or phones.
  const result = await sendToSubscribers(null, { title: "a new message from josh", body: "hi" }, { role: "kiriya" });
  assert.deepEqual(result, { sent: 0, failed: 0, targets: 0, held: true });
});
