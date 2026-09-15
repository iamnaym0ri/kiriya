import { AnimatePresence, motion } from "motion/react";
import "./MaomaoMascot.css";

// Original chibi fan art inspired by Maomao: dark hair in a bun (tied with a purple ribbon, for
// Kiriya), painted freckles, a pale green top over a burgundy skirt, and an herb sprig.
// Expressions: deadpan | smug | sparkle | happy | sleepy | party | ew

const HAIR = "#214e47";
const HAIR_LIGHT = "#438574";
const SKIN = "#fde7da";
const ROBE = "#bcd9b2";
const ROBE_DARK = "#8fb685";
const SKIRT = "#7b2f3e";
const IRIS = "#4f8a78";

function Eyes({ expression }) {
  switch (expression) {
    case "sparkle":
      return (
        <g>
          {[78, 122].map((x) => (
            <g key={x}>
              <ellipse cx={x} cy="110" rx="11" ry="12" fill="#fff" />
              <ellipse cx={x} cy="111" rx="8.5" ry="10" fill={IRIS} />
              <ellipse cx={x} cy="113" rx="5" ry="6" fill="#22312b" />
              <path d={`M${x - 3} 104l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z`} fill="#fff" />
              <circle cx={x + 4} cy="116" r="1.6" fill="#fff" />
            </g>
          ))}
        </g>
      );
    case "happy":
    case "party":
      return (
        <g fill="none" stroke="#2a2a2a" strokeWidth="3.2" strokeLinecap="round">
          <path d="M68 112q10-10 20 0" />
          <path d="M112 112q10-10 20 0" />
        </g>
      );
    case "sleepy":
      return (
        <g fill="none" stroke="#2a2a2a" strokeWidth="3" strokeLinecap="round">
          <path d="M68 110q10 7 20 0" />
          <path d="M112 110q10 7 20 0" />
        </g>
      );
    case "ew":
      return (
        <g>
          {[78, 122].map((x) => (
            <g key={x}>
              <path d={`M${x - 11} 110h22`} stroke="#2a2a2a" strokeWidth="3.2" strokeLinecap="round" />
              <circle cx={x + (x < 100 ? 4 : 4)} cy="113" r="2.6" fill="#22312b" />
            </g>
          ))}
          <path d="M60 94l12 4M140 94l-12 4" stroke={HAIR} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "smug":
    case "deadpan":
    default:
      return (
        <g>
          {[78, 122].map((x) => (
            <g key={x} className="mascot__eye">
              <path d={`M${x - 11} 108q11-4 22 0v6q-11 8-22 0z`} fill="#fff" />
              <circle cx={x + (expression === "smug" ? 4 : 0)} cy="112" r="6" fill={IRIS} />
              <circle cx={x + (expression === "smug" ? 4 : 0)} cy="113" r="3.4" fill="#22312b" />
              <circle cx={x + (expression === "smug" ? 6 : 2)} cy="110" r="1.4" fill="#fff" />
              <path d={`M${x - 12} 107.5q12-4.5 24 0`} stroke="#2a2a2a" strokeWidth="3.4" strokeLinecap="round" fill="none" />
            </g>
          ))}
          {expression === "smug" && <path d="M64 97q9-5 18-2" stroke={HAIR} strokeWidth="3" strokeLinecap="round" fill="none" />}
        </g>
      );
  }
}

function Mouth({ expression }) {
  switch (expression) {
    case "sparkle":
      return <path d="M92 130q8 12 16 0z" fill="#b8475a" />;
    case "happy":
    case "party":
      return <path d="M91 129q9 9 18 0" fill="none" stroke="#8a3446" strokeWidth="3" strokeLinecap="round" />;
    case "sleepy":
      return <ellipse cx="100" cy="132" rx="3" ry="3.6" fill="#8a3446" />;
    case "smug":
      return <path d="M93 132q7 2 14-4" fill="none" stroke="#8a3446" strokeWidth="3" strokeLinecap="round" />;
    case "ew":
      return <path d="M90 134q3-4 6 0t6 0 6 0" fill="none" stroke="#8a3446" strokeWidth="2.6" strokeLinecap="round" />;
    case "deadpan":
    default:
      return <path d="M94 132h12" stroke="#8a3446" strokeWidth="3" strokeLinecap="round" />;
  }
}

export default function MaomaoMascot({ expression = "deadpan", size = 132, onPoke }) {
  const Tag = onPoke ? "button" : "div";
  return (
    <Tag
      className="mascot"
      style={{ width: size }}
      onClick={onPoke}
      {...(onPoke ? { type: "button", "aria-label": "Poke the apothecary" } : { "aria-hidden": true })}
    >
      <svg viewBox="0 0 200 236" className="mascot__svg">
        <g className="mascot__float">
          {/* hair behind the head */}
          <ellipse cx="100" cy="98" rx="70" ry="66" fill={HAIR} />
          <path d="M40 104c-2 30 2 48 12 62 4-18 4-38 2-58zM160 104c2 30-2 48-12 62-4-18-4-38-2-58z" fill={HAIR} />

          {/* body */}
          <path d="M58 222l6-30h72l6 30z" fill={SKIRT} />
          <path d="M84 146h32l22 18-4 34H66l-4-34z" fill={ROBE} />
          <path d="M86 146l14 22 14-22" fill="none" stroke={ROBE_DARK} strokeWidth="4" strokeLinejoin="round" />
          <rect x="64" y="186" width="72" height="9" rx="3" fill="#5f2431" />
          <path d="M66 162c-14 8-24 22-28 38l24 6 10-26z" fill={ROBE} />
          <path d="M134 162c14 8 24 22 28 38l-24 6-10-26z" fill={ROBE} />
          <circle cx="50" cy="202" r="8" fill={SKIN} />
          <circle cx="150" cy="202" r="8" fill={SKIN} />
          <ellipse cx="84" cy="226" rx="11" ry="5" fill="#3a2a2e" />
          <ellipse cx="116" cy="226" rx="11" ry="5" fill="#3a2a2e" />

          {/* herb sprig */}
          <g className="mascot__sprig">
            <path d="M152 204c6-18 10-34 8-52" stroke="#5f8c55" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M160 168c10-2 16-10 16-18-9 1-15 8-16 18zM158 184c-10-1-16-8-17-16 9 0 15 6 17 16zM161 152c6-5 8-12 6-18-6 4-8 11-6 18z" fill="#79b06b" />
          </g>

          {/* bun and ribbon */}
          <circle cx="100" cy="34" r="22" fill={HAIR} />
          <path d="M88 24q10-8 22-2" stroke={HAIR_LIGHT} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M84 50q16 8 32 0" stroke="var(--purple-500)" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M116 48c10-8 20-6 20 2s-12 8-20-2zM118 50c4 8 2 16-4 18" fill="var(--purple-400)" />

          {/* face */}
          <ellipse cx="100" cy="104" rx="56" ry="50" fill={SKIN} />
          <ellipse cx="64" cy="126" rx="9" ry="5" fill="#f7a8b8" opacity="0.45" />
          <ellipse cx="136" cy="126" rx="9" ry="5" fill="#f7a8b8" opacity="0.45" />
          <g fill="#c58d74">
            <circle cx="66" cy="123" r="1.7" />
            <circle cx="72" cy="127" r="1.7" />
            <circle cx="62" cy="129" r="1.5" />
            <circle cx="134" cy="123" r="1.7" />
            <circle cx="128" cy="127" r="1.7" />
            <circle cx="138" cy="129" r="1.5" />
          </g>
          <g className="mascot__gaze"><Eyes expression={expression} /></g>
          <Mouth expression={expression} />

          {/* bangs and side locks */}
          <path
            d="M44 102C42 66 68 48 100 48s58 18 56 54l-8-16-6 14-12-20-8 16-14-22-10 20-12-18-8 16-8-14z"
            fill={HAIR}
          />
          <path d="M70 60q14-8 30-8" stroke={HAIR_LIGHT} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M46 98c-4 18-2 34 6 48 4-14 6-30 4-46zM154 98c4 18 2 34-6 48-4-14-6-30-4-46z" fill={HAIR} />

          {expression === "party" && (
            <g className="mascot__hat">
              <path d="M112 40l30-34 10 44z" fill="var(--pink-400)" />
              <path d="M124 26l16 6M118 34l24 8M132 14l10 4" stroke="var(--purple-100)" strokeWidth="3" strokeLinecap="round" />
              <circle cx="142" cy="6" r="6" fill="var(--purple-500)" />
            </g>
          )}
          {expression === "ew" && (
            <g stroke="#8aa3c7" strokeWidth="2" strokeLinecap="round" opacity="0.8">
              <path d="M58 132v10M64 134v10M136 134v10M142 132v10" />
            </g>
          )}
        </g>
      </svg>

      <AnimatePresence>
        {expression === "sparkle" && (
          <motion.span className="mascot__sparkles" aria-hidden="true" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <span>✦</span>
            <span>✧</span>
            <span>✦</span>
          </motion.span>
        )}
        {expression === "sleepy" && (
          <motion.span className="mascot__zzz" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            z<small>z</small>
          </motion.span>
        )}
      </AnimatePresence>
    </Tag>
  );
}
