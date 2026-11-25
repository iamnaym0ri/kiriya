import { useEffect, useState } from "react";
import { APP_ICONS, appIconState, chooseAppIcon, haptic } from "../../lib/native.js";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import "./AppIconPicker.css";

/** Inside the iPhone app only: pick the icon on her Home Screen (docs/refactor/PLAN.md 4a "pick-your-icon"). */
export default function AppIconPicker() {
  const [state, setState] = useState({ available: false, current: null, loaded: false });
  const [message, setMessage] = useState("");
  useEffect(() => {
    appIconState().then((next) => setState({ ...next, loaded: true }), () => setState((s) => ({ ...s, loaded: true })));
  }, []);
  if (!state.loaded || !state.available) return null;

  async function pick(name) {
    if (name === state.current) return;
    try {
      await chooseAppIcon(name);
      haptic("success");
      setState((s) => ({ ...s, current: name }));
      setMessage("done ♡ your Home Screen has the new one");
    } catch {
      setMessage("that icon couldn’t be set just now. try again?");
    }
  }

  return (
    <section className="settings-card" id="app-icon" aria-labelledby="app-icon-title">
      <div className="settings-card__head">
        <MaomaoMascot expression="happy" size={64} />
        <div>
          <h2 id="app-icon-title">Your app icon</h2>
          <p className="settings-card__hint">Pick the one you like on your Home Screen. iPhone shows a little note when it changes.</p>
        </div>
      </div>
      <div className="app-icon-picker" role="radiogroup" aria-label="App icon">
        {APP_ICONS.map((icon) => (
          <button
            key={icon.label}
            type="button"
            role="radio"
            aria-checked={(state.current ?? null) === icon.name}
            className="app-icon-picker__choice"
            onClick={() => pick(icon.name)}
          >
            <img src={icon.preview} alt="" width="60" height="60" />
            <span>{icon.label}</span>
          </button>
        ))}
      </div>
      {message && (
        <p className="settings-card__message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
