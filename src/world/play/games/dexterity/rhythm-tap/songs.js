// Three original chiptune loops, written for this game (no existing songs, no lyrics).
// Melodies are 8th notes: a note name starts a note, "-" holds it, "." rests; "|" is only a bar line.
// Chords name each bar (a trailing "m" is minor). Drums are 16-step patterns per bar.

export const SONGS = [
  {
    id: "teal-morning",
    title: "teal morning",
    mood: "sunny and easy",
    bpm: 100,
    intro: ["C", "G"],
    outro: ["C"],
    sections: [
      {
        name: "A",
        chords: ["C", "G", "Am", "F", "C", "G", "Am", "F"],
        melody: `E5 - G5 - A5 G5 E5 - | D5 - - - B4 - D5 - | C5 - E5 - A5 - G5 E5 | F5 - E5 - D5 - . . |
                 E5 - G5 - C6 - B5 A5 | G5 - D5 - G5 - A5 B5 | C6 - B5 A5 G5 - E5 - | F5 - A5 - G5 - - .`,
      },
      {
        name: "B",
        chords: ["F", "G", "Em", "Am", "F", "G", "C", "C"],
        arp: true,
        melody: `A4 - C5 - F5 - E5 - | D5 - B4 - G4 - B4 D5 | E5 - G5 - B5 - G5 - | A5 - - - E5 - C5 - |
                 F5 - A5 - C6 - A5 F5 | G5 - B5 - D6 - B5 G5 | C6 - G5 - E5 - G5 - | C6 - - - . . . .`,
      },
      { repeat: "A", arp: true },
    ],
    drums: { kick: "x.......x.x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." },
    bass: "R.R.5.R.",
    lead: 0.25,
  },
  {
    id: "twin-tail-skip",
    title: "twin-tail skip",
    mood: "bouncy, a little cheeky",
    bpm: 120,
    intro: ["Dm", "Bb"],
    outro: ["Dm"],
    sections: [
      {
        name: "A",
        chords: ["Dm", "Bb", "C", "F", "Dm", "Bb", "C", "A"],
        melody: `D5 - F5 A5 - F5 D5 - | D5 - F5 Bb5 - A5 F5 - | E5 - G5 C6 - G5 E5 G5 | A5 - - . F5 - A5 - |
                 D6 - C6 A5 - F5 A5 - | Bb5 - A5 F5 - D5 F5 - | G5 - E5 G5 - C6 Bb5 - | A5 - C#6 - E6 - . .`,
      },
      {
        name: "B",
        chords: ["Bb", "C", "Am", "Dm", "Bb", "C", "A", "A"],
        arp: true,
        melody: `F5 . F5 . D5 - F5 - | G5 . G5 . E5 - G5 - | A5 - E5 - C5 - E5 A5 | F5 - D5 - A4 - D5 - |
                 Bb5 - - A5 - F5 - D5 | C6 - - Bb5 - G5 - E5 | E5 - A5 - C#6 - E6 - | E6 - . . A5 . . .`,
      },
      { repeat: "A", arp: true },
    ],
    drums: { kick: "x..x..x...x..x..", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.xx" },
    bass: "RR.R.R5.",
    lead: 0.125,
  },
  {
    id: "starlight-soda",
    title: "starlight soda",
    mood: "fizzy and fast",
    bpm: 138,
    intro: ["G", "D"],
    outro: ["G"],
    sections: [
      {
        name: "A",
        chords: ["G", "D", "Em", "C", "G", "D", "C", "D"],
        melody: `B5 - D6 - B5 A5 G5 - | A5 - F#5 - D5 - A5 - | G5 - E5 - B5 - A5 G5 | E5 - G5 - C6 - B5 - |
                 D6 - B5 G5 D6 - B5 G5 | F#5 - A5 D6 - A5 F#5 - | E5 G5 C6 - B5 - G5 - | A5 - D6 - F#6 - . .`,
      },
      {
        name: "B",
        chords: ["Em", "C", "G", "D", "Em", "C", "D", "D"],
        arp: true,
        melody: `E6 - D6 B5 - G5 B5 - | C6 - B5 G5 - E5 G5 - | D6 - B5 D6 G6 - D6 - | F#6 - E6 D6 - A5 F#5 - |
                 G5 B5 E6 - G5 B5 E6 - | G5 C6 E6 - G5 C6 E6 - | F#5 A5 D6 - F#6 - E6 D6 | D6 - - - . . . .`,
      },
      { repeat: "A", arp: true },
    ],
    drums: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x." },
    bass: "R.RR.R5R",
    lead: 0.25,
  },
];

export const songById = (id) => SONGS.find((song) => song.id === id) ?? SONGS[0];

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#6" → MIDI number (C4 = 60). */
export function midi(name) {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`not a note: ${name}`);
  return 12 * (Number(match[3]) + 1) + NOTE[match[1]] + (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0);
}

/** "Bb" → { root: 10, minor: false } (root as a pitch class). */
export function chord(name) {
  const match = /^([A-G])(#|b)?(m?)$/.exec(name);
  if (!match) throw new Error(`not a chord: ${name}`);
  const root = (NOTE[match[1]] + (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0) + 12) % 12;
  return { root, minor: match[3] === "m" };
}

/**
 * The whole song as a flat list of bars: { chord, melody: [8 tokens], arp, section }.
 * Intro and outro bars have no melody.
 */
export function arrange(song) {
  const bars = [];
  const named = {};
  for (const name of song.intro) bars.push({ chord: name, melody: null, arp: false, section: "intro" });
  for (const section of song.sections) {
    const source = section.repeat ? named[section.repeat] : section;
    if (!section.repeat) named[section.name] = section;
    const tokens = source.melody.replace(/\|/g, " ").trim().split(/\s+/);
    if (tokens.length !== source.chords.length * 8) throw new Error(`${song.id} ${source.name}: ${tokens.length} melody steps for ${source.chords.length} bars`);
    source.chords.forEach((name, i) => {
      bars.push({ chord: name, melody: tokens.slice(i * 8, i * 8 + 8), arp: !!(section.arp ?? source.arp), section: section.repeat ? `${section.repeat}'` : section.name });
    });
  }
  for (const name of song.outro) bars.push({ chord: name, melody: null, arp: false, section: "outro" });
  return bars;
}

export const barSeconds = (song) => (60 / song.bpm) * 4;
export const songLength = (song) => arrange(song).length * barSeconds(song);

/**
 * Every melody note with its start time and length (seconds), in order. Holds ("-") lengthen a
 * note, even across a bar line.
 */
export function melodyNotes(song) {
  const eighth = 60 / song.bpm / 2;
  const notes = [];
  let current = null;
  arrange(song).forEach((bar, b) => {
    for (let i = 0; i < 8; i++) {
      const token = bar.melody ? bar.melody[i] : ".";
      const time = (b * 8 + i) * eighth;
      if (token === "-") {
        if (current) current.length += eighth;
      } else if (token === ".") current = null;
      else {
        current = { time, length: eighth, midi: midi(token), step: b * 8 + i, bar: b };
        notes.push(current);
      }
    }
  });
  return notes;
}
