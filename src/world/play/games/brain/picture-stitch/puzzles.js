// The picture set. Each picture is drawn as text: "." is plain cloth, a letter is a stitch in that
// thread colour. Every one is checked (scripts/test-games-brain.mjs) to have a single answer that
// the row and column clues lead to on their own, no guessing.

export const THREADS = {
  P: "#f2a3c6", // blossom pink
  R: "#ec7f9f", // strawberry
  L: "#b38bd3", // lilac
  N: "#8a5fa6", // plum
  Y: "#f4cf6a", // honey
  W: "#fff3ea", // cream
  G: "#86bd78", // leaf
  K: "#f2b98c", // kitty
  D: "#6c5277", // ink
  B: "#9db3ee", // periwinkle
};

export const PICTURES = [
  { id: "heart", name: "a little heart", art: [".P.P.", "PPPPP", "PPPPP", ".PPP.", "..P.."] },
  { id: "star", name: "a wishing star", art: ["..Y..", ".YYY.", "YYYYY", ".YYY.", ".Y.Y."] },
  { id: "mushroom", name: "a tiny mushroom", art: [".LLL.", "LLLLL", "L.L.L", "..W..", ".WWW."] },
  { id: "kitty", name: "a sleepy kitty", art: ["K...K", "KK.KK", "KKKKK", "K.K.K", ".KKK."] },
  { id: "teacup", name: "a cup of tea", art: [".L..L...", "..L..L..", ".L..L...", "PPPPPPP.", "PPPPPP.P", "PPPPPPP.", ".PPPPP..", "NNNNNNNN"] },
  { id: "bow", name: "a ribbon bow", art: ["........", "PP....PP", "PPP..PPP", "PPPNNPPP", "PPPNNPPP", "PPP..PPP", "PP.PP.PP", "...PP..."] },
  { id: "bunny", name: "a bunny", art: [".W....W.", ".WW..WW.", "..W..W..", ".WWWWWW.", "WW.WW.WW", "WWWWWWWW", "WWWPPWWW", ".WWWWWW."] },
  { id: "moon", name: "the moon and a star", art: ["..YYYY..", ".YYY....", "YYY.....", "YY....B.", "YY...BBB", "YYY...B.", ".YYY....", "..YYYY.."] },
  { id: "cat", name: "a calico cat", art: [".K......K.", ".KK....KK.", ".KKKKKKKK.", "KKKKKKKKKK", "KD.KKKK.DK", "KK.KKKK.KK", "KKKKPPKKKK", ".KKKKKKKK.", "..KKKKKK..", "...KKKK..."] },
  { id: "strawberry", name: "a strawberry", art: ["....GG....", "..GGGGGG..", ".RRRGGRRR.", "RRRRRRRRRR", "RR.RRRR.RR", "RRRRRRRRRR", ".RRR.RRRR.", "..RRRRRR..", "...RRRR...", "....RR...."] },
  { id: "lilac", name: "a sprig of lilac", art: ["..LLL.....", ".LLLLL....", "LLLNLLL...", ".LLLLL....", "..LLL.GG..", "...G.GGG..", "...GGG....", "...G......", "..GG......", ".GG......."] },
  { id: "letter", name: "a love letter", art: ["LLLLLLLLLL", "LL......LL", "L.LL..LL.L", "L...LL...L", "L..P..P..L", "L.PPPPPP.L", "L..PPPP..L", "L...PP...L", "L........L", "LLLLLLLLLL"] },
];

/** The clue numbers for one line of 0/1 cells. */
export function hintsFor(cells) {
  const hints = [];
  let run = 0;
  for (const cell of cells) {
    if (cell === 1) run += 1;
    else if (run) {
      hints.push(run);
      run = 0;
    }
  }
  if (run) hints.push(run);
  return hints;
}

/** A picture as a puzzle: size, the answer (1/0), the thread colour of each cell, and the clues. */
export function toPuzzle(picture) {
  const h = picture.art.length;
  const w = picture.art[0].length;
  const colours = picture.art.join("").split("").map((ch) => THREADS[ch] ?? null);
  const solution = colours.map((c) => (c ? 1 : 0));
  const rows = Array.from({ length: h }, (_, r) => hintsFor(solution.slice(r * w, r * w + w)));
  const cols = Array.from({ length: w }, (_, c) => hintsFor(Array.from({ length: h }, (_, r) => solution[r * w + c])));
  return { id: picture.id, name: picture.name, w, h, solution, colours, rows, cols };
}

export const PUZZLES = PICTURES.map(toPuzzle);
