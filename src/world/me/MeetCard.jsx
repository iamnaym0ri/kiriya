import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useIsAdmin } from "../../lib/session.js";
import { AdminEdit, EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";
import { KM_PER_MILE, MEET_ZONES, PLACES, countdown, formatLocal, greatCircleKm, parseLocal, progress } from "../../../shared/meetCountdown.js";

// "Until we meet" on both their tabs (Josh, 2026-11-27): a countdown to when they next see each
// other, Houston and Singapore on a little hand-drawn map, and a bar that fills as the wait passes.
// Josh sets it from the pencil; the date maths lives in shared/meetCountdown.js.

export const meetKey = ["me", "meet"];
const KM = greatCircleKm(PLACES.houston, PLACES.singapore);
const DISTANCE = `${Math.round(KM).toLocaleString("en-SG")} km · ${Math.round(KM / KM_PER_MILE).toLocaleString("en-SG")} mi`;

/** Now, ticking once a second while the tab is on screen (and not at all while it's hidden). */
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    let timer = 0;
    const tick = () => {
      setNow(Date.now());
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    const start = () => {
      clearTimeout(timer);
      if (!document.hidden) tick();
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, [active]);
  return now;
}

const clock = (now, timeZone) => new Intl.DateTimeFormat("en-SG", { timeZone, hour: "numeric", minute: "2-digit" }).format(now).toLowerCase();
const when = (instant, timeZone) =>
  new Intl.DateTimeFormat("en-SG", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(instant).toLowerCase();
const day = (instant, timeZone) => new Intl.DateTimeFormat("en-SG", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(instant).toLowerCase();

// The map: Houston on the left, Singapore on the right, a dotted arc between them.
const H = { x: 56, y: 100 };
const S = { x: 284, y: 100 };
const C = { x: 170, y: 6 };
const ARC = `M${H.x} ${H.y} Q${C.x} ${C.y} ${S.x} ${S.y}`;
const onArc = (t) => ({
  x: (1 - t) ** 2 * H.x + 2 * (1 - t) * t * C.x + t ** 2 * S.x,
  y: (1 - t) ** 2 * H.y + 2 * (1 - t) * t * C.y + t ** 2 * S.y,
});

function MeetMap({ pct, now, together }) {
  const heart = onArc(together ? 0.5 : pct / 100);
  return (
    <svg className="me-meet__map" viewBox="0 0 340 152" role="img" aria-label={`Houston to Singapore, ${DISTANCE}`}>
      {/* a hint of a globe: a few soft meridians and the equator */}
      <g className="me-meet__globe" aria-hidden="true">
        <path d="M8 118c60-14 264-14 324 0" />
        <path d="M14 84c58-10 254-10 312 0" />
        <path d="M70 12c-16 40-16 100 0 132M170 6v140M270 12c16 40 16 100 0 132" />
        <path d="M118 8c-8 44-8 96 0 138M222 8c8 44 8 96 0 138" />
      </g>
      <path className="me-meet__arc" d={ARC} pathLength="100" />
      {!together && <path className="me-meet__arc me-meet__arc--done" d={ARC} pathLength="100" style={{ strokeDasharray: `${pct} 100` }} />}
      <text className="me-meet__distance" x="170" y="40" textAnchor="middle">
        {DISTANCE}
      </text>
      {[H, S].map((p) => (
        <g key={p.x} className="me-meet__dot">
          <circle className="me-meet__halo" cx={p.x} cy={p.y} r="10" />
          <circle cx={p.x} cy={p.y} r="5.5" />
        </g>
      ))}
      <path
        className="me-meet__heart"
        transform={`translate(${heart.x - 8} ${heart.y - 9})`}
        d="M8 15S1.5 10.8 1.5 6.3C1.5 3.9 3.3 2.3 5.2 2.3c1.3 0 2.3.7 2.8 1.6.5-.9 1.5-1.6 2.8-1.6 1.9 0 3.7 1.6 3.7 4 0 4.5-6.5 8.7-6.5 8.7z"
      />
      {[
        { at: H, place: PLACES.houston },
        { at: S, place: PLACES.singapore },
      ].map(({ at, place }) => (
        <g key={place.name} className="me-meet__label">
          <text className="me-meet__who" x={at.x} y={at.y + 24} textAnchor="middle">
            {place.who}
          </text>
          <text className="me-meet__city" x={at.x} y={at.y + 38} textAnchor="middle">
            {place.name} · {clock(now, place.zone)}
          </text>
        </g>
      ))}
    </svg>
  );
}

const UNITS = [
  ["years", "year", "years"],
  ["months", "month", "months"],
  ["days", "day", "days"],
  ["hours", "hour", "hours"],
  ["minutes", "min", "mins"],
  ["seconds", "sec", "secs"],
];

function Countdown({ left }) {
  const first = UNITS.findIndex(([key]) => left[key] > 0);
  return (
    <div className="me-meet__count" role="timer" aria-live="off">
      {UNITS.map(([key, one, many], index) => (
        <span key={key} className="me-meet__unit" data-quiet={first === -1 || index < first ? "" : undefined}>
          <strong>{String(left[key]).padStart(2, "0")}</strong>
          <small>{left[key] === 1 ? one : many}</small>
        </span>
      ))}
    </div>
  );
}

/** Josh sets when they meet (on either clock), and optionally when they were last together. */
function MeetSheet({ open, onClose, meeting }) {
  const queryClient = useQueryClient();
  const [zone, setZone] = useState(meeting?.zone ?? "Asia/Singapore");
  const [at, setAt] = useState("");
  const [since, setSince] = useState("");
  useEffect(() => {
    if (!open) return;
    const z = meeting?.zone ?? "Asia/Singapore";
    setZone(z);
    setAt(meeting ? formatLocal(Date.parse(meeting.at), z) : "");
    setSince(meeting?.since ? formatLocal(Date.parse(meeting.since), z) : "");
  }, [open, meeting]);
  const done = (data) => queryClient.setQueryData(meetKey, data);
  const save = useMutation({
    mutationFn: (body) => api("/admin/hub/meet", { method: "PUT", body }),
    onSuccess: done,
  });
  const clear = useMutation({ mutationFn: () => api("/admin/hub/meet", { method: "DELETE" }), onSuccess: done });
  const atInstant = parseLocal(at, zone);
  const sinceInstant = since ? parseLocal(since, zone) : null;
  const other = zone === "Asia/Singapore" ? "America/Chicago" : "Asia/Singapore";
  const nowLocal = formatLocal(Date.now(), zone);
  const original = meeting ? [meeting.zone, formatLocal(Date.parse(meeting.at), meeting.zone), meeting.since ? formatLocal(Date.parse(meeting.since), meeting.zone) : ""].join("|") : "||";

  return (
    <EditSheet
      open={open}
      title="our next meeting"
      subtitle="it counts down on both your phones"
      onClose={onClose}
      dirty={[zone, at, since].join("|") !== original && Boolean(at || since)}
      saveDisabled={!atInstant || atInstant <= Date.now()}
      onSave={() => save.mutateAsync({ at: new Date(atInstant).toISOString(), zone, since: sinceInstant ? new Date(sinceInstant).toISOString() : null })}
      onDelete={meeting ? () => clear.mutateAsync() : undefined}
      deleteLabel="Clear the countdown"
    >
      <div className="edit-field">
        <span className="edit-field__label" id="meet-zone-label">whose clock</span>
        <div className="me-segments me-segments--wide" role="radiogroup" aria-labelledby="meet-zone-label">
          {Object.entries(MEET_ZONES).map(([id, place]) => (
            <button key={id} type="button" role="radio" aria-checked={zone === id} onClick={() => setZone(id)}>
              {place.city} <small>({place.who})</small>
            </button>
          ))}
        </div>
      </div>
      <EditField
        label="when we meet"
        hint={atInstant ? `that’s ${when(atInstant, zone)} in ${MEET_ZONES[zone].city}, ${when(atInstant, other)} in ${MEET_ZONES[other].city}` : `in ${MEET_ZONES[zone].city} time`}
      >
        <input type="datetime-local" value={at} min={nowLocal} onChange={(event) => setAt(event.target.value)} />
      </EditField>
      <EditField label="the last time we were together (optional)" hint="the bar fills from here. leave it empty and it fills from today.">
        <input type="datetime-local" value={since} max={nowLocal} onChange={(event) => setSince(event.target.value)} />
      </EditField>
      {since && (
        <button type="button" className="me-link-button" onClick={() => setSince("")}>
          leave the last time empty
        </button>
      )}
    </EditSheet>
  );
}

export default function MeetCard() {
  const admin = useIsAdmin();
  const query = useQuery({ queryKey: meetKey, queryFn: () => api("/me/meet"), staleTime: 0, refetchOnWindowFocus: true });
  const meeting = query.data?.meeting ?? null;
  const target = meeting ? Date.parse(meeting.at) : 0;
  const start = meeting ? Date.parse(meeting.start) : 0;
  const now = useNow(Boolean(meeting));
  const [editing, setEditing] = useState(false);
  const left = useMemo(() => (meeting ? countdown(now, target, meeting.zone) : null), [meeting, now, target]);

  if (!query.data) return null;
  if (!meeting && !admin) return null;
  const pct = meeting ? progress(now, start, target) : 0;
  const together = Boolean(left?.done);

  return (
    <section className={`app-card me-meet${together ? " me-meet--together" : ""}`} aria-labelledby="me-meet-title">
      <header className="app-card__head">
        <h2 className="app-card__title" id="me-meet-title">
          {together ? "together ♡" : "until we meet"}
        </h2>
        {admin && meeting && (
          <div className="app-card__action">
            <AdminEdit compact label="our next meeting" onClick={() => setEditing(true)} />
          </div>
        )}
      </header>

      {meeting ? (
        <>
          <MeetMap pct={pct} now={now} together={together} />
          {together ? (
            <p className="me-meet__together">
              {admin ? "the countdown rests while you’re together. set the next one whenever you know it ✎" : "the countdown rests while you’re together ♡"}
            </p>
          ) : (
            <>
              <Countdown left={left} />
              <div className="me-meet__progress">
                <div className="me-meet__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="How much of the wait is behind you">
                  <span className="me-meet__fill" style={{ transform: `scaleX(${pct / 100})` }} />
                </div>
                <div className="me-meet__legend">
                  <span>since {day(start, meeting.zone)}</span>
                  <strong>{pct.toFixed(1)}%</strong>
                </div>
              </div>
              <p className="me-meet__when">
                <span>kiriya: {when(target, "Asia/Singapore")}</span>
                <span>Josh: {when(target, "America/Chicago")}</span>
              </p>
            </>
          )}
        </>
      ) : (
        <div className="me-meet__empty">
          <p>set the day you next see each other, and it counts down on both your phones.</p>
          <button type="button" className="me-button me-button--soft" onClick={() => setEditing(true)}>
            set our next meeting
          </button>
        </div>
      )}
      {admin && <MeetSheet open={editing} onClose={() => setEditing(false)} meeting={meeting} />}
    </section>
  );
}
