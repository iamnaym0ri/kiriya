import { useRef } from "react";
import MaomaoMascot from "../../../mascot/MaomaoMascot.jsx";

// The engine's poses in the old mascot's vocabulary (stand, walk, sit, held, land, crouch, hop).
const POSE = {
  idle: "stand",
  ponder: "stand",
  walk: "walk",
  jump: "hop",
  fall: "hop",
  land: "land",
  crouch: "crouch",
  sit: "sit",
  sleep: "sit",
  held: "held",
  wave: "stand",
  react: "stand",
};
// When a pose implies a face and nothing else has chosen one.
const FACE = { ponder: "thinking", sleep: "sleepy", react: "startled", wave: "pleased", held: "alarmed" };

export function LegacyBody({ pose = "idle", expression }) {
  // The old rig replays its little accents whenever reactionKey changes: bump it per pose/face.
  const key = useRef(0);
  const last = useRef("");
  const signature = `${pose}|${expression}`;
  if (signature !== last.current) {
    last.current = signature;
    key.current += 1;
  }
  return <MaomaoMascot pose={POSE[pose] ?? "stand"} expression={expression ?? FACE[pose] ?? "deadpan"} size="100%" reactionKey={key.current} />;
}

export function LegacyThumb() {
  return (
    <div style={{ width: 56 }}>
      <MaomaoMascot size={56} expression="pleased" />
    </div>
  );
}
