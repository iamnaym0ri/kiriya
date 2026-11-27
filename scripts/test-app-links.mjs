// Every old website link lands on the right tab in the iPhone app (src/lib/appLinks.js,
// docs/refactor/RENOVATION.md "Deep links in the app").
import assert from "node:assert/strict";
import { test } from "node:test";
import { appPath, tabOf } from "../src/lib/appLinks.js";

test("Notification, widget and shortcut paths land on the right tab", () => {
  const cases = [
    ["/world/notes?open=abc-1", "/world/mail?note=abc-1", "mail"],
    ["/world/letters?open=42", "/world/mail?letter=42", "mail"],
    ["/world/notes", "/world/notes", "mail"],
    ["/world/letters", "/world/letters", "mail"],
    ["/world#letters-hub", "/world/mail", "mail"],
    ["/world#note-jar", "/world/mail#note-jar", "mail"],
    ["/world?event=sg%20con#events", "/world/events/sg%20con", "home"],
    ["/world#events", "/world/events", "home"],
    ["/world/events/abc", "/world/events/abc", "home"],
    ["/world/saves", "/world/saves", "home"],
    ["/world/merch", "/world/merch", "home"],
    ["/world#play-desk", "/world/play", "play"],
    ["/world?gallery=1&doodle=d1#play-desk", "/world/play?doodle=d1&gallery=1", "play"],
    ["/world?paint=%23fff#play-desk", "/world/play?paint=%23fff", "play"],
    ["/world/settings", "/world/me", "me"],
    ["/world/settings?tab=phone#widgets", "/world/me?tab=phone#widgets", "me"],
    ["/world/chat", "/world/chat", "chat"],
    ["/world/memories", "/world/memories", "chat"],
    ["/world/art", "/world/art", "play"],
    ["/world?quick=status", "/world?quick=status", "home"],
    ["/world", "/world", "home"],
    ["/world/", "/world", "home"],
    ["/world/mail#note-jar", "/world/mail#note-jar", "mail"],
  ];
  for (const [from, to, tab] of cases) {
    assert.equal(appPath(from), to, from);
    assert.equal(tabOf(new URL(to, "https://x").pathname), tab, to);
  }
});

test("Location objects map too, and unchanged paths stay identical", () => {
  assert.equal(appPath({ pathname: "/world", search: "", hash: "#note-jar" }), "/world/mail#note-jar");
  assert.equal(appPath({ pathname: "/world/play", search: "?game=herb-match", hash: "" }), "/world/play?game=herb-match");
});
