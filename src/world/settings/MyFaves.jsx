import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useSession } from "../../lib/session.js";
import MaomaoMascot from "../mascot/MaomaoMascot.jsx";
import "./MyFaves.css";

const WEIGHTED = [
  { key: "characters", label: "characters u love", placeholder: "e.g. lynette" },
  { key: "voicebanks", label: "voicebanks", placeholder: "e.g. kasane teto" },
  { key: "units", label: "sekai units & oshi", placeholder: "e.g. 25-ji, nightcord de." },
  { key: "fandoms", label: "fandoms", placeholder: "add a show or game" },
];
const LISTS = [
  { key: "eras", label: "music eras", placeholder: "e.g. classics 2007–2013" },
  { key: "producers", label: "producers", placeholder: "e.g. deco*27" },
  { key: "cosplayWishlist", label: "want-to-cosplay list", placeholder: "e.g. fern" },
  { key: "events", label: "events ur going to", placeholder: "pick or type an event" },
  { key: "fashion", label: "fashion styles", placeholder: "e.g. y2k skater" },
  { key: "memeFormats", label: "meme formats", placeholder: "e.g. pov:" },
];
const CREATOR = /^https:\/\/(www\.)?(instagram\.com|tiktok\.com|bsky\.app)\//;
const MAX_LABEL = 80;

function Chips({ label, chips, locked = [], placeholder, onAdd, onRemove, suggestions, validate }) {
  const [text, setText] = useState("");
  const [problem, setProblem] = useState(null);
  const id = useId();
  function add() {
    const value = text.trim();
    if (!value) return;
    const issue = validate?.(value) ?? (value.length > MAX_LABEL ? "that one’s a bit long" : null);
    if (issue) return setProblem(issue);
    onAdd(value);
    setText("");
    setProblem(null);
  }
  return (
    <fieldset className="faves-field">
      <legend>{label}</legend>
      <ul className="faves-chips">
        {locked.map((chip) => (
          <li key={`locked-${chip}`} className="faves-chip faves-chip--locked">
            {chip}
          </li>
        ))}
        {chips.map((chip) => (
          <li key={chip} className="faves-chip">
            {chip}
            <button type="button" aria-label={`Remove ${chip}`} onClick={() => onRemove(chip)}>
              ×
            </button>
          </li>
        ))}
        {!chips.length && !locked.length && <li className="faves-empty">nothing yet</li>}
      </ul>
      <div className="faves-add">
        <input
          className="field"
          value={text}
          placeholder={placeholder}
          maxLength={400}
          list={suggestions?.length ? `${id}-options` : undefined}
          aria-label={`Add to ${label}`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn--soft btn--small" onClick={add}>
          add
        </button>
        {suggestions?.length > 0 && (
          <datalist id={`${id}-options`}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>
      {problem && <p className="settings-card__message">{problem}</p>}
    </fieldset>
  );
}

const weightsOf = (taste, key) => (key === "units" ? taste.sekai?.units : taste[key]) ?? {};

export default function MyFaves() {
  const queryClient = useQueryClient();
  const session = useSession();
  const faves = useQuery({
    queryKey: ["me", "faves"],
    queryFn: () => api("/me/faves"),
    retry: false,
  });
  const events = useQuery({
    queryKey: ["me", "events"],
    queryFn: () => api("/me/events"),
    retry: false,
    staleTime: 10 * 60_000,
  });
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState(null);
  useEffect(() => {
    if (faves.data && !draft) setDraft(structuredClone(faves.data.overrides ?? {}));
  }, [faves.data, draft]);
  const save = useMutation({
    mutationFn: () =>
      api("/me/faves", {
        method: "PUT",
        body: { overrides: draft, expectedRevision: faves.data.revision },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["me", "faves"], data);
      setDraft(structuredClone(data.overrides ?? {}));
      setMessage("saved ♡ changes show up in tomorrow’s drop.");
    },
    onError: (error) => {
      if (error.code === "taste_changed") {
        setDraft(null);
        faves.refetch();
        setMessage("ur faves changed somewhere else, so i reloaded them. have another go.");
      } else if (error.code === "use_kiriya_session")
        setMessage("preview only: faves save from kiriya’s own session.");
      else setMessage("one of those didn’t fit (too long, too many, or not a valid link).");
    },
  });
  // The whole card stays hidden until the feed tables exist, so settings look as before.
  if (!faves.data || !draft) return null;
  const taste = faves.data.taste;
  const dirty = JSON.stringify(draft) !== JSON.stringify(faves.data.overrides ?? {});
  const change = (fn) => {
    setMessage(null);
    setDraft((current) => {
      const next = structuredClone(current);
      fn(next);
      return next;
    });
  };
  const weighted = (key) =>
    Object.entries({ ...weightsOf(taste, key), ...(draft[key] ?? {}) })
      .filter(([, weight]) => weight > 0)
      .map(([name]) => name);
  const listed = (key) => draft[key] ?? taste[key] ?? [];
  const savedOffLimits = faves.data.overrides?.offLimits ?? [];
  const defaultOffLimits = (taste.offLimits ?? []).filter((t) => !savedOffLimits.includes(t));
  const merch = draft.merch ?? {
    minSgd: taste.merch?.minSgd ?? 0,
    maxSgd: taste.merch?.maxSgd ?? 0,
    types: taste.merch?.types ?? [],
  };
  const eventNames = [...new Set((events.data?.events ?? []).map((e) => e.name.toLowerCase()))];
  return (
    <section className="settings-card faves" aria-labelledby="faves-title">
      <div className="settings-card__head">
        <MaomaoMascot expression="herb" size={64} />
        <div>
          <h2 id="faves-title">my faves</h2>
          <p className="settings-card__hint">
            What ur daily drops are built around. Changes show up in tomorrow’s drop.
          </p>
        </div>
      </div>
      {faves.data.invalidOverrides && (
        <p className="settings-card__message">
          Some older faves couldn’t be read, so the defaults are showing. Saving fixes it.
        </p>
      )}
      {WEIGHTED.map(({ key, label, placeholder }) => (
        <Chips
          key={key}
          label={label}
          placeholder={placeholder}
          chips={weighted(key)}
          onAdd={(value) =>
            change((d) => {
              d[key] = { ...(d[key] ?? {}), [value.toLowerCase()]: 0.8 };
            })
          }
          onRemove={(value) =>
            change((d) => {
              d[key] = { ...(d[key] ?? {}), [value]: 0 };
            })
          }
        />
      ))}
      {LISTS.map(({ key, label, placeholder }) => (
        <Chips
          key={key}
          label={label}
          placeholder={placeholder}
          chips={listed(key)}
          suggestions={key === "events" ? eventNames : undefined}
          onAdd={(value) =>
            change((d) => {
              d[key] = [...new Set([...(d[key] ?? taste[key] ?? []), value.toLowerCase()])].slice(0, 40);
            })
          }
          onRemove={(value) =>
            change((d) => {
              d[key] = (d[key] ?? taste[key] ?? []).filter((v) => v !== value);
            })
          }
        />
      ))}
      <Chips
        label="don’t joke about"
        placeholder="anything that’s off-limits"
        locked={defaultOffLimits}
        chips={draft.offLimits ?? savedOffLimits}
        onAdd={(value) =>
          change((d) => {
            d.offLimits = [...new Set([...(d.offLimits ?? savedOffLimits), value.toLowerCase()])].slice(0, 40);
          })
        }
        onRemove={(value) =>
          change((d) => {
            d.offLimits = (d.offLimits ?? savedOffLimits).filter((v) => v !== value);
          })
        }
      />
      <Chips
        label="creators u follow (shown as link cards)"
        placeholder="https://www.instagram.com/…"
        chips={draft.creators ?? taste.creators ?? []}
        validate={(value) => (CREATOR.test(value) && value.length <= 400 ? null : "use an instagram, tiktok or bsky.app link")}
        onAdd={(value) =>
          change((d) => {
            d.creators = [...new Set([...(d.creators ?? taste.creators ?? []), value])].slice(0, 30);
          })
        }
        onRemove={(value) =>
          change((d) => {
            d.creators = (d.creators ?? taste.creators ?? []).filter((v) => v !== value);
          })
        }
      />
      <fieldset className="faves-field">
        <legend>merch budget (SGD)</legend>
        <div className="settings-grid settings-grid--two">
          {["minSgd", "maxSgd"].map((k) => (
            <label key={k}>
              <span>{k === "minSgd" ? "from" : "up to"}</span>
              <input
                className="field"
                type="number"
                min={0}
                max={10000}
                inputMode="numeric"
                value={merch[k]}
                onChange={(e) => {
                  const value = Math.max(0, Math.min(10000, Number(e.target.value) || 0));
                  change((d) => {
                    d.merch = { ...(d.merch ?? merch), [k]: value };
                  });
                }}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <Chips
        label="merch types"
        placeholder="e.g. nendoroid, plush, acrylic stand"
        chips={merch.types}
        onAdd={(value) =>
          change((d) => {
            const current = d.merch ?? merch;
            d.merch = { ...current, types: [...new Set([...current.types, value.toLowerCase()])].slice(0, 40) };
          })
        }
        onRemove={(value) =>
          change((d) => {
            const current = d.merch ?? merch;
            d.merch = { ...current, types: current.types.filter((t) => t !== value) };
          })
        }
      />
      <div className="settings-card__row">
        <button
          type="button"
          className="btn btn--primary btn--small"
          disabled={!dirty || save.isPending || merch.minSgd > merch.maxSgd}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save my faves"}
        </button>
        {dirty && (
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => {
              setDraft(structuredClone(faves.data.overrides ?? {}));
              setMessage(null);
            }}
          >
            Undo changes
          </button>
        )}
        {merch.minSgd > merch.maxSgd && (
          <span className="settings-card__message">the budget “from” is above “up to”.</span>
        )}
        {session.data?.role !== "kiriya" && (
          <span className="settings-card__hint">preview: saving needs kiriya’s session</span>
        )}
      </div>
      {message && (
        <p className="settings-card__message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
