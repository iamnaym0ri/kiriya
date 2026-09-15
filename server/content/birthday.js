// PRIVATE. Birthday week: Maomao's letter, one small note for each of the seven days, and the
// stickers the medicine drawer can hand out.

export const maomaoBirthdayLetter = {
  title: "A prescription for your birthday",
  body: [
    "happy birthday babyy ♡",
    "...yes, babyy. apparently thats what im calling u. dont make a fuss, this is already harder than labelling medicine jars.",
    "its not much... just a little world with ur favourite things tucked into it. i wanted to give u somthing u could keep, somthing u will remmeberr. making u feel special was the whole point. there, now u know.",
    "im not good with words. if this were a medicine i wouldve measured it properly, but its feelings so... i love u. an unreasonable amount, actually. no, im not taking that back.",
    "ur goin to have sooo much fun today. eat the cake, play ur songs too loud, let people fuss over u for once. ive checked the cake, by the way. perfectly ordinary. u can have my slice too... dont look so surprised.",
    "ur the best, babyy. thats my conclusion and im not accepting objections. now go enjoy ur day... and keep this little thing, okay? ♡",
  ],
  signoff: "— your apothecary",
};

export const birthdayWeekNotes = [
  { day: 1, title: "Day one", text: "It's your birthday. Everything today is allowed to be a little extra. Frosting included." },
  { day: 2, title: "Day two", text: "The day after a birthday is still birthday. That's not a rule I made up. (I made it up.)" },
  { day: 3, title: "Day three", text: "Draw yourself as the main character today. Crown optional, sparkles mandatory." },
  { day: 4, title: "Day four", text: "Pick the song you'd want playing when you walk into a room. Play it twice." },
  { day: 5, title: "Day five", text: "Wear the outfit you've been saving for a special occasion. This is the occasion." },
  { day: 6, title: "Day six", text: "Tell someone something you're proud of this year. Bragging is medicinal, in small doses." },
  { day: 7, title: "Day seven", text: "Last day of birthday week. The celebration ends, but the year of you is just getting started." },
];

// Collectible stickers the daily drawer gives out. `art` names an SVG the client draws.
export const stickers = [
  { id: "st-kitten", art: "kitten", name: "Calico kitten", line: "Admonisher of Thieves, retired." },
  { id: "st-sprig", art: "sprig", name: "Herb sprig", line: "Probably medicinal. Probably." },
  { id: "st-leek", art: "leek", name: "Spring onion", line: "For twirling, not cooking." },
  { id: "st-pointe", art: "pointe", name: "Pointe shoe", line: "Ribbons tied, spirit strong." },
  { id: "st-bow", art: "bow", name: "Ribbon bow", line: "Jirai kei approved." },
  { id: "st-brush", art: "brush", name: "Paintbrush", line: "Still wet. Don't touch the canvas." },
  { id: "st-star", art: "star", name: "Stage star", line: "For the chorus you nailed." },
  { id: "st-bottle", art: "bottle", name: "Tiny tonic", line: "Label reads: drink water." },
  { id: "st-mirror", art: "mirror", name: "Mirror", line: "鏡: for Rin and Len." },
  { id: "st-cake", art: "cake", name: "Birthday cake", line: "Tested. Safe. Sadly.", birthdayOnly: true },
];
