import { useCallback, useEffect, useMemo, useState } from "react";
import GameShell from "../_kit/GameShell.jsx";
import { audioSessionSupported, setAudioSession } from "../_kit/sound.js";
import { withArt } from "../_kit/stickers.jsx";
import { bestScore, readText, writeText } from "../_kit/storage.js";
import Buddy from "./Buddy.jsx";
import { rewardsFor } from "./chart.js";
import { bridge, createEngine } from "./engine.js";
import { SONGS, songById } from "./songs.js";
import STICKERS from "./stickers.js";
import { renderSong } from "./synth.js";
import Tuner from "./Tuner.jsx";
import "./rhythm.css";

const HUD = [
  { name: "score", label: "score", initial: "0" },
  { name: "combo" },
];

// songs she has finished with at least "nice" (70%), for the all-three sticker
function markCleared(result) {
  const cleared = new Set(readText("rhythm-tap:cleared", "").split(",").filter(Boolean));
  if (result.accuracy >= 70 && result.song) cleared.add(result.song);
  writeText("rhythm-tap:cleared", [...cleared].join(","));
  return [...cleared];
}

const rewards = (result) => withArt(rewardsFor({ ...result, cleared: markCleared(result) }), STICKERS);

export default function Game({ onExit, onReward }) {
  const [songId, setSongId] = useState(() => songById(readText("rhythm-tap:song", SONGS[0].id)).id);
  const [difficulty, setDifficulty] = useState(() => (readText("rhythm-tap:difficulty", "gentle") === "lively" ? "lively" : "gentle"));
  const [buffer, setBuffer] = useState(null);
  const [status, setStatus] = useState("tuning up…");
  const [tuning, setTuning] = useState(false);
  const song = songById(songId);

  useEffect(() => {
    let alive = true;
    setBuffer(null);
    setStatus("tuning up…");
    renderSong(song)
      .then((rendered) => {
        if (!alive) return;
        setBuffer(rendered);
        setStatus("");
      })
      .catch(() => alive && setStatus("the music couldn't start on this device"));
    return () => {
      alive = false;
    };
  }, [song]);

  // the music may ignore the silent switch only while this game is open
  useEffect(() => () => setAudioSession("auto"), []);

  const buddyRef = useCallback((node) => {
    bridge.buddy = node;
  }, []);
  const bubbleRef = useCallback((node) => {
    bridge.bubble = node;
  }, []);

  const settings = useMemo(() => ({ song, difficulty, buffer }), [song, difficulty, buffer]);

  function chooseSong(id) {
    setSongId(id);
    writeText("rhythm-tap:song", id);
  }
  function chooseDifficulty(value) {
    setDifficulty(value);
    writeText("rhythm-tap:difficulty", value);
  }

  const options = tuning ? (
    <Tuner onDone={() => setTuning(false)} />
  ) : (
    <>
      <div className="dex__choices rhythm__songs" role="group" aria-label="songs">
        {SONGS.map((each) => {
          const best = Math.max(bestScore("rhythm-tap", `${each.id}:gentle`), bestScore("rhythm-tap", `${each.id}:lively`));
          return (
            <button key={each.id} type="button" className="dex__choice" aria-pressed={each.id === songId} onClick={() => chooseSong(each.id)}>
              ♪ {each.title}
              <small>
                {each.mood} · {each.bpm} bpm
              </small>
              {best > 0 && <span className="rhythm__best">{best}</span>}
            </button>
          );
        })}
      </div>
      <div className="dex__choices dex__choices--row" role="group" aria-label="how busy">
        {[
          ["gentle", "on the beat"],
          ["lively", "every note"],
        ].map(([value, note]) => (
          <button key={value} type="button" className="dex__choice" aria-pressed={difficulty === value} onClick={() => chooseDifficulty(value)}>
            {value}
            <small>{note}</small>
          </button>
        ))}
      </div>
      <p className="rhythm__status" role="status">
        {status || (
          <button type="button" className="dex__link" onClick={() => setTuning(true)}>
            music feel late? tune the timing
          </button>
        )}
      </p>
    </>
  );

  return (
    <GameShell
      id="rhythm-tap"
      title="rhythm tap"
      kicker="quick fingers"
      howTo={<p>tap the lane as each note reaches its circle. negi will cheer you on ♪</p>}
      options={options}
      settings={settings}
      board={`${song.id}:${difficulty}`}
      canStart={!!buffer && !tuning}
      beforeStart={() => setAudioSession("playback")}
      hud={HUD}
      createEngine={createEngine}
      rewardsFor={rewards}
      overTitle={(result) => `${result.accuracy}% · ${result.word}`}
      overLine={(result) =>
        `${result.counts.perfect} perfect, ${result.counts.great} great, ${result.counts.good} good, ${result.counts.miss} missed. ${
          result.fullCombo ? "a full combo ♡" : `best combo ${result.maxCombo}.`
        }`
      }
      bestLabel={(best) => `best on this song ${best}`}
      soundNote={
        audioSessionSupported()
          ? "the music plays even with your iPhone on silent, and your other music pauses while you play"
          : "no music? check the silent switch on the side of your iPhone, and the volume"
      }
      overlay={<Buddy ref={buddyRef} bubbleRef={bubbleRef} />}
      onExit={onExit}
      onReward={onReward}
    />
  );
}
