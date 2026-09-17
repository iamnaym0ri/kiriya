import { Link } from "react-router";
import { useNotes } from "../../lib/notes.js";
import { usePrefs, useSetPrefs } from "../../lib/prefs.js";
import { isIos, isStandalone } from "../../lib/pwa.js";
import { Icon } from "../../shared/WorldPrimitives.jsx";
import "./HomeNudges.css";

/** Small slips at the top of home: a note waiting, and one-time suggestions she can wave away. */
export default function HomeNudges() {
  const notes = useNotes();
  const prefs = usePrefs();
  const setPrefs = useSetPrefs();
  const hints = prefs.data?.hints ?? {};
  const dismiss = (key) => setPrefs.mutate({ hints: { [key]: true } });
  const newest = notes.data?.notes.find((note) => !note.openedAt);
  const slips = [];
  if (newest)
    slips.push(
      <aside key="note" className="home-nudge home-nudge--note" role="status">
        <span className="home-nudge__mark" aria-hidden="true"><Icon name="mail" size={19} /></span>
        <p>
          <strong>{notes.data.unread > 1 ? `${notes.data.unread} little notes are waiting` : "a little note is waiting"}</strong>
          <span>{newest.title}</span>
        </p>
        <Link className="button-plum" to={`/world/notes?open=${newest.id}`}>
          Open it <Icon name="arrow" size={15} />
        </Link>
      </aside>,
    );
  if (prefs.data && !prefs.data.sharingChosen && !hints.sharing)
    slips.push(
      <aside key="sharing" className="home-nudge">
        <span className="home-nudge__mark" aria-hidden="true"><Icon name="star" size={18} /></span>
        <p>
          <strong>let your friends see how you’re doing?</strong>
          <span>Your public profile can show your mood or social battery. Nothing is shared until you pick.</span>
        </p>
        <div className="home-nudge__actions">
          <Link className="button-paper" to="/world/settings#sharing">Choose what’s shared</Link>
          <button className="text-link" onClick={() => dismiss("sharing")}>not now</button>
        </div>
      </aside>,
    );
  if (prefs.data && !hints.install && isIos() && !isStandalone())
    slips.push(
      <aside key="install" className="home-nudge">
        <span className="home-nudge__mark" aria-hidden="true"><Icon name="heart" size={18} /></span>
        <p>
          <strong>keep your little world on your Home Screen</strong>
          <span>It opens like an app, and little notes can reach your phone.</span>
        </p>
        <div className="home-nudge__actions">
          <Link className="button-paper" to="/world/settings#surprises">Show me how</Link>
          <button className="text-link" onClick={() => dismiss("install")}>not now</button>
        </div>
      </aside>,
    );
  return slips.length ? <div className="home-nudges">{slips}</div> : null;
}
