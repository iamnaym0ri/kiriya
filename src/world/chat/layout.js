// Pure layout rules for the chat's photos (kept apart from the React parts so they can be tested).

/**
 * Discord's multi-image arrangement: one, two side by side, a big one beside two stacked, a 2 × 2
 * grid, then rows of three with whatever doesn't fit a row of three on top (one wide, or two).
 * Returns rows as tile counts; "feature" is the 3-photo layout.
 */
export function mosaic(count) {
  switch (count) {
    case 0:
      return [];
    case 1:
      return [1];
    case 2:
      return [2];
    case 3:
      return "feature";
    case 4:
      return [2, 2];
    default: {
      const top = count % 3;
      return [...(top ? [top] : []), ...Array.from({ length: Math.floor(count / 3) }, () => 3)];
    }
  }
}

/** A solo photo's shape in the bubble: its own aspect ratio, with panoramas and very tall shots gently capped. */
export const soloRatio = (width, height) => (width && height ? Math.min(3, Math.max(0.42, width / height)) : 1);
