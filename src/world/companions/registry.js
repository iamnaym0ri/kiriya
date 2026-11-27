// Every companion character, found by folder (docs/refactor/RENOVATION.md, "Companions"): each
// `characters/<id>/index.js` default-exports the character. Loaded on demand, so only the one she
// picked (and a visitor) is ever downloaded. Folders starting with "_" are dev-only.
import { COMPANIONS } from "../../../shared/companions.js";

const modules = import.meta.glob("./characters/*/index.js");

const loaders = Object.fromEntries(
  Object.entries(modules).map(([path, load]) => [path.split("/")[2], load]),
);

/** The ids that have a character folder, in the order of shared/companions.js (dev ones last). */
export const availableCompanions = () => [
  ...COMPANIONS.map((companion) => companion.id).filter((id) => loaders[id]),
  ...(import.meta.env.DEV ? Object.keys(loaders).filter((id) => id.startsWith("_")) : []),
];

/** Loads one character (the module's default export), or null if it has no folder yet. */
export async function loadCompanion(id) {
  const load = loaders[id];
  if (!load) return null;
  return (await load()).default;
}
