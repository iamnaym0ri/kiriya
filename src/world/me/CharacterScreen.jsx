import { useEffect, useState } from "react";
import { COMPANIONS } from "../../../shared/companions.js";
import { availableCompanions, loadCompanion } from "../companions/registry.js";
import { useQueryClient } from "@tanstack/react-query";
import { prefsKey, usePrefs, useSetPrefs } from "../../lib/prefs.js";
import { useIsAdmin } from "../../lib/session.js";
import { haptic } from "../../lib/native.js";
import { Note, Screen } from "./parts.jsx";

// Who keeps her company on home (docs/refactor/RENOVATION.md, "Characters"): one of the five, or
// nobody at all. Saved to her prefs (prefs.companion), so every phone and the next launch agree.

// Each one's colours, for the little stand-in portrait until the character's own drawing lands.
const TINTS = {
  maomao: ["#e4eee0", "#5d7a55"],
  "miku-rotten": ["#f7dde8", "#9b4a6e"],
  bambi: ["#fbe6d6", "#a5664c"],
  miku: ["#d8f2ee", "#2e8a83"],
  kaito: ["#dfe7fb", "#3f5ea8"],
};

export const companionLabel = (id) => (id === "none" ? "nobody" : COMPANIONS.find((c) => c.id === id)?.name ?? "Maomao");

function StandIn({ id, name }) {
  const [paper, ink] = TINTS[id] ?? ["#efe6f6", "#785383"];
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden="true" focusable="false" className="me-cast__standin">
      <circle cx="36" cy="36" r="34" fill={paper} />
      <path d="M17 66c2-11 9.5-17 19-17s17 6 19 17" fill={ink} opacity="0.22" />
      <circle cx="36" cy="31" r="13" fill={ink} opacity="0.2" />
      <text x="36" y="38" textAnchor="middle" fontSize="19" fontWeight="700" fill={ink} fontFamily="Gaegu, cursive">
        {name.slice(0, 1).toLowerCase()}
      </text>
    </svg>
  );
}

function Calm() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden="true" focusable="false" className="me-cast__standin">
      <circle cx="36" cy="36" r="34" fill="#f1ebf7" />
      <path d="M18 44c3-5 8-5 11 0 3-6 11-7 14-1 4-4 10-2 11 3H18z" fill="#fffaff" stroke="#cdb6dd" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M45 22a7 7 0 1 0 6 10 6 6 0 0 1-6-10z" fill="#e7d2f1" stroke="#b89acb" strokeWidth="1.2" />
      <path d="M24 25h.01M30 19h.01M54 47h.01" stroke="#b89acb" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Loads the portraits of the characters that already have a folder (only on this screen). */
function useThumbs() {
  const [thumbs, setThumbs] = useState({});
  useEffect(() => {
    let live = true;
    for (const id of availableCompanions()) {
      loadCompanion(id)
        .then((character) => live && character?.Thumb && setThumbs((all) => ({ ...all, [id]: character.Thumb })))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, []);
  return thumbs;
}

const PICKED_LINE = {
  maomao: "maomao will be on home, pondering something",
  "miku-rotten": "miku will be on home, swinging her legs",
  bambi: "bamby will be on home, wandering about",
  miku: "miku will be on home, humming",
  kaito: "kaito will be on home ♡",
  none: "a calm home, just for you",
};

export default function CharacterScreen() {
  const prefs = usePrefs();
  const setPrefs = useSetPrefs();
  const admin = useIsAdmin();
  const thumbs = useThumbs();
  const [said, setSaid] = useState(null);
  const queryClient = useQueryClient();
  // Her pick may have changed on another phone: check the saved one whenever this screen opens.
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: prefsKey });
  }, [queryClient]);
  const current = prefs.data?.companion ?? "maomao";

  function pick(id) {
    if (id === current) return;
    haptic("light");
    setSaid(null);
    setPrefs.mutate({ companion: id }, { onSuccess: () => setSaid(PICKED_LINE[id]) });
  }

  const choices = [...COMPANIONS.map((c) => ({ ...c, kind: "character" })), { id: "none", name: "nobody", from: "just a calm home", kind: "none" }];

  return (
    <Screen
      title="your companion"
      subtitle={`who keeps you company on home. another one drops by for a visit now and then.${admin ? " (your pick here is your own test copy, not hers.)" : ""}`}
    >
      <div className="me-cast" role="radiogroup" aria-label="Your companion">
        {choices.map((choice) => {
          const Thumb = thumbs[choice.id];
          const checked = current === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              role="radio"
              aria-checked={checked}
              className={`me-cast__choice${choice.kind === "none" ? " me-cast__choice--none" : ""}`}
              onClick={() => pick(choice.id)}
              disabled={!prefs.data}
            >
              <span className="me-cast__portrait">
                {choice.kind === "none" ? <Calm /> : Thumb ? <Thumb size={72} /> : <StandIn id={choice.id} name={choice.name} />}
                {checked && (
                  <span className="me-cast__check" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="14" height="14">
                      <path d="M3.5 8.4l2.8 2.8 6.2-6.4" />
                    </svg>
                  </span>
                )}
              </span>
              <span className="me-cast__name">{choice.name}</span>
              <small className="me-cast__from">{choice.from}</small>
            </button>
          );
        })}
      </div>
      <Note>{setPrefs.isError ? "that didn’t save. try again?" : said}</Note>
    </Screen>
  );
}
