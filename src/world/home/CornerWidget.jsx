import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useDailyStyle } from "../../shared/DailyStyle.jsx";

// Her little corner, as a widget near the top of home (in the website it floats bottom-left). It
// shows today's check-in at a glance (mood, presentation, pronouns, social battery, since when) and
// opens the same check-in sheet.
export default function CornerWidget() {
  const { current, since, open, editing, allowed } = useDailyStyle();
  // The same cached check-in DailyStyle loads, for the battery's words.
  const mood = useQuery({ queryKey: ["me", "mood"], queryFn: () => api("/me/mood"), enabled: allowed, staleTime: 60_000 });
  if (!allowed) return null;
  const level = current ? mood.data?.energyLevels?.[current.energy] : null;
  const feeling = current?.feeling;
  return (
    <button
      type="button"
      className="home-corner"
      onClick={open}
      aria-haspopup="dialog"
      aria-expanded={editing}
      data-empty={!current || undefined}
    >
      <span className="home-corner__face" aria-hidden="true">
        {feeling?.emoji ?? (current ? <span className="home-corner__kaomoji">{current.face}</span> : "♡")}
      </span>
      <span className="home-corner__text">
        <span className="home-corner__label">your little corner</span>
        {current ? (
          <>
            <strong>
              {feeling ? `${feeling.label.toLowerCase()} · ` : ""}
              {current.label.toLowerCase()} · {current.address.label}
            </strong>
            <span className="home-corner__meta">
              <Battery energy={current.energy} />
              <span>{level?.label ?? "social battery"}</span>
              {since && <span className="home-corner__since">· {since}</span>}
            </span>
          </>
        ) : (
          <>
            <strong>how’s the world feeling?</strong>
            <span className="home-corner__meta">tap to check in ♡</span>
          </>
        )}
      </span>
      <span className="home-corner__chevron" aria-hidden="true" />
    </button>
  );
}

function Battery({ energy }) {
  return (
    <span className="home-corner__battery" aria-hidden="true" data-energy={energy}>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} data-lit={i <= energy || undefined} />
      ))}
    </span>
  );
}
