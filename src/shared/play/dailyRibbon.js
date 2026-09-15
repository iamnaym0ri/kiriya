// Public, light-hearted ribbon copy. Personal note/diary content stays on the server.
import { ribbonMessages } from "./ribbonMessages.js";
const funny = [
  "currently buffering… cutely",
  "tiny dance break. questionable choreography.",
  "miku is the dj. i do not make the rules.",
  "emotionally attached to a fictional apothecary",
  "one more doodle. famous last words.",
  "professional yapper, amateur sleeper",
  "the plot can wait. snack break.",
  "brain has 37 tabs open. one is singing.",
  "herb goblin hours: now open",
  "a very small dance with very big feelings",
  "outfit planning counts as a side quest",
  "the playlist has custody of my attention",
  "somebody supervise the glitter",
  "yes, the sketch has lore",
  "low battery. high standards for snacks.",
  "plot twist: the little guy can boogie",
  "no thoughts. just an unnecessarily good chorus.",
  "wig behaving? suspicious. very suspicious.",
  "the doodle was supposed to take five minutes",
  "this meeting could have been a cat",
  "a minor inconvenience? cue the dramatic soundtrack.",
  "my hobbies have hobbies at this point",
  "just a little creature with a to-do list",
  "herbs acquired. normal behaviour postponed.",
  "the ribbon has no bones but excellent rhythm",
  "another favourite character? room can be made.",
  "the imaginary music video is going SO hard",
  "taking a break from my very busy daydreaming",
  "pink or purple? an unreasonable question.",
  "the tiny committee has voted for cake",
  "running on snacks and oddly specific enthusiasm",
];

const sweet = [
  "little things, ridiculously loved",
  "a soft place for ur very loud imagination",
  "ur unfinished doodles are welcome here",
  "sending a pocket-sized happy dance",
  "a little room to be entirely u",
  "today gets a tiny ribbon too",
  "stay for a song. or three.",
  "all ur lovely little interests fit here",
  "a small hooray for existing today",
  "the world could use ur kind of weird",
  "some days deserve extra pink",
  "ur imagination has a seat saved",
  "a tiny flower for ur scrolling journey",
  "may the next chorus hit just right",
  "a little love tucked between the pixels",
  "soft landing. warm welcome. tiny bow.",
  "u can just hang out. no grand entrance needed.",
  "cheering for the little things u make",
  "something cute for an ordinary day",
  "bring ur doodles and ur dramatic opinions",
  "a small corner with a lot of heart",
  "ur pace is welcome here",
  "a little sparkle for the in-between moments",
  "there is room for another favourite",
  "today’s tiny mission: find a nice little thing",
  "a little chorus of glad ur here",
  "keep a little softness for urself",
  "the little guys are cheering u on",
  "a flower, a song, a small happy thought",
];

const faces = ["(ﾉ´ヮ`)ﾉ*:･ﾟ✧", "♪ ヽ(･ˇ∀ˇ･ゞ)", "(づ｡◕‿‿◕｡)づ", "٩(ˊᗜˋ*)و", "(ง •̀ᴗ•́)ง", "(˘ ³˘)♡", "ヾ(⌐■_■)ノ♪", "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧", "(๑˃ᴗ˂)ﻭ", "(つ≧▽≦)つ", "♪ (ᵔ◡ᵔ) ♪", "(¬_¬)", "(¬‿¬)", "(눈_눈)", "(－_－) zZ", "(>_>)", "(•_•) ..."];
const dancers = [
  { left: "╰", face: "(˶ᵔ ᵕ ᵔ˶)", right: "╯" },
  { left: "ヽ", face: "(≧◡≦)", right: "ﾉ" },
  { left: "٩", face: "(ˊᗜˋ*)", right: "و" },
  { left: "づ", face: "(˘ ³˘)", right: "づ" },
  { left: "♪", face: "(ᵔ◡ᵔ)", right: "ノ" },
  { left: "ง", face: "(•̀ᴗ•́)", right: "ง" },
  { left: "╰", face: "(⌒▽⌒)", right: "╯" },
  { left: "ヽ", face: "(｡◕‿◕｡)", right: "ﾉ" },
  { left: "っ", face: "(˶>ᴗ<˶)", right: "っ" },
  { left: "٩", face: "(๑˃ᴗ˂๑)", right: "و" },
  { left: "ノ", face: "(=^･ω･^=)", right: "ノ" },
  { left: "╰", face: "(˘ᵕ˘)", right: "╯" },
];
const sideFaces = [
  { face: "(¬_¬)", reaction: "side-eye", charm: "..." },
  { face: "(¬‿¬)", reaction: "smug", charm: "✧" },
  { left: "¯\\_", face: "(ツ)", right: "_/¯", reaction: "shrug", charm: "?" },
  { face: "(눈_눈)", reaction: "side-eye", charm: "..." },
  { face: "(－_－)", reaction: "sleepy", charm: "zZ" },
  { face: "(>_>)", reaction: "side-eye", charm: "?" },
  { face: "(￣▽￣)", reaction: "smug", charm: "✧" },
  { left: "┐", face: "(•_•)", right: "┌", reaction: "shrug", charm: "..." },
  { face: "(ಠ_ಠ)", reaction: "side-eye", charm: "!" },
  { face: "(˘-˘)", reaction: "sleepy", charm: "zZ" },
  { face: "(<_<)", reaction: "side-eye", charm: "..." },
  { face: "(¬ᴗ¬)", reaction: "smug", charm: "♡" },
  { left: "╮", face: "(￣へ￣)", right: "╭", reaction: "shrug", charm: "?" },
  { face: "(≖_≖)", reaction: "side-eye", charm: "..." },
  { face: "(－ω－)", reaction: "sleepy", charm: "zZ" },
  { face: "(ಠ‿ಠ)", reaction: "smug", charm: "✧" },
  { left: "┐", face: "(°-°)", right: "┌", reaction: "shrug", charm: "?" },
  { face: "(¬､¬)", reaction: "side-eye", charm: "..." },
];
const steps = ["sway", "hop", "wiggle", "two-step"];
const mod = (n, size) => ((n % size) + size) % size;

export function singaporeDay(now = Date.now()) {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function ribbonMoment(now = Date.now()) {
  const sixHours = 6 * 60 * 60 * 1000, offset = 8 * 60 * 60 * 1000;
  const window = Math.floor((now + offset) / sixHours);
  return { day: singaporeDay(now), slot: mod(window, 4), nextAt: (window + 1) * sixHours - offset };
}

export function dailyRibbon(day = singaporeDay(), { slot = 0, feeling = null } = {}) {
  const index = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const birthday = day.endsWith("-09-15");
  const period = Math.max(0, Math.min(3, Math.trunc(slot) || 0));
  const mood = Object.hasOwn(ribbonMessages, feeling) ? feeling : null;
  const sequence = index * 5 + period * 3;
  const messages = mood
    ? [0, 1, 2].map(offset => ribbonMessages[mood][mod(sequence + offset, ribbonMessages[mood].length)])
    : [funny[mod(sequence, funny.length)], sweet[mod(sequence, sweet.length)], funny[mod(sequence + 15, funny.length)]];
  if (birthday) messages[2] = "Happpppy birthday kiriyaaa!!!";
  return {
    day, birthday, slot: period, feeling: mood, messages,
    face: faces[mod(index, faces.length)],
    dancers: [0, 4, 8].map(offset => dancers[mod(index + offset, dancers.length)]),
    sides: [0, 5, 10].map(offset => sideFaces[mod(index + offset, sideFaces.length)]),
    dance: steps[mod(index, steps.length)],
  };
}
