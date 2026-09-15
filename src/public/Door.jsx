import "./Door.css";

// The medicine chest at the bottom of the profile. Visitors see a locked drawer; Kiriya opens it.
export default function Door({ unlocked, onOpen, onEnter }) {
  return (
    <section className="door" aria-labelledby="door-title">
      <svg className="door__chest" viewBox="0 0 120 96" aria-hidden="true">
        <rect x="6" y="8" width="108" height="80" rx="10" className="door__wood" />
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const x = 16 + col * 32;
            const y = 18 + row * 22;
            const glowing = row === 1 && col === 1;
            return (
              <g key={`${row}-${col}`}>
                <rect x={x} y={y} width="26" height="16" rx="3" className={glowing ? "door__drawer door__drawer--glow" : "door__drawer"} />
                {glowing ? (
                  <path
                    d={`M${x + 13} ${y + 12.4}c-3-2-4.4-3.4-4.4-5 0-1.2 1-2.2 2.1-2.2.9 0 1.8.5 2.3 1.3.5-.8 1.4-1.3 2.3-1.3 1.2 0 2.1 1 2.1 2.2 0 1.6-1.4 3-4.4 5z`}
                    className="door__heart"
                  />
                ) : (
                  <circle cx={x + 13} cy={y + 8} r="1.8" className="door__knob" />
                )}
              </g>
            );
          }),
        )}
        <rect x="14" y="86" width="10" height="6" rx="2" className="door__foot" />
        <rect x="96" y="86" width="10" height="6" rx="2" className="door__foot" />
      </svg>
      <div className="door__copy">
        <h2 id="door-title" className="door__title">
          {unlocked ? "Welcome back" : "One drawer is locked"}
        </h2>
        <p className="door__line">
          {unlocked ? "Everything made for you is right through here." : "Only Kiriya has the passphrase for what's inside."}
        </p>
      </div>
      {unlocked ? (
        <button type="button" className="btn btn--primary" onClick={onEnter}>
          Enter your world
        </button>
      ) : (
        <button type="button" className="btn btn--ghost door__open" onClick={onOpen}>
          Open the drawer
        </button>
      )}
    </section>
  );
}
