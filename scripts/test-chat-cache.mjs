// What the phone keeps of the chat (src/lib/chatCache.js) and how its files are keyed
// (src/lib/mediaCache.js): the server's own (sealed) copies only, never the opened words.
import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheRecord, rememberRaw } from "../src/lib/chatCache.js";
import { mediaKey } from "../src/lib/mediaCache.js";

const sealed = (id, extra = {}) => ({ id, clientId: `c-${id}`, sender: "kiriya", kind: "text", body: "c2VhbGVk", enc: { v: 1, k: "key" }, reactions: {}, createdAt: `2026-11-27T10:00:0${id}Z`, ...extra });
const opened = (id, extra = {}) => ({ ...sealed(id), body: `opened words ${id}`, enc: undefined, sealed: true, ...extra });

test("Only the server's own copies are kept: the opened words never reach the phone's storage", () => {
  rememberRaw([sealed(1), sealed(2), sealed(3)]);
  const data = {
    pages: [{ me: "kiriya", names: { admin: "Josh", kiriya: "Kiriya" }, live: true, reads: {}, unread: 0, typing: true, next: "2026-11-27T09:00:00Z", messages: [opened(1), opened(2, { reactions: { admin: "♥" } }), opened(3, { kind: "deleted", body: "" }), { id: "pending-x", clientId: "x", pending: true, body: "not yet", createdAt: "2026-11-27T10:00:09Z" }] }],
    pageParams: [null],
  };
  const record = cacheRecord(data, 1000);
  const text = JSON.stringify(record);
  assert(!text.includes("opened words"), "no opened words in what's kept");
  assert(!text.includes("not yet"), "a message still sending isn't kept");
  const [one, two, three] = record.pages[0].messages;
  assert.equal(one.body, "c2VhbGVk");
  assert.deepEqual(two.reactions, { admin: "♥" }, "reactions since are kept");
  assert.deepEqual([three.kind, three.body, three.enc], ["deleted", "", null], "a deleted one is kept only as gone");
  assert.equal(record.pages[0].typing, undefined, 'no stale "typing…"');
  assert.equal(record.pages[0].next, "2026-11-27T09:00:00Z");
});

test("Only the newest three pages are kept, and nothing without a signed-in person", () => {
  rememberRaw([sealed(4)]);
  const page = (i) => ({ me: "admin", next: `cursor-${i}`, messages: [opened(4)] });
  const record = cacheRecord({ pages: [page(0), page(1), page(2), page(3), page(4)], pageParams: [null, "cursor-0", "cursor-1", "cursor-2", "cursor-3"] });
  assert.equal(record.pages.length, 3);
  assert.deepEqual(record.pageParams, [null, "cursor-0", "cursor-1"]);
  assert.equal(cacheRecord({ pages: [{ messages: [] }], pageParams: [null] }), null);
  assert.equal(cacheRecord(null), null);
});

test("A chat file is the same file whatever signed link it came by", () => {
  assert.equal(mediaKey("https://kiriya.love/api/uploads/media?path=chat%2F171-ab.bin&s=AAAAAAAAAAAAAAAAAAAAAA"), "media:chat/171-ab.bin");
  assert.equal(mediaKey("/api/uploads/media?path=chat%2F171-ab.bin"), "media:chat/171-ab.bin");
  assert.equal(mediaKey("/api/uploads/file/chat-0123456789abcdef.bin"), "file:chat-0123456789abcdef.bin");
  assert.equal(mediaKey("https://media.giphy.com/media/x/giphy.mp4"), null);
});
