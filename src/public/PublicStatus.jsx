import { useState } from "react";
import { Modal } from "../shared/WorldPrimitives.jsx";
import "./PublicStatus.css";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function updatedLabel(iso) {
  if (!iso) return null;
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 1) return "updated just now";
  if (Math.abs(minutes) < 60) return `updated ${relative.format(minutes, "minute")}`;
  if (Math.abs(minutes) < 60 * 24) return `updated ${relative.format(Math.round(minutes / 60), "hour")}`;
  return `updated ${relative.format(Math.round(minutes / (60 * 24)), "day")}`;
}

/** The parts of today's check-in she chose to share. Every label arrives with the data. */
export function TodayCard({ today, name = "kiriya" }) {
  if (!today?.items?.length) return null;
  return (
    <section className="profile-today" aria-labelledby="profile-today-title" data-motion-region>
      <h2 id="profile-today-title" className="micro-label">{name} today <span aria-hidden="true">✦</span></h2>
      <ul>
        {today.items.map((item) => (
          <li key={item.key} data-key={item.key}>
            <span className="profile-today__label">{item.label}</span>
            <span className="profile-today__value">
              {(item.emoji || item.face) && <span className="profile-today__face" aria-hidden="true">{item.emoji ?? item.face}</span>}
              <strong>{item.value}</strong>
            </span>
            {item.level !== undefined && (
              <span className="profile-today__battery" role="img" aria-label={`${item.level + 1} of 5`}>
                {[0, 1, 2, 3, 4].map((cell) => <i key={cell} data-lit={cell <= item.level} />)}
              </span>
            )}
            {item.note && <small>“{item.note}”</small>}
          </li>
        ))}
      </ul>
      {today.updatedAt && <p className="profile-today__updated">{updatedLabel(today.updatedAt)}</p>}
    </section>
  );
}

/** Artwork she pinned for visitors, like polaroids on a corkboard. */
export function PinBoard({ pins, name = "kiriya" }) {
  const [open, setOpen] = useState(null);
  if (!pins?.length) return null;
  const viewing = pins.find((pin) => pin.id === open);
  return (
    <section className="profile-pins" aria-labelledby="profile-pins-title">
      <header>
        <span className="micro-label">PINNED BY {name.toUpperCase()} ♡</span>
        <h2 id="profile-pins-title">a few little masterpieces</h2>
      </header>
      <ul>
        {pins.map((pin, index) => (
          <li key={pin.id} style={{ "--tilt": `${[-3, 2, -1.5, 3, -2, 1][index % 6]}deg` }}>
            <button type="button" onClick={() => setOpen(pin.id)} aria-label={`Open ${pin.caption || "a pinned doodle"}`}>
              <span className="profile-pins__pin" aria-hidden="true" />
              <img
                src={pin.url}
                alt={pin.caption || "A doodle pinned to the board"}
                loading="lazy"
                decoding="async"
                width={pin.width ?? undefined}
                height={pin.height ?? undefined}
              />
              {pin.caption && <span className="profile-pins__caption">{pin.caption}</span>}
            </button>
          </li>
        ))}
      </ul>
      {viewing && (
        <Modal title={viewing.caption || "A pinned doodle"} onClose={() => setOpen(null)} className="gallery-dialog profile-pins__dialog">
          <img src={viewing.url} alt={viewing.caption || "A pinned doodle"} />
        </Modal>
      )}
    </section>
  );
}
