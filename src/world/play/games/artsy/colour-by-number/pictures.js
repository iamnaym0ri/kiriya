// The pictures, drawn for this game (original line art, 360 × 480 units). Each region is one
// shape to paint, listed bottom to top: a later shape covers the earlier ones it overlaps.
// `c` is the region's number (an index into the palette); `lines` are details drawn over the top.
import { band, blob, cloud, drips, flag, heart, join, place, poly, rect, scallop, smooth, sparkle, star, zee } from "./shapes.js";

const W = 360, H = 480;
const R = (c, d, extra) => ({ c, d, ...extra });

// ---------------------------------------------------------------- tea for two
function teaForTwo() {
  const sag = (x) => 26 + 34 * Math.sin((Math.PI * x) / W);
  const flags = [30, 90, 150, 210, 270, 330].map((x, i) => R([3, 4, 7][i % 3], flag([x - 24, sag(x - 24)], [x + 24, sag(x + 24)], 42)));
  return {
    id: "tea-for-two",
    name: "tea for two",
    blurb: "a cosy cup, a heart biscuit",
    palette: [
      { hex: "#e9dcf7", name: "lilac wall" }, { hex: "#d9a9bb", name: "rosewood" }, { hex: "#fff4e3", name: "cream" },
      { hex: "#f6a9c7", name: "blush" }, { hex: "#b79be0", name: "lavender" }, { hex: "#c99372", name: "tea" },
      { hex: "#ecc684", name: "biscuit" }, { hex: "#a9dcc8", name: "mint" },
    ],
    regions: [
      R(0, rect(0, 0, W, 342)),
      R(1, rect(0, 330, W, 150)),
      R(2, scallop(180, 398, 158, 40, 30, 0.07)),
      ...flags,
      R(6, sparkle(54, 150, 20)), R(6, sparkle(312, 128, 17)), R(7, sparkle(318, 246, 15)),
      R(3, heart(146, 196, 30, -16)), R(7, heart(192, 160, 40, 6)), R(3, heart(236, 206, 24, 18)),
      R(4, blob(180, 382, 124, 26, { seed: 2, wobble: 0.015, n: 14 })),
      R(4, join(blob(284, 300, 36, 32, { seed: 4 }), blob(288, 300, 19, 16, { seed: 5 })), { rule: "evenodd" }),
      R(2, smooth([[88, 250, 1], [95, 300], [118, 346], [180, 374], [242, 346], [265, 300], [272, 250, 1]])),
      R(2, blob(180, 250, 92, 20, { seed: 6, wobble: 0.01, n: 14 })),
      R(5, blob(180, 253, 80, 13, { seed: 7, wobble: 0.015, n: 12 })),
      R(3, heart(138, 312, 26, -10)), R(3, heart(180, 326, 30)), R(3, heart(222, 312, 26, 10)),
      R(6, heart(70, 424, 72, -12)), R(3, heart(70, 421, 36, -12)),
      R(6, blob(300, 428, 40, 31, { seed: 8 })), R(7, blob(300, 425, 25, 18, { seed: 9 })),
    ],
    lines: [
      smooth([[0, sag(0)], [60, sag(60)], [120, sag(120)], [180, sag(180)], [240, sag(240)], [300, sag(300)], [360, sag(360)]], { closed: false }),
      smooth([[160, 236], [152, 226], [160, 216], [152, 206]], { closed: false }),
      smooth([[200, 236], [208, 222], [200, 208], [206, 196]], { closed: false }),
      "M286 410l3 4M306 412l-3 4M296 440l2 4M318 432l-4 2M282 432l4 2",
    ],
  };
}

// ---------------------------------------------------------------- calico nap
function calicoNap() {
  return {
    id: "calico-nap",
    name: "calico nap",
    blurb: "a sleepy kitten on her cushion",
    palette: [
      { hex: "#e4d6f5", name: "lilac" }, { hex: "#ecc6d3", name: "floor" }, { hex: "#f3a6c4", name: "cushion" },
      { hex: "#b18ad9", name: "violet" }, { hex: "#fffaf3", name: "milk" }, { hex: "#f2b27a", name: "marmalade" },
      { hex: "#6a5478", name: "plum" }, { hex: "#ffc2d6", name: "pink nose" }, { hex: "#9ed9c5", name: "mint" },
    ],
    regions: [
      R(0, rect(0, 0, W, 300)),
      R(1, rect(0, 290, W, 190)),
      R(3, `M30 168V100A55 55 0 0 1 140 100V168Z`),
      R(8, `M42 160V102A43 43 0 0 1 128 102V160Z`),
      R(4, sparkle(104, 100, 15)),
      R(2, heart(290, 92, 44, 10)), R(7, heart(244, 146, 24, -12)),
      R(3, blob(180, 404, 172, 56, { seed: 11, n: 16, wobble: 0.02 })),
      R(2, blob(180, 372, 144, 52, { seed: 12, n: 16, wobble: 0.02 })),
      R(3, blob(42, 384, 15, 11, { seed: 13 })), R(3, blob(318, 384, 15, 11, { seed: 14 })),
      R(4, blob(186, 330, 106, 52, { seed: 15, n: 14, wobble: 0.025 })),
      R(6, blob(226, 312, 34, 24, { seed: 16 })), R(5, blob(256, 346, 20, 15, { seed: 17 })),
      R(5, band([[100, 352], [130, 376], [182, 386], [238, 378], [268, 356]], [16, 10])),
      R(4, poly([[72, 292], [82, 238], [116, 270]])), R(4, poly([[126, 268], [154, 236], [168, 288]])),
      R(7, poly([[84, 280], [88, 254], [104, 272]])), R(7, poly([[136, 270], [150, 252], [156, 280]])),
      R(4, blob(120, 306, 52, 44, { seed: 18, n: 12, wobble: 0.02 })),
      R(5, blob(142, 290, 24, 19, { seed: 19 })),
      R(7, heart(120, 320, 15)),
      R(7, blob(96, 324, 9, 6, { seed: 20 })), R(7, blob(146, 324, 9, 6, { seed: 21 })),
      R(4, blob(98, 350, 18, 12, { seed: 22 })), R(4, blob(134, 354, 18, 12, { seed: 23 })),
      R(8, blob(304, 428, 34, 33, { seed: 24 })),
      R(3, zee(142, 194, 28)), R(3, zee(178, 162, 23, 4)), R(3, zee(208, 134, 19, -12)),
    ],
    lines: [
      "M86 100H128M85 128H128", // window panes
      "M42 131H128M85 102V160",
      smooth([[94, 306], [102, 311], [110, 306]], { closed: false }),
      smooth([[130, 306], [138, 311], [146, 306]], { closed: false }),
      smooth([[114, 327], [120, 331], [126, 327]], { closed: false }),
      "M86 318l-22-4M86 324l-22 3M154 318l22-4M154 324l22 3",
      smooth([[278, 410], [300, 400], [322, 420]], { closed: false }),
      smooth([[284, 438], [304, 422], [330, 430]], { closed: false }),
      smooth([[272, 432], [240, 444], [210, 430], [186, 440]], { closed: false }),
      "M92 352v6M104 352v6M128 356v6M140 356v6",
    ],
  };
}

// ---------------------------------------------------------------- pointe shoes
function pointeShoes() {
  // A pair hanging toe-down from a ribbon bow, in front of the curtain.
  const outline = [[-28, -96], [0, -104], [27, -98], [38, -74], [38, -36], [30, 14], [20, 56], [12, 88], [7, 100, 1], [-7, 100, 1], [-14, 88], [-22, 56], [-32, 10], [-38, -40], [-38, -76]];
  const shoe = (cx, cy, rot) => {
    const at = (x, y) => place([[x, y]], cx, cy, rot)[0];
    const [ox, oy] = at(0, -90);
    return {
      ribbons: [at(-26, -88), at(26, -90)],
      regions: [
        R(3, smooth(place(outline, cx, cy, rot))),
        R(4, blob(ox, oy, 29, 10, { seed: Math.round(cx), rot, wobble: 0.01, n: 12 })),
        R(4, band(place([[-35, -36], [-30, 12], [-21, 54], [-13, 86]], cx, cy, rot), 10)),
        R(4, smooth(place([[-8, 94, 1], [8, 94, 1], [8, 104], [0, 107], [-8, 104]], cx, cy, rot))),
      ],
      line: smooth(place([[-34, -74], [0, -66], [36, -72]], cx, cy, rot), { closed: false }),
    };
  };
  const left = shoe(136, 300, 9), right = shoe(224, 316, -7);
  const bow = [180, 108];
  const ribbon = ([x, y], [bx, by], bend) => R(5, band([[x, y], [(x + bx) / 2 + bend, (y + by) / 2], [bx, by]], 10));
  const curtain = [[0, 0, 1], [124, 0, 1], [108, 64], [84, 150], [62, 250], [44, 330, 1], [0, 330, 1]];
  const valance = [[0, 0, 1], [W, 0, 1]];
  for (let k = 0; k <= 12; k++) valance.push([W - k * 30, k % 2 ? 50 : 34, k % 2 ? 0 : 1]);
  return {
    id: "pointe-shoes",
    name: "pointe shoes",
    blurb: "ribbons tied, curtain up",
    palette: [
      { hex: "#efe3fa", name: "lilac" }, { hex: "#9f78c9", name: "velvet" }, { hex: "#e7c7a6", name: "stage floor" },
      { hex: "#f7b8cf", name: "satin" }, { hex: "#d9799f", name: "rose" }, { hex: "#c9b1ee", name: "ribbon" },
      { hex: "#f3c969", name: "gold" }, { hex: "#fff1c9", name: "spotlight" },
    ],
    regions: [
      R(0, rect(0, 0, W, 330)),
      R(2, rect(0, 320, W, 160)),
      R(7, blob(180, 420, 150, 40, { seed: 31, n: 16, wobble: 0.015 })),
      R(1, smooth(curtain)),
      R(1, smooth(place(curtain, W, 0, 0, 1, true))),
      R(4, smooth(valance)),
      R(6, blob(76, 190, 15, 10, { seed: 32 })), R(6, blob(284, 190, 15, 10, { seed: 33 })),
      ribbon(left.ribbons[0], [170, 114], -10), ribbon(left.ribbons[1], [176, 118], 4),
      ribbon(right.ribbons[0], [184, 118], -4), ribbon(right.ribbons[1], [190, 114], 10),
      ...left.regions,
      ...right.regions,
      R(3, poly([[172, 112], [150, 164], [164, 158], [170, 170], [180, 116]])), R(3, poly([[188, 112], [210, 164], [196, 158], [190, 170], [180, 116]])),
      R(3, blob(150, bow[1] - 2, 30, 18, { seed: 34, rot: -18 })), R(3, blob(210, bow[1] - 2, 30, 18, { seed: 35, rot: 18 })),
      R(4, blob(bow[0], bow[1], 11, 12, { seed: 36 })),
      R(6, sparkle(112, 86, 17)), R(6, sparkle(290, 250, 18)), R(6, sparkle(82, 262, 14)), R(6, sparkle(298, 84, 15)),
    ],
    lines: [
      "M0 360H360M0 404H360M0 452H360",
      smooth([[40, 96], [60, 180], [52, 280]], { closed: false }),
      smooth([[320, 96], [300, 180], [308, 280]], { closed: false }),
      left.line,
      right.line,
    ],
  };
}

// ---------------------------------------------------------------- lilac moon
function lilacMoon() {
  return {
    id: "lilac-moon",
    name: "lilac moon",
    blurb: "a little house, a big quiet night",
    palette: [
      { hex: "#4b3478", name: "night" }, { hex: "#fff0b8", name: "moonlight" }, { hex: "#d8c6f2", name: "cloud" },
      { hex: "#8e6fc2", name: "far hills" }, { hex: "#a5c99a", name: "meadow" }, { hex: "#fbe3ec", name: "cottage" },
      { hex: "#e486ad", name: "roof" }, { hex: "#ffd88a", name: "glow" },
    ],
    regions: [
      R(0, rect(0, 0, W, H)),
      R(1, star(70, 70, 17, 9)), R(1, star(140, 40, 13, 7)), R(1, sparkle(330, 214, 15)), R(1, sparkle(36, 172, 14)), R(1, star(176, 132, 12, 6)),
      R(1, blob(250, 108, 56, 56, { seed: 41, wobble: 0.015, n: 14 })),
      R(2, blob(232, 92, 11, 9, { seed: 42 })), R(2, blob(268, 124, 14, 11, { seed: 43 })), R(2, blob(246, 136, 7, 6, { seed: 44 })),
      R(2, cloud(300, 170, 96, 30, 3, 45)),
      R(3, smooth([[0, 332, 1], [60, 312], [130, 300], [220, 326], [300, 300], [360, 288, 1], [360, 480, 1], [0, 480, 1]])),
      R(5, rect(55, 316, 12, 24, 3)), R(4, blob(61, 296, 25, 30, { seed: 46 })),
      R(5, rect(146, 326, 11, 18, 3)), R(4, blob(151, 312, 19, 22, { seed: 47 })),
      R(2, cloud(108, 232, 150, 44, 4, 48)), R(2, cloud(262, 262, 112, 34, 3, 49)),
      R(4, smooth([[0, 404, 1], [90, 372], [200, 394], [290, 370], [360, 360, 1], [360, 480, 1], [0, 480, 1]])),
      R(5, band([[290, 392], [272, 418], [236, 448], [214, 486]], [14, 34])),
      R(6, rect(290, 290, 12, 30, 2)),
      R(5, rect(236, 330, 70, 62, 3)),
      R(6, smooth([[224, 336, 1], [271, 286, 1], [318, 336, 1]])),
      R(7, rect(250, 348, 20, 20, 3)), R(3, rect(280, 356, 17, 36, 7)), R(7, blob(271, 318, 8, 8, { seed: 50 })),
      R(7, blob(40, 432, 8, 8, { seed: 51 })), R(7, blob(92, 452, 7, 7, { seed: 52 })), R(7, blob(160, 424, 8, 8, { seed: 53 })), R(7, blob(330, 446, 7, 7, { seed: 54 })),
    ],
    lines: ["M260 348V368M250 358H270", "M293 376h1"],
  };
}

// ---------------------------------------------------------------- birthday cake
function birthdayCake() {
  const sag = (x) => 22 + 28 * Math.sin((Math.PI * x) / W);
  const flags = [36, 108, 180, 252, 324].map((x, i) => R([4, 7, 6][i % 3], flag([x - 28, sag(x - 28)], [x + 28, sag(x + 28)], 44)));
  const berry = [[0, -14], [14, -10], [12, 6], [0, 18, 1], [-12, 6], [-14, -10]];
  const flame = [[0, -16, 1], [7, -2], [5, 6], [0, 8], [-5, 6], [-7, -2]];
  return {
    id: "birthday-cake",
    name: "birthday cake",
    blurb: "two tiers, three strawberries",
    palette: [
      { hex: "#f3e6fb", name: "lilac" }, { hex: "#c3a3e3", name: "table" }, { hex: "#e6f1f7", name: "china" },
      { hex: "#fff1d9", name: "sponge" }, { hex: "#f7a8c8", name: "pink icing" }, { hex: "#e8577f", name: "strawberry" },
      { hex: "#8fcf9c", name: "leaf" }, { hex: "#c7b2f0", name: "lilac icing" }, { hex: "#ffcf6b", name: "flame" },
    ],
    regions: [
      R(0, rect(0, 0, W, 360)),
      R(1, rect(0, 350, W, 130)),
      ...flags,
      R(8, sparkle(48, 172, 16)), R(6, blob(312, 178, 9, 9, { seed: 61 })), R(4, sparkle(304, 96, 15)), R(7, blob(58, 252, 8, 8, { seed: 62 })), R(8, star(330, 262, 13, 7)),
      R(2, scallop(180, 394, 152, 28, 26, 0.06)),
      R(3, rect(70, 290, 220, 100, 14)),
      R(4, drips(66, 294, 284, 304, 7, 63)),
      R(7, heart(112, 356, 22)), R(7, heart(180, 362, 24)), R(7, heart(248, 356, 22)),
      R(3, rect(110, 210, 140, 82, 12)),
      R(7, drips(106, 254, 204, 222, 5, 64)),
      R(7, rect(144, 146, 12, 62, 4)), R(7, rect(204, 146, 12, 62, 4)),
      R(8, smooth(place(flame, 150, 130))), R(8, smooth(place(flame, 210, 130))),
      R(5, smooth(place(berry, 124, 196))), R(5, smooth(place(berry, 180, 190, 0, 1.1))), R(5, smooth(place(berry, 236, 196))),
      R(6, star(124, 181, 11, 5.5)), R(6, star(180, 174, 12, 6)), R(6, star(236, 181, 11, 5.5)),
    ],
    lines: [
      smooth([[0, sag(0)], [72, sag(72)], [144, sag(144)], [216, sag(216)], [288, sag(288)], [360, sag(360)]], { closed: false }),
      "M144 162l12-6M144 178l12-6M144 194l12-6M204 162l12-6M204 178l12-6M204 194l12-6",
      "M120 194l1 1M128 200l1 1M176 188l1 1M184 196l1 1M232 194l1 1M240 200l1 1",
    ],
  };
}

// ---------------------------------------------------------------- potion shelf
function potionShelf() {
  const leaf = (cx, cy, rot, size = 1, seed = 1) => blob(cx, cy, 8 * size, 16 * size, { seed, rot, n: 8, wobble: 0.04 });
  return {
    id: "potion-shelf",
    name: "potion shelf",
    blurb: "tonics, herbs and a crystal ball",
    palette: [
      { hex: "#ece0f8", name: "lilac" }, { hex: "#d9a88f", name: "wood" }, { hex: "#e8f4fb", name: "glass" },
      { hex: "#a67ddb", name: "violet tonic" }, { hex: "#8fd6c0", name: "mint tonic" }, { hex: "#f59ac0", name: "rose tonic" },
      { hex: "#c99a6b", name: "cork" }, { hex: "#fff3da", name: "label" }, { hex: "#9cc98a", name: "herb" },
    ],
    regions: [
      R(0, rect(0, 0, W, H)),
      R(8, leaf(46, 44, -60, 1, 71)), R(8, leaf(116, 60, 50, 1, 72)), R(8, leaf(182, 56, -40, 1.1, 73)), R(8, leaf(248, 58, 60, 1, 74)), R(8, leaf(316, 42, -50, 1, 75)),
      R(1, poly([[54, 214], [76, 214], [60, 244]])), R(1, poly([[284, 214], [306, 214], [300, 244]])),
      R(1, rect(20, 200, 320, 16, 4)),
      R(2, rect(78, 100, 24, 30, 4)),
      R(2, blob(90, 160, 40, 38, { seed: 76, wobble: 0.01, n: 12 })),
      R(3, blob(90, 166, 35, 30, { seed: 77, from: 0, to: 180, n: 12, wobble: 0.005 })),
      R(7, rect(70, 150, 40, 18, 3)),
      R(6, rect(80, 88, 20, 16, 4)),
      R(2, rect(170, 82, 20, 34, 4)),
      R(2, rect(156, 110, 48, 90, 10)),
      R(4, rect(160, 140, 40, 56, 8)),
      R(7, heart(180, 162, 24)),
      R(6, rect(168, 68, 24, 16, 5)),
      R(2, rect(262, 112, 16, 28, 3)),
      R(2, heart(270, 164, 78)),
      R(5, heart(270, 172, 54)),
      R(6, rect(260, 100, 20, 14, 4)),
      R(1, poly([[54, 398], [76, 398], [60, 428]])), R(1, poly([[284, 398], [306, 398], [300, 428]])),
      R(1, rect(20, 384, 320, 16, 4)),
      R(8, leaf(72, 292, -30, 1.6, 78)), R(8, leaf(110, 290, 28, 1.6, 79)), R(8, leaf(90, 272, -4, 1.5, 80)), R(8, leaf(124, 312, 58, 1.3, 81)),
      R(6, poly([[52, 332], [118, 332], [110, 384], [60, 384]])),
      R(6, rect(46, 322, 78, 14, 5)),
      R(3, rect(150, 356, 92, 28, 3)), R(5, rect(158, 330, 78, 26, 3)), R(4, rect(152, 306, 86, 24, 3)),
      R(2, blob(196, 282, 24, 24, { seed: 82, wobble: 0.01 })), R(3, sparkle(196, 282, 14)),
      R(2, rect(282, 292, 20, 24, 4)),
      R(2, blob(292, 346, 36, 40, { seed: 83, wobble: 0.01, n: 12 })),
      R(4, blob(292, 352, 31, 31, { seed: 84, from: 0, to: 180, n: 12, wobble: 0.005 })),
      R(7, star(292, 340, 14)),
      R(6, rect(280, 280, 24, 14, 5)),
    ],
    lines: [
      smooth([[0, 26], [60, 46], [120, 54], [180, 56], [240, 54], [300, 46], [360, 26]], { closed: false }),
      "M168 306V330M222 306V330M170 330V356M224 330V356M164 356V384M228 356V384",
      smooth([[88, 330], [90, 300], [92, 280]], { closed: false }),
    ],
  };
}

export const PICTURES = [teaForTwo(), calicoNap(), pointeShoes(), lilacMoon(), birthdayCake(), potionShelf()].map((picture) => ({
  width: W,
  height: H,
  ...picture,
}));

export const pictureById = (id) => PICTURES.find((picture) => picture.id === id) ?? null;
