// A small visual colour game, separate from the studio's pigment mixer.
export const PALETTE_ROUNDS = [
  {
    name: "Birthday lilac",
    hint: "A little rose tucked into lavender.",
    a: "#9774d6",
    b: "#f3afd0",
    target: 35,
    emoji: "🎀",
  },
  {
    name: "Miku mint",
    hint: "Teal twin tails meet a little cream.",
    a: "#218c8e",
    b: "#f6efc8",
    target: 60,
    emoji: "🫧",
  },
  {
    name: "Maomao rose",
    hint: "A plum ribbon, softened with blossom pink.",
    a: "#643d70",
    b: "#f4c6da",
    target: 70,
    emoji: "🌷",
  },
];
export const PALETTE_PASS_SCORE = 95;
export function newPaletteRounds(random = Math.random) {
  // Keep every target away from the starting midpoint and the hard-to-see extremes.
  const targets = Array.from({ length: 51 }, (_, i) => i + 25).filter(amount => Math.abs(amount - 50) >= 9);
  return PALETTE_ROUNDS.map(round => ({ ...round, target: targets[Math.floor(random() * targets.length)] }));
}
export function blendColour(a, b, amount) {
  const part = (hex, i) => parseInt(hex.slice(i, i + 2), 16);
  const t = Math.max(0, Math.min(100, Number(amount))) / 100;
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(part(a, i) * (1 - t) + part(b, i) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function matchScore(amount, target) {
  return Math.max(0, Math.round(100 - Math.abs(amount - target) * 1.6));
}
