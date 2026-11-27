import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useDailyStyle } from "../../shared/DailyStyle.jsx";

// Her little corner, as a small chip at the right of home's header (the "kiriya" wordmark sits on
// the left; in the website it floats bottom-left). It shows today's check-in at a glance (how she
// feels, her pronouns, her social battery and since when) and opens the same check-in sheet, where
// everything else lives. Styled in WorldShell.css, because the header is the shell's.
export default function CornerWidget() {
  const { current, since, open, editing, allowed } = useDailyStyle();
  // The same cached check-in DailyStyle loads, for the battery's words.
  const mood = useQuery({ queryKey: ["me", "mood"], queryFn: () => api("/me/mood"), enabled: allowed, staleTime: 60_000 });
  if (!allowed) return null;
  const level = current ? mood.data?.energyLevels?.[current.energy] : null;
  const feeling = current?.feeling;
  const headline = current ? [feeling ? feeling.label.toLowerCase() : current.label.toLowerCase(), current.address.label].join(" · ") : "check in ♡";
  const detail = current ? [feeling ? current.label.toLowerCase() : null, since].filter(Boolean).join(" · ") || level?.label?.toLowerCase() || "" : "your little corner";
  const spoken = current
    ? `your little corner: ${[feeling?.label, current.label, current.address.label, level?.label, since].filter(Boolean).join(", ")}. tap to change it`
    : "your little corner: how’s the world feeling? tap to check in";
  return (
    <button
      type="button"
      className="home-corner"
      onClick={open}
      aria-haspopup="dialog"
      aria-expanded={editing}
      aria-label={spoken}
      data-empty={!current || undefined}
    >
      <span className="home-corner__face" aria-hidden="true">
        {feeling?.emoji ?? (current ? <span className="home-corner__kaomoji">{current.face}</span> : "♡")}
      </span>
      <span className="home-corner__text" aria-hidden="true">
        <strong>{headline}</strong>
        <span className="home-corner__meta">
          {current && <Battery energy={current.energy} />}
          <span className="home-corner__detail">{detail}</span>
        </span>
      </span>
    </button>
  );
}

function Battery({ energy }) {
  return (
    <span className="home-corner__battery" data-energy={energy}>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} data-lit={i <= energy || undefined} />
      ))}
    </span>
  );
}
