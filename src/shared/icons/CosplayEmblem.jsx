// Little emblems that stand in for cosplay photos until real ones are added.
// They're abstract nods (an herb sprig, twin tails, a magician's star), not character art.

const white = "rgb(255 255 255 / 0.92)";
const soft = "rgb(255 255 255 / 0.45)";

function Maomao() {
  return (
    <>
      <path d="M50 88V40" stroke={white} strokeWidth="4" strokeLinecap="round" />
      <path d="M50 62c-14-2-22-12-22-24 13 1 22 10 22 24zM50 52c12-2 19-11 19-22-12 1-19 9-19 22zM50 76c-10-1-16-8-16-17 9 1 16 7 16 17z" fill={white} />
      <circle cx="36" cy="92" r="3" fill={soft} />
      <circle cx="64" cy="94" r="2" fill={soft} />
      <path d="M69 71l6-6M72 76h8" stroke={soft} strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

// The spring onion Miku twirls (a nod to the Ievan Polkka video) and a pair of notes.
function Miku() {
  return (
    <>
      <path d="M34 96L60 44" stroke={white} strokeWidth="9" strokeLinecap="round" />
      <path d="M60 44c-2-12 4-22 14-26-1 10-6 18-14 26zM60 44c8-8 18-9 26-5-7 6-16 8-26 5zM60 44c-6-9-6-19 0-26 4 9 4 18 0 26z" fill={soft} />
      <path d="M36 92l6-12" stroke={soft} strokeWidth="3" strokeLinecap="round" />
      <path d="M22 58V38l14-4v20" stroke={white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="18.5" cy="59" r="4" fill={white} />
      <circle cx="32.5" cy="55" r="4" fill={white} />
    </>
  );
}

function Lynette() {
  return (
    <>
      <path d="M30 56l6-26 14 14 14-14 6 26c0 14-9 24-20 24S30 70 30 56z" fill={white} />
      <path d="M36 34l3 10M64 34l-3 10" stroke={soft} strokeWidth="3" strokeLinecap="round" />
      <path d="M50 84l3.5 7 7.5 1-5.5 5 1.5 7.5L50 101l-7 3.5 1.5-7.5-5.5-5 7.5-1z" fill={soft} />
    </>
  );
}

function Sparkle() {
  return <path d="M50 30q4 22 22 26-18 4-22 26-4-22-22-26 18-4 22-26z" fill={white} />;
}

const EMBLEMS = { maomao: Maomao, "hatsune miku": Miku, miku: Miku, lynette: Lynette };

export default function CosplayEmblem({ character }) {
  const Emblem = EMBLEMS[character.toLowerCase()] ?? Sparkle;
  return (
    <svg viewBox="0 0 100 120" className="polaroid__emblem" aria-hidden="true">
      <Emblem />
    </svg>
  );
}
