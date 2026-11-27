import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { tabDepth } from "../../shared/AppFrame.jsx";
import PageLoader from "../../shared/PageLoader.jsx";
import { GAMES, SHELVES, gameById } from "./games/registry.js";
import GameSheet from "./games/GameSheet.jsx";
import DoodleCard from "./DoodleCard.jsx";
import GalleryCard from "./gallery/GalleryCard.jsx";
import { StickerMoment } from "./Stickers.jsx";
import { useMarkPlayed, usePlayState, useReward } from "./playState.js";
import "./PlaySection.css";

const MiniSketchbook = lazy(() => import("./MiniSketchbook.jsx"));
const GalleryScreen = lazy(() => import("./gallery/GalleryScreen.jsx"));
// The quizzes agent's entry card (src/world/play/quizzes/index.js exports QuizzesEntry); until it
// lands, a quiet placeholder holds its place.
const quizModules = import.meta.glob("./quizzes/index.{js,jsx}", { eager: true });
const QuizzesEntry = Object.values(quizModules)[0]?.QuizzesEntry ?? null;

// Colour-club paints (?paint=) open the sketchbook with them on the brush. Her gallery is a pushed
// screen of its own: ?gallery=1, and ?doodle=<id> (a note's notification) opens one piece in it
// (lib/appLinks.js maps the website's /world?gallery=1&doodle=<id>#play-desk here).
const SKETCH_PARAMS = ["paint"];

/**
 * The app's play section (docs/refactor/RENOVATION.md, owner: the frame agent): doodle, quizzes
 * for each other, and the game library's five shelves. Games and the sketchbook open in a
 * full-screen sheet; the URL says which (?game=<id>, ?sketchbook=1), so the tab comes back to it.
 */
export default function PlaySection() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const state = usePlayState();
  const markPlayed = useMarkPlayed();
  const reward = useReward();
  const [moment, setMoment] = useState(null);
  const endMoment = useCallback(() => setMoment(null), []);

  // A colour-club link (?paint=) opens the sketchbook, and keeps it open while the sketchbook
  // tidies the param away.
  useEffect(() => {
    if (params.get("sketchbook") !== "1" && SKETCH_PARAMS.some((key) => params.has(key))) {
      setParams((next) => {
        next.set("sketchbook", "1");
        return next;
      }, { replace: true });
    }
  }, [params, setParams]);

  const gameId = params.get("game");
  const game = gameById(gameId);
  const sketchbook = params.get("sketchbook") === "1";
  const gallery = !sketchbook && !game && (params.get("gallery") === "1" || params.has("doodle"));

  // Opening something pushes a history entry, so the back button and the edge swipe close it.
  const open = useCallback(
    (entries) => {
      const next = new URLSearchParams();
      for (const [key, value] of Object.entries(entries)) if (value !== undefined && value !== null) next.set(key, value);
      navigate({ pathname: "/world/play", search: `?${next}` });
    },
    [navigate],
  );
  const close = useCallback(() => {
    if (tabDepth() > 0) navigate(-1);
    else navigate("/world/play", { replace: true });
  }, [navigate]);

  const openGame = (id) => {
    open({ game: id });
  };
  useEffect(() => {
    if (game && !state.data?.played?.includes(game.id) && state.isSuccess) markPlayed.mutate(game.id);
  }, [game?.id, state.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const onReward = useCallback(
    (value) => {
      const sticker = value?.sticker;
      if (!sticker) return;
      const key = `${Date.now()}`;
      // The capsule machine (luck shelf) saves its own prize; the hub just celebrates it.
      if (value.saved) {
        setMoment({ key, sticker: typeof sticker === "string" ? { id: sticker } : sticker, preview: false });
        state.refetch();
        return;
      }
      reward.mutate(
        { sticker, game: value.game ?? gameId, reason: value.reason ?? "played" },
        {
          onSuccess: (result) => {
            if (result.saved || result.preview) setMoment({ key, sticker: result.sticker, preview: result.preview });
          },
        },
      );
    },
    [gameId, reward, state],
  );

  if (gallery) {
    return (
      <>
        <Suspense fallback={<PageLoader />}>
          <GalleryScreen onStartDoodle={() => open({ sketchbook: 1 })} />
        </Suspense>
        <StickerMoment moment={moment} onDone={endMoment} />
      </>
    );
  }

  return (
    <div className="app-section app-section--play">
      <header className="app-section__head">
        <h1 className="app-section__title">play</h1>
      </header>
      <div className="app-section__body">
        <DoodleCard onOpenSketchbook={() => open({ sketchbook: 1 })} />
        <GalleryCard onOpen={() => open({ gallery: 1 })} onOpenArt={(id) => open({ gallery: 1, doodle: id })} onStart={() => open({ sketchbook: 1 })} />
        {QuizzesEntry ? <QuizzesEntry /> : <QuizzesPlaceholder />}
        <GameLibrary played={state.data?.played} ready={state.isSuccess} onOpen={openGame} />
      </div>

      <GameStage game={game} onClose={close} onReward={onReward} />
      <GameSheet open={sketchbook} title="lets doodle<3" onClose={close} stageClassName="game-sheet__stage--scroll play-sketch-stage">
        <Suspense fallback={<PageLoader />}>
          <MiniSketchbook />
        </Suspense>
      </GameSheet>
      <StickerMoment moment={moment} onDone={endMoment} />
    </div>
  );
}

/** The open game, kept on screen while its sheet slides away. */
function GameStage({ game, onClose, onReward }) {
  const [shown, setShown] = useState(game);
  useEffect(() => {
    if (game) setShown(game);
  }, [game]);
  const Game = useMemo(() => (shown ? lazy(shown.load) : null), [shown]);
  return (
    <GameSheet open={Boolean(game)} title={shown?.title ?? ""} onClose={onClose}>
      {Game && (
        <Suspense fallback={<PageLoader />}>
          <Game key={shown.id} onExit={onClose} onReward={(value) => onReward({ game: shown.id, ...value })} />
        </Suspense>
      )}
    </GameSheet>
  );
}

function QuizzesPlaceholder() {
  return (
    <section className="app-card play-quizzes-soon" aria-labelledby="play-quizzes-title">
      <header className="app-card__head">
        <h2 className="app-card__title" id="play-quizzes-title">
          quizzes for each other
        </h2>
      </header>
      <div className="app-card__body">
        <p>little questions about each other, with scores and streaks. almost ready ♡</p>
      </div>
    </section>
  );
}

/** The game library: one row per shelf, newest-to-her games marked "new". Works with 2 games or 30. */
function GameLibrary({ played, ready, onOpen }) {
  const seen = useMemo(() => new Set(played ?? []), [played]);
  const shelves = SHELVES.map((shelf) => ({ ...shelf, games: GAMES.filter((game) => game.shelf === shelf.id) })).filter((shelf) => shelf.games.length);
  if (!shelves.length) {
    return (
      <section className="app-card app-empty">
        <strong>games are on their way</strong>
        <span>a whole library of little games is being set up for you.</span>
      </section>
    );
  }
  return (
    <section className="play-library" aria-labelledby="play-library-title">
      <h2 className="play-library__title" id="play-library-title">
        games
      </h2>
      {shelves.map((shelf) => (
        <Shelf key={shelf.id} shelf={shelf} seen={seen} ready={ready} onOpen={onOpen} />
      ))}
    </section>
  );
}

function Shelf({ shelf, seen, ready, onOpen }) {
  const row = useRef(null);
  const fresh = ready ? shelf.games.filter((game) => !seen.has(game.id)).length : 0;
  return (
    <section className="play-shelf" data-shelf={shelf.id} aria-labelledby={`play-shelf-${shelf.id}`}>
      <header className="play-shelf__head">
        <span className="play-shelf__mark" aria-hidden="true">
          {shelf.mark}
        </span>
        <h3 id={`play-shelf-${shelf.id}`}>{shelf.title}</h3>
        <span className="play-shelf__blurb">{shelf.blurb}</span>
        <span className="play-shelf__count">
          {fresh > 0 ? `${fresh} new` : `${shelf.games.length} ${shelf.games.length === 1 ? "game" : "games"}`}
        </span>
      </header>
      <ul className="play-shelf__row app-bleed" ref={row} data-few={shelf.games.length < 3 || undefined}>
        {shelf.games.map((game) => {
          const Icon = game.Icon;
          const isNew = ready && !seen.has(game.id);
          return (
            <li key={game.id}>
              <button type="button" className="play-tile" onClick={() => onOpen(game.id)} aria-label={`${game.title}${isNew ? ", new" : ""}. ${game.blurb ?? ""}`}>
                <span className="play-tile__art" aria-hidden="true">
                  {Icon ? <Icon /> : <span className="play-tile__glyph">{shelf.mark}</span>}
                  {isNew && <span className="play-tile__new">new</span>}
                </span>
                <span className="play-tile__text" aria-hidden="true">
                  <strong>{game.title}</strong>
                  {game.blurb && <span>{game.blurb}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
