// Odd jar: every shelf is a row of Maomao's jars that match in every detail but one jar, which
// differs in exactly one. Shelves grow (4, 6, 9, 12 jars), the details get smaller, and from the
// tenth shelf the jars wobble on the shelf, which means nothing (a red herring to ignore).

export const HEARTS = 3;

export const DETAILS = {
  label: { values: ["leaf", "flower", "mushroom", "heart"], from: 1, hint: "Read the pictures on the labels." },
  liquid: { values: ["lilac", "pink", "mint", "honey"], from: 1, hint: "Compare what's inside. One brew is a different colour." },
  ribbon: { values: ["none", "bow"], from: 3, hint: "Look at the necks. Someone tied a ribbon on one." },
  seal: { values: ["none", "round", "diamond"], from: 3, hint: "Look at the little wax seal on each neck." },
  cork: { values: [1, 2], from: 6, hint: "Ignore the labels. Count the lines across each cork." },
  dots: { values: [2, 3], from: 6, hint: "Look below the label. Count the wax dots." },
  flip: { values: [false, true], from: 6, hint: "Follow the tips of the leaves. One points the other way." },
};

export const jarCount = (level) => (level <= 2 ? 4 : level <= 5 ? 6 : level <= 9 ? 9 : 12);
export const wobbles = (level) => level >= 10;

const pick = (list, random) => list[Math.floor(random() * list.length)];

/** One shelf: the jar every jar looks like, the odd one's difference, where it sits, the wobbles. */
export function newShelf(level, random = Math.random) {
  const count = jarCount(level);
  const open = Object.entries(DETAILS).filter(([, d]) => level >= d.from).map(([name]) => name);
  // Newly opened details come up more often on the shelves that introduce them.
  const fresh = open.filter((name) => DETAILS[name].from === (level >= 6 ? 6 : level >= 3 ? 3 : 1));
  const kind = random() < 0.45 && fresh.length ? pick(fresh, random) : pick(open, random);
  const base = Object.fromEntries(Object.entries(DETAILS).map(([name, d]) => [name, pick(d.values, random)]));
  base.flip = false;
  if (kind === "flip") base.label = "leaf";
  // Details she hasn't met yet stay at their plainest.
  if (level < DETAILS.ribbon.from) base.ribbon = "none";
  if (level < DETAILS.seal.from) base.seal = "none";
  if (level < DETAILS.cork.from) base.cork = 1;
  if (level < DETAILS.dots.from) base.dots = 2;
  const others = DETAILS[kind].values.filter((v) => v !== base[kind]);
  const odd = { ...base, [kind]: pick(others, random) };
  const wobble = Array.from({ length: count }, () => (wobbles(level) ? Math.round((random() * 2 - 1) * 8) : 0));
  return { level, count, kind, base, odd, at: Math.floor(random() * count), wobble, missed: [], hint: false, phase: "look" };
}

export function newRun(random = Math.random) {
  return { level: 1, hearts: HEARTS, shelf: newShelf(1, random), clues: 0, event: "welcome", talk: 0 };
}

/** A tap on jar `index`: found it, or a heart spent. */
export function inspect(run, index) {
  const { shelf } = run;
  if (shelf.phase !== "look" || shelf.missed.includes(index) || index < 0 || index >= shelf.count) return run;
  if (index === shelf.at) return { ...run, shelf: { ...shelf, phase: "found" }, event: "found", talk: run.talk + 1 };
  const hearts = run.hearts - 1;
  return {
    ...run,
    hearts,
    shelf: { ...shelf, missed: [...shelf.missed, index], phase: hearts <= 0 ? "over" : "look" },
    event: hearts <= 0 ? "over" : "retry",
    talk: run.talk + 1,
  };
}

export function nextShelf(run, random = Math.random) {
  if (run.shelf.phase !== "found") return run;
  return { ...run, level: run.level + 1, shelf: newShelf(run.level + 1, random), event: "next", talk: run.talk + 1 };
}

export function clue(run) {
  if (run.shelf.phase !== "look" || run.shelf.hint) return run;
  return { ...run, clues: run.clues + 1, shelf: { ...run.shelf, hint: true }, event: "hint", talk: run.talk + 1 };
}
