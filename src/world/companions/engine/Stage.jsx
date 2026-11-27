import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { usePlayful } from "../../../shared/play/PlayfulContext.js";
import { haptic } from "../../../lib/native.js";
import { availableCompanions, loadCompanion } from "../registry.js";
import { normaliseCharacter } from "./character.js";
import DefaultPlatform from "./DefaultPlatform.jsx";
import { StageSim } from "./stage.js";
import ActorView from "./ActorView.jsx";
import "./stage.css";

// Characters are loaded once and normalised once; a visitor costs nothing until it visits.
const cache = new Map();
export function loadCharacter(id) {
  if (!id) return Promise.resolve(null);
  if (!cache.has(id)) {
    cache.set(
      id,
      loadCompanion(id)
        .then((raw) => normaliseCharacter(raw, { Platform: DefaultPlatform }))
        .catch((error) => {
          console.error(`companion ${id} failed to load`, error);
          cache.delete(id);
          return null;
        }),
    );
  }
  return cache.get(id);
}

/** Her pick, or the nearest thing to it that exists (the real Maomao, then any character). */
export async function loadHost(id) {
  if (id === "none") return null;
  for (const candidate of [id, "maomao", ...availableCompanions().filter((each) => !each.startsWith("_")), "_maomao-legacy"]) {
    const character = candidate && (await loadCharacter(candidate));
    if (character) return character;
  }
  return null;
}

/** Someone to visit the host: favours characters who have something written for this pair. */
async function pickVisitorId(hostId) {
  const ids = availableCompanions().filter((id) => id !== hostId && id !== "_placeholder");
  if (!ids.length) return null;
  const host = await loadCharacter(hostId);
  const weights = ids.map((id) => (host?.visit.with[id] ? 3 : 1) * (id.startsWith("_") ? 0.2 : 1));
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ids.length; i++) if ((roll -= weights[i]) <= 0) return ids[i];
  return ids[0];
}

/**
 * The companion stage (README.md): a fixed layer between home's top bar and the tab bar where her
 * character lives, plus a visitor now and then.
 *
 * - `hostId`: a character id, "none" for nobody.
 * - `active`: false pauses everything and hides the layer (home not showing).
 * - `options`: engine options (README.md, "Stage options"); `quiet` forces quiet mode either way.
 * - `controlRef`: receives the StageSim, for the lab.
 * - `name`, `birthday`: who the lines talk to, and whether today is her birthday.
 */
export default function Stage({ hostId = "maomao", active = true, options, controlRef, name = "", birthday = false, onLayout, className = "" }) {
  const { moving } = usePlayful();
  const reduced = useReducedMotion();
  const lively = options?.quiet != null ? !options.quiet : moving && !reduced;
  const [actors, setActors] = useState([]);
  const [levels, setLevels] = useState([]);
  const layerRef = useRef(null);
  const simRef = useRef(null);
  if (!simRef.current) {
    simRef.current = new StageSim({
      onActors: (list) => setActors([...list]),
      onLayout: (next) => setLevels(next),
      loadCharacter,
      haptic,
    });
    simRef.current.pickVisitorId = pickVisitorId;
  }
  const sim = simRef.current;
  useImperativeHandle(controlRef, () => sim, [sim]);

  useEffect(() => {
    sim.mount(layerRef.current);
    return () => sim.destroy();
  }, [sim]);
  useEffect(() => {
    sim.setOptions(options ?? {});
  }, [sim, options]);
  useEffect(() => {
    sim.setLively(lively);
  }, [sim, lively]);
  useEffect(() => {
    sim.setActive(active);
  }, [sim, active]);
  useEffect(() => {
    sim.name = name;
    sim.birthday = birthday;
  }, [sim, name, birthday]);
  useEffect(() => {
    onLayout?.(levels, sim.band);
  }, [levels, onLayout, sim]);

  // The lab can try a character with other movement settings (`options.movement`).
  const tweak = options?.movement ? JSON.stringify(options.movement) : "";
  useEffect(() => {
    let live = true;
    loadHost(hostId).then((character) => {
      if (!live) return;
      if (character && tweak) {
        const movement = { ...character.movement, hop: null, bob: null, ...JSON.parse(tweak) };
        character = normaliseCharacter({ ...character, movement }, { Platform: DefaultPlatform });
      }
      sim.setHost(character);
    });
    return () => {
      live = false;
    };
  }, [sim, hostId, tweak]);

  return (
    <div
      ref={layerRef}
      className={`cs-stage ${className}`}
      data-companion-stage=""
      data-lively={lively ? "" : undefined}
      hidden={!active}
    >
      {options?.debug &&
        levels.map((level) => (
          <div
            key={level.id}
            className="cs-level-guide"
            style={{ transform: `translate3d(${level.x0}px, ${level.y}px, 0)`, width: level.x1 - level.x0 }}
          >
            <span>{level.id}</span>
          </div>
        ))}
      {actors.map((actor) => (
        <ActorView key={actor.key} actor={actor} playing={lively && active} />
      ))}
    </div>
  );
}
