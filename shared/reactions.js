// Reactions to notes and letters: mostly a heart, sometimes one emoji. Shared by the reaction bar and
// the routes that save it, so both agree on what a reaction can be.
export const HEART = "heart";
export const REACTION_EMOJI = Object.freeze(["🥹", "🥰", "😭", "😂", "🫶", "😳", "🤭", "✨"]);

// One emoji, including skin tones and joined sequences; never text.
const ONE_EMOJI = /^\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?)*$/u;

export const isReaction = (value) => value === HEART || (typeof value === "string" && value.length <= 16 && ONE_EMOJI.test(value));
