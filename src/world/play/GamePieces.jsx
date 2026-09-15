import MaomaoMascot from "../mascot/MaomaoMascot.jsx";

export const SYMBOL_NAMES = { leaf: "herb sprig", flower: "flower", bottle: "little bottle", mushroom: "mushroom", scroll: "notebook", cup: "tea cup" };
export function GameSymbol({ kind }) {
  return <svg viewBox="0 0 48 48" aria-hidden="true" className="game-symbol">
    {kind === "leaf" ? <>
      <path d="M16 40Q22 24 32 8" fill="none" stroke="#547d63" strokeWidth="3" strokeLinecap="round" />
      <path d="M23 26C10 27 9 14 9 14c12-1 17 5 14 12Zm4-6C24 9 39 7 39 7c2 9-3 16-12 13Z" fill="#94b888" stroke="#547d63" strokeWidth="1.5" />
    </> : kind === "flower" ? <>
      {[0,72,144,216,288].map(angle => <ellipse key={angle} cx="24" cy="14" rx="7" ry="10" transform={`rotate(${angle} 24 24)`} fill="#dba1bf" stroke="#ae739c" strokeWidth="1.5" />)}
      <circle cx="24" cy="24" r="6" fill="#efcf88" />
    </> : kind === "mushroom" ? <>
      <path d="m20 22-3 18q7 4 14 0l-3-18" fill="#f0dfbd" stroke="#a29076" strokeWidth="2" />
      <path d="M5 25C5 1 43 1 43 25Q24 32 5 25Z" fill="#b78bbd" stroke="#835b92" strokeWidth="2" />
      <circle cx="16" cy="18" r="3" fill="#fff5e9" /><circle cx="30" cy="14" r="3" fill="#fff5e9" />
    </> : kind === "scroll" ? <>
      <path d="M9 8h28v32H9Z" fill="#f6e7c9" stroke="#ae9578" strokeWidth="2" />
      <path d="M14 8v32m6-22h11m-11 7h11m-11 7h8" stroke="#b39a91" strokeWidth="2" />
      <path d="M8 11h6m-6 7h6m-6 7h6m-6 7h6" stroke="#876b88" strokeWidth="2" />
    </> : kind === "cup" ? <>
      <path d="M34 19h4q10 7-2 13h-4" stroke="#839f8a" strokeWidth="3" fill="none" />
      <path d="M8 18h27v12q-2 10-14 10Q8 39 8 30Z" fill="#ccdccb" stroke="#839f8a" strokeWidth="2" />
      <ellipse cx="21" cy="18" rx="13" ry="4" fill="#a9be95" /><path d="M16 12q-5-4 0-7m10 7q-5-4 0-7" stroke="#b59dc1" strokeWidth="2" fill="none" />
    </> : <>
      <path d="M18 9h12v8l6 7v16H12V24l6-7Z" fill="#c0a5d9" stroke="#795798" strokeWidth="2" />
      <rect x="17" y="6" width="14" height="6" rx="2" fill="#c6a37c" />
      <rect x="17" y="25" width="14" height="10" rx="2" fill="#fff5db" /><path d="M21 30h6" stroke="#9c789b" strokeWidth="2" />
    </>}
  </svg>;
}

export function MaomaoComment({ children, expression = "thinking", revision }) {
  return <div className="game-comment" role="status" aria-atomic="true">
    <MaomaoMascot size={72} expression={expression} reactionKey={revision ?? children} />
    <p>{children}<small>Maomao’s little observations</small></p>
  </div>;
}

export function GameFrame({ id, bar, kicker, title, accent, children }) {
  return <section className="little-game play-window" aria-labelledby={id}>
    <div className="play-window__bar"><span>{bar}</span><span aria-hidden="true">♡ ✧ ♡</span></div>
    <div className="little-game__inside">
      <span className="pixel-label">{kicker}</span>
      <h2 id={id}>{title} <em>{accent}</em></h2>
      {children}
    </div>
  </section>;
}
