import { lazy, Suspense, useEffect, useRef, useState } from "react";
import MaomaoGames from "./MaomaoGames.jsx";
const MiniSketchbook = lazy(() => import("./MiniSketchbook.jsx"));
export default function PlayDesk() {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          o.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return (
    <div className="play-desk" id="play-desk" ref={ref}>
      <header className="play-desk__heading">
        <div>
          <span className="pixel-label">
            LITTLE THINGS TO DO WHILE YOU STAY
          </span>
          <h2>
            Come play a little. <span aria-hidden="true">✿</span>
          </h2>
        </div>
        <p>messy doodles welcome ♡</p>
      </header>
      {near ? (
        <Suspense
          fallback={
            <div className="mini-sketchbook">
              <h2>Opening lets doodle&lt;3…</h2>
            </div>
          }
        >
          <MiniSketchbook />
        </Suspense>
      ) : (
        <div className="mini-sketchbook">
          <h2>A page for your doodles. 🎨</h2>
        </div>
      )}
      <MaomaoGames />
    </div>
  );
}
