import test from "node:test";
import assert from "node:assert/strict";
import { drawingHistory, groupArtworksByDate } from "../src/world/studio/drawingTools.js";

test("Gallery groups and orders saved pages across Singapore midnight without changing the source", () => {
  const works = [
    { id: "a", createdAt: "2026-09-14T15:59:59Z" },
    { id: "c", createdAt: "2026-09-15T04:00:00Z" },
    { id: "b", createdAt: "2026-09-14T16:00:00Z" },
  ];
  const before = JSON.stringify(works);
  const groups = groupArtworksByDate(works);
  assert.deepEqual(groups.map(group => [group.key, group.artworks.map(art => art.id)]), [["2026-09-15", ["c", "b"]], ["2026-09-14", ["a"]]]);
  assert.equal(groups[0].label, "15 September 2026");
  assert.equal(JSON.stringify(works), before);
  assert.deepEqual(groupArtworksByDate([]), []);
  assert.equal(groupArtworksByDate([{ id: "legacy", createdAt: "missing" }])[0].label, "Earlier pages");
});

test("Clearing a drawing hides old ink while retaining one-step undo and redo", () => {
  const marks = [{ tool: "pen" }, { tool: "heart" }];
  const cleared = [...marks, { tool: "clear" }];
  assert.deepEqual(drawingHistory(cleared), { count: 0, canUndo: true, canRedo: false });
  assert.deepEqual(drawingHistory(marks, [{ tool: "clear" }]), { count: 2, canUndo: true, canRedo: true });
  assert.deepEqual(drawingHistory([...cleared, { tool: "marker" }]), { count: 1, canUndo: true, canRedo: false });
  assert.deepEqual(drawingHistory([], marks), { count: 0, canUndo: false, canRedo: true });
});
