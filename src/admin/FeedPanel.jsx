import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

const SECTIONS = ["maomao", "music", "dressup", "meme", "merch"];
const words = (value) => String(value ?? "").replaceAll("_", " ");
const mb = (bytes) => `${((bytes ?? 0) / 1024 / 1024).toFixed(1)} MB`;
const when = (value) =>
  value
    ? new Intl.DateTimeFormat("en-SG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Singapore",
      }).format(new Date(value))
    : "—";
const duration = (run) =>
  run?.startedAt && run?.finishedAt
    ? `${Math.max(0, Math.round((new Date(run.finishedAt) - new Date(run.startedAt)) / 1000))} s`
    : null;

// Diagnostic results are already redacted server-side; this only flattens them for reading.
function flatten(value, prefix = "") {
  if (value === null || typeof value !== "object")
    return [[prefix, String(value)]];
  return Object.entries(value).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

function Diagnostics({ data, refresh }) {
  const start = useMutation({
    mutationFn: () =>
      api("/admin/feeds/diagnostics", { method: "POST", body: {} }),
    onSuccess: () => setTimeout(refresh, 4000),
  });
  const results = data.diagnostics;
  return (
    <details>
      <summary>Production checks {results ? "(latest results)" : ""}</summary>
      <p className="admin-muted">
        Bounded, redacted probes from the running deployment: database target
        and migrations, a private Blob write/read/delete of one disposable test
        file, OpenAI moderation/primary/fallback/vision (within the US$0.50
        diagnostic allowance), YouTube (2 quota units), Tumblr and Bluesky
        (read-only). They work while the live pipeline is off, never touch
        Kiriya’s feeds, saves or uploads, and can re-run after 10 minutes.
      </p>
      <div className="admin-row">
        <button
          className="btn btn--soft btn--small"
          disabled={start.isPending}
          onClick={() => start.mutate()}
        >
          {start.isPending ? "Starting…" : "Run production checks"}
        </button>
        <button className="btn btn--ghost btn--small" onClick={refresh}>
          Refresh results
        </button>
      </div>
      {start.data && (
        <p role="status" className="admin-muted">
          {words(start.data.outcome)}
        </p>
      )}
      {results && (
        <ul className="admin-list">
          {Object.entries(results).map(([name, result]) => (
            <li key={name}>
              <div>
                <strong>
                  {name}
                  {name !== "execution" && (result?.ok ? " · ok" : " · needs attention")}
                </strong>
                {flatten(result)
                  .filter(([k]) => k !== "ok")
                  .map(([k, v]) => (
                    <p key={k} className="admin-muted">
                      {k}: {v}
                    </p>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {start.error && <p className="admin-error">{start.error.message}</p>}
    </details>
  );
}

function Stages({ data, latest, run }) {
  const runsFor = (stage, buildId) =>
    data.runs.find((r) => r.stage === stage && (!buildId || r.buildId === buildId));
  return (
    <details>
      <summary>Stages and source health</summary>
      <p className="admin-muted">
        Each stage resumes from its checkpoint. “Run now” works while the
        pipeline is enabled or set to manual runs (FEEDS_ENABLED=manual).
      </p>
      <ul className="admin-list">
        {data.stages.map((stage) => {
          const row = runsFor(stage, latest?.id);
          return (
            <li key={stage}>
              <div>
                <strong>{stage}</strong>
                <p>
                  {row?.status ?? "not run"}
                  {row?.attempt ? ` · attempt ${row.attempt}` : ""}
                  {duration(row) ? ` · ${duration(row)}` : ""}
                  {row?.finishedAt ? ` · ${when(row.finishedAt)}` : ""}
                  {row?.error ? ` · ${words(row.error)}` : ""}
                </p>
                {row?.stats && Object.keys(row.stats).length > 0 && (
                  <p className="admin-muted">
                    {flatten(row.stats)
                      .slice(0, 8)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(" · ")}
                  </p>
                )}
              </div>
              {(data.enabled || data.manualRuns) && latest && (
                <button
                  className="btn btn--ghost btn--small"
                  disabled={run.isPending}
                  onClick={() => run.mutate({ buildId: latest.id, stage })}
                >
                  Run now
                </button>
              )}
            </li>
          );
        })}
        {["events", "maintenance"].map((stage) => {
          const row = runsFor(stage);
          return (
            <li key={stage}>
              <div>
                <strong>{stage} (independent)</strong>
                <p>
                  {row?.status ?? "not run"}
                  {row?.finishedAt ? ` · ${when(row.finishedAt)}` : ""}
                  {row?.error ? ` · ${words(row.error)}` : ""}
                </p>
                {row?.checkpoint && (
                  <p className="admin-muted">
                    {flatten(row.checkpoint)
                      .filter(([k]) => !/cursor|token/i.test(k))
                      .slice(0, 8)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(" · ")}
                  </p>
                )}
              </div>
              {(data.enabled || data.manualRuns) && (
                <button
                  className="btn btn--ghost btn--small"
                  disabled={run.isPending}
                  onClick={() => run.mutate({ stage })}
                >
                  Run now
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <ul className="admin-list">
        {data.sources.map((source) => {
          const health = data.health.find((h) => h.source === source.id);
          return (
            <li key={source.id}>
              <div>
                <strong>
                  {source.id}
                  {source.fixture ? " (fixture)" : ""}
                </strong>
                <p>
                  {source.stage} · {source.mediaPolicy ?? "—"} ·{" "}
                  {health?.status ?? "not checked"} · {health?.lastCount ?? 0}{" "}
                  items · {health?.failStreak ?? 0} consecutive failures
                </p>
                {health?.lastOkAt && (
                  <p className="admin-muted">last success {when(health.lastOkAt)}</p>
                )}
                {health?.lastError && (
                  <p className="admin-muted">last error: {words(health.lastError)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function EditionPreview({ latest, refresh }) {
  const [preview, setPreview] = useState(null);
  const load = useMutation({
    mutationFn: ({ build, section }) =>
      api(`/admin/feeds/preview/${build}/${section}`),
    onSuccess: setPreview,
  });
  // Hide/block clears the preview so a reload shows the edition without the removed item.
  const action = useMutation({
    mutationFn: ({ path, ...body }) =>
      api(`/admin/feeds/${path}`, { method: "POST", body }),
    onSuccess: () => {
      setPreview(null);
      refresh();
    },
  });
  const rewrite = useMutation({
    mutationFn: (body) =>
      api("/admin/feeds/rewrite", { method: "POST", body }),
    onSuccess: () =>
      preview && load.mutate({ build: preview.buildId, section: preview.section }),
  });
  if (!latest) return null;
  const slots = preview
    ? [...preview.slots, ...preview.reserve, ...preview.seenEarlier]
    : [];
  return (
    <div>
      <h3>{latest.mode === "fixture" ? "Fixture edition preview" : "Edition preview"}</h3>
      <p className="admin-muted">
        {latest.day} · revision {latest.generation}. Previewing never marks
        anything seen.
      </p>
      <div className="admin-row">
        {SECTIONS.map((section) => (
          <button
            key={section}
            className="btn btn--soft btn--small"
            disabled={load.isPending}
            onClick={() => load.mutate({ build: latest.id, section })}
          >
            {section}
          </button>
        ))}
      </div>
      {preview && (
        <p className="admin-muted">
          {preview.section} · {preview.editionState ?? "no edition"} ·{" "}
          {slots.length} slots
          {preview.plan?.allocation ? ` · ${preview.plan.allocation}` : ""}
        </p>
      )}
      {preview && (
        <ul className="admin-list">
          {slots.map((slot) => {
            const item = slot.primary;
            const score = preview.scores?.[item.id];
            const thumb = item.media?.[0]?.poster ?? (item.media?.[0]?.type === "image" ? item.media[0].url : null);
            return (
              <li key={slot.key}>
                <div>
                  <strong>
                    {slot.type ? `${slot.type} · ` : ""}
                    {item.blurb?.headline}
                  </strong>
                  <p>{item.blurb?.text}</p>
                  <p className="admin-muted">
                    {item.signature} · {item.credit?.name} · {item.source} ·{" "}
                    {item.kind}
                    {item.blurb?.model ? ` · ${item.blurb.model}` : " · template"}
                    {score ? ` · score ${Number(score.score).toFixed(2)}` : ""}
                    {item.fixture ? " · fixture" : ""}
                    {preview.rewrites?.[item.id] ? " · rewritten" : ""}
                  </p>
                  {score?.parts && (
                    <p className="admin-muted">
                      why:{" "}
                      {Object.entries(score.parts)
                        .filter(([, v]) => Number(v) !== 0)
                        .map(([k, v]) => `${k} ${Number(v).toFixed(2)}`)
                        .join(" · ")}
                    </p>
                  )}
                  {slot.companions?.map((c) => (
                    <p key={c.id} className="admin-muted">
                      + {c.blurb?.headline} ({c.source})
                    </p>
                  ))}
                  {thumb && !item.fixture && (
                    <img
                      src={thumb}
                      alt=""
                      width="96"
                      height="96"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      style={{ objectFit: "cover", borderRadius: 6 }}
                    />
                  )}
                  {!item.fixture && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      Original source
                    </a>
                  )}
                  <div className="admin-row">
                    <button
                      className="btn btn--ghost btn--small"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ path: "hide", id: item.id })}
                    >
                      Hide item
                    </button>
                    <button
                      className="btn btn--ghost btn--small"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({ path: "block", id: item.id, type: "creator" })
                      }
                    >
                      Hide creator
                    </button>
                    <button
                      className="btn btn--ghost btn--small"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({ path: "block", id: item.id, type: "source" })
                      }
                    >
                      Hide source
                    </button>
                    {!item.fixture && (
                      <button
                        className="btn btn--ghost btn--small"
                        disabled={rewrite.isPending}
                        onClick={() => {
                          const published = preview.editionState === "published";
                          if (
                            published &&
                            !window.confirm(
                              "This edition is already published. Rewrite this blurb in place? (One paid writer call; the previous text is kept in the audit trail.)",
                            )
                          )
                            return;
                          rewrite.mutate({
                            buildId: preview.buildId,
                            section: preview.section,
                            id: item.id,
                            published,
                          });
                        }}
                      >
                        {rewrite.isPending ? "Rewriting…" : "Rewrite blurb"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {preview && !slots.length && (
        <p className="admin-muted">No eligible items in this section yet.</p>
      )}
      {[load.error, rewrite.error, action.error].filter(Boolean).map((error, i) => (
        <p role="alert" className="admin-error" key={i}>
          {error.message}
        </p>
      ))}
    </div>
  );
}

const EMPTY_EVENT = {
  name: "",
  url: "",
  startsOn: "",
  endsOn: "",
  venue: "",
  city: "",
  tier: "sg",
  status: "upcoming",
  hers: false,
};

function EventsEditor({ data, refresh }) {
  const [draft, setDraft] = useState(null);
  const save = useMutation({
    mutationFn: (event) =>
      api("/admin/feeds/events", {
        method: "POST",
        body: {
          ...(event.id ? { id: event.id } : {}),
          name: event.name,
          url: event.url,
          startsOn: event.startsOn || null,
          endsOn: event.endsOn || null,
          venue: event.venue || null,
          city: event.city || null,
          country: event.country || null,
          tier: event.tier === "regional" ? "regional" : "sg",
          status: event.status,
          hers: Boolean(event.hers),
        },
      }),
    onSuccess: () => {
      setDraft(null);
      refresh();
    },
  });
  const field = (key, label, type = "text") => (
    <label className="admin-form">
      <span className="admin-muted">{label}</span>
      <input
        className="field"
        type={type}
        value={draft[key] ?? ""}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <details>
      <summary>Events ({data.events.length})</summary>
      <p className="admin-muted">
        Confirming or editing records owner-confirmed dates. Unconfirmed events
        show as TBC.
      </p>
      <ul className="admin-list">
        {data.events.map((event) => (
          <li key={event.id}>
            <div>
              <strong>
                {event.name}
                {event.hers ? " · her pick" : ""}
              </strong>
              <p>
                {event.startsOn ?? "TBC"}
                {event.endsOn && event.endsOn !== event.startsOn ? ` → ${event.endsOn}` : ""} ·{" "}
                {event.tier ?? "—"} · {words(event.confidence)} · {event.status}
              </p>
              {event.lastVerifiedAt && (
                <p className="admin-muted">verified {when(event.lastVerifiedAt)}</p>
              )}
            </div>
            <button
              className="btn btn--ghost btn--small"
              onClick={() =>
                setDraft({
                  ...EMPTY_EVENT,
                  ...event,
                  startsOn: event.startsOn ?? "",
                  endsOn: event.endsOn ?? "",
                })
              }
            >
              Edit
            </button>
          </li>
        ))}
      </ul>
      <button
        className="btn btn--soft btn--small"
        onClick={() => setDraft({ ...EMPTY_EVENT })}
      >
        Add an event
      </button>
      {draft && (
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(draft);
          }}
        >
          {field("name", "Name")}
          {field("url", "Official page (https)", "url")}
          <div className="admin-row">
            {field("startsOn", "Starts", "date")}
            {field("endsOn", "Ends", "date")}
          </div>
          <div className="admin-row">
            {field("venue", "Venue")}
            {field("city", "City")}
          </div>
          <div className="admin-row">
            <select
              className="field"
              value={draft.tier ?? "sg"}
              onChange={(e) => setDraft({ ...draft, tier: e.target.value })}
            >
              <option value="sg">Singapore</option>
              <option value="regional">Regional</option>
            </select>
            <select
              className="field"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              {["upcoming", "cancelled", "hidden", "past"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <label className="admin-muted">
              <input
                type="checkbox"
                checked={Boolean(draft.hers)}
                onChange={(e) => setDraft({ ...draft, hers: e.target.checked })}
              />{" "}
              Kiriya is going
            </label>
          </div>
          <div className="admin-row">
            <button className="btn btn--primary btn--small" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save event"}
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
          {save.error && <p className="admin-error">{save.error.message}</p>}
        </form>
      )}
    </details>
  );
}

function LexiconEditor({ data, refresh }) {
  const toText = (list) => (list ?? []).join("\n");
  const [formats, setFormats] = useState(() => toText(data.lexicon?.formats));
  const [fresh, setFresh] = useState(() => toText(data.lexicon?.fresh));
  const [section, setSection] = useState("maomao");
  const lexicon = () => ({
    formats: formats.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 30),
    fresh: fresh.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 30),
  });
  const preview = useMutation({
    mutationFn: () =>
      api("/admin/feeds/lexicon/preview", {
        method: "POST",
        body: { lexicon: lexicon(), section },
      }),
  });
  const save = useMutation({
    mutationFn: () =>
      api("/admin/feeds/lexicon", { method: "PUT", body: lexicon() }),
    onSuccess: refresh,
  });
  return (
    <details>
      <summary>Voice lexicon</summary>
      <p className="admin-muted">
        Meme formats and fresh phrases the writer may use, one per line. The
        preview writes 10 sample blurbs against current approved items (paid
        writer calls, nothing saved).
      </p>
      <label className="admin-form">
        <span className="admin-muted">Formats</span>
        <textarea
          className="field admin-textarea admin-textarea--short"
          value={formats}
          onChange={(e) => setFormats(e.target.value)}
        />
      </label>
      <label className="admin-form">
        <span className="admin-muted">Fresh phrases</span>
        <textarea
          className="field admin-textarea admin-textarea--short"
          value={fresh}
          onChange={(e) => setFresh(e.target.value)}
        />
      </label>
      <div className="admin-row">
        <select className="field" value={section} onChange={(e) => setSection(e.target.value)}>
          {["maomao", "music", "dressup"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          className="btn btn--soft btn--small"
          disabled={preview.isPending}
          onClick={() => {
            if (window.confirm("Write 10 sample blurbs with this lexicon? This uses the paid writer."))
              preview.mutate();
          }}
        >
          {preview.isPending ? "Writing samples…" : "Preview 10 blurbs"}
        </button>
        <button
          className="btn btn--primary btn--small"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save lexicon"}
        </button>
      </div>
      {save.isSuccess && <p className="admin-muted">Saved. The next writer run uses it.</p>}
      {preview.data?.note && <p className="admin-muted">{preview.data.note}</p>}
      {preview.data?.samples?.length > 0 && (
        <ul className="admin-list">
          {preview.data.samples.map((sample) => (
            <li key={sample.id}>
              <div>
                <strong>{sample.skip ? "(skipped)" : sample.headline}</strong>
                <p>{sample.text}</p>
                <p className="admin-muted">{sample.model ?? "template"}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {[preview.error, save.error].filter(Boolean).map((error, i) => (
        <p role="alert" className="admin-error" key={i}>
          {error.message}
        </p>
      ))}
    </details>
  );
}

function Storage({ data }) {
  const [open, setOpen] = useState(false);
  const saves = useQuery({
    queryKey: ["admin", "feeds", "saves"],
    queryFn: () => api("/admin/feeds/saves"),
    enabled: open,
    retry: false,
  });
  const storage = data.storage;
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Storage and saves</summary>
      <ul className="admin-status">
        <li data-ok={!storage.warning}>
          <span>Saved copies</span>
          <strong>
            {mb(storage.copyBytes)} of {mb(storage.limits?.copyBytes)} cap
          </strong>
        </li>
        <li data-ok>
          <span>Whole private store (her uploads + copies)</span>
          <strong>
            {storage.totalStoreBytes === null
              ? "not measured yet"
              : `${mb(storage.totalStoreBytes)} of ${mb(storage.limits?.totalStoreBytes)}`}
          </strong>
        </li>
        <li data-ok>
          <span>Reserved for copies in progress</span>
          <strong>{mb(storage.reservedBytes)}</strong>
        </li>
        <li data-ok>
          <span>Last measured</span>
          <strong>{when(storage.measuredAt)}</strong>
        </li>
      </ul>
      <p className="admin-muted">
        {Object.entries(storage.saves ?? {})
          .map(([state, v]) => `${words(state)} ${v.count}`)
          .join(" · ") || "No saves yet."}
      </p>
      {saves.data && (
        <ul className="admin-list">
          {saves.data.saves.map((save) => (
            <li key={save.id}>
              <div>
                <strong>{save.title}</strong>
                <p>
                  {save.source} · {words(save.copyPolicy)} · {words(save.copyState)}
                  {save.bytes ? ` · ${mb(save.bytes)}` : ""}
                  {save.attempts ? ` · ${save.attempts} attempts` : ""}
                  {save.removedAt ? " · creator removed" : ""}
                </p>
                {save.error && <p className="admin-muted">{words(save.error)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function Usage({ data }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
  const todays = data.usage.requests.filter(
    (r) =>
      r.createdAt &&
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date(r.createdAt)) === today,
  );
  const sum = (list, key) => list.reduce((total, r) => total + Number(r[key] ?? 0), 0);
  return (
    <details>
      <summary>Estimated usage</summary>
      <p className="admin-muted">
        Includes conservative reservations for uncertain requests. Prices
        checked {data.usage.priceDate}. Today: {todays.length} recorded requests
        · US${(sum(todays, "chargedMicros") / 1e6).toFixed(4)} charged.
      </p>
      <ul className="admin-list">
        {data.usage.months.map((m) => (
          <li key={m.month}>
            <span>{m.month}</span>
            <strong>
              US${m.committedUsd.toFixed(4)} of US${data.usage.monthlyLimitUsd.toFixed(2)}
            </strong>
          </li>
        ))}
      </ul>
      {!data.usage.months.length && (
        <p className="admin-muted">No provider requests recorded.</p>
      )}
    </details>
  );
}

export default function FeedPanel() {
  const cache = useQueryClient();
  const status = useQuery({
    queryKey: ["admin", "feeds"],
    queryFn: () => api("/admin/feeds/status"),
    retry: false,
  });
  const refresh = () =>
    cache.invalidateQueries({ queryKey: ["admin", "feeds"] });
  const run = useMutation({
    mutationFn: async ({
      fixture = false,
      buildId,
      stage,
      force = false,
    } = {}) => {
      let result = await api("/admin/feeds/run", {
        method: "POST",
        body: {
          fixture,
          force,
          ...(buildId ? { buildId } : {}),
          ...(stage ? { stage } : {}),
        },
      });
      if (fixture && !stage) {
        // Each short stage is a separate invocation, using the same persisted build and leases.
        for (
          let step = 0;
          step < 12 &&
          result.buildId &&
          ["completed", "checkpointed"].includes(result.outcome);
          step++
        ) {
          await refresh();
          result = await api("/admin/feeds/run", {
            method: "POST",
            body: { fixture: true, buildId: result.buildId },
          });
          if (result.outcome === "completed" && !result.stage) break;
        }
      }
      return result;
    },
    onSuccess: refresh,
  });
  const action = useMutation({
    mutationFn: ({ path, ...body }) =>
      api(`/admin/feeds/${path}`, { method: "POST", body }),
    onSuccess: refresh,
  });
  const data = status.data;
  const latest = data?.builds[0];
  return (
    <section className="admin-card" aria-labelledby="feed-panel-title">
      <h2 id="feed-panel-title">kiriya’s feeds</h2>
      <p className="admin-muted">
        Daily drops for the Maomao club, music, dress-up, meme of the day and
        the merch shelf. The authored slides stay as the fallback.
      </p>
      {status.isPending && <p>Checking feed setup…</p>}
      {status.error && (
        <p role="alert" className="admin-error">
          Feed tables are not available yet. Run the tracked migrations in an
          isolated local setup or your next deployment.
        </p>
      )}
      {data && (
        <>
          <ul className="admin-status">
            <li data-ok={!data.enabled}>
              <span>Live pipeline</span>
              <strong>
                {data.enabled
                  ? "enabled"
                  : data.manualRuns
                    ? "manual runs only (no cron)"
                    : "off"}
              </strong>
            </li>
            {[
              ["openai", "OpenAI key"],
              ["youtube", "YouTube key"],
              ["tumblr", "Tumblr key"],
              ["bluesky", "Bluesky backup login"],
              ["cron", "Cron secret"],
            ].map(([key, label]) => (
              <li key={key} data-ok={data.setup[key]}>
                <span>{label}</span>
                <strong>
                  {data.setup[key]
                    ? "present; verify with production checks"
                    : "not configured"}
                </strong>
              </li>
            ))}
            <li data-ok>
              <span>Models</span>
              <strong>
                {data.setup.model} → {data.setup.fallbackModel}
              </strong>
            </li>
            <li data-ok>
              <span>Requests per invocation</span>
              <strong>{data.setup.maxRequestsPerInvocation}</strong>
            </li>
            <li>
              <span>Monthly application ceiling</span>
              <strong>US${data.usage.monthlyLimitUsd.toFixed(2)}</strong>
            </li>
          </ul>
          {data.fixtureMode && (
            <>
              <p className="admin-muted">
                Local fixture mode: synthetic notes and fake provider responses.
                These do not prove live source or OpenAI access.
              </p>
              <button
                className="btn btn--primary btn--small"
                disabled={run.isPending}
                onClick={() => run.mutate({ fixture: true, force: true })}
              >
                {run.isPending
                  ? "Running fixture stages…"
                  : "Build local fixture edition"}
              </button>
            </>
          )}
          {(data.enabled || data.manualRuns) && (
            <div className="admin-row">
              <button
                className="btn btn--soft btn--small"
                disabled={run.isPending}
                onClick={() => run.mutate({ buildId: latest?.id })}
              >
                Run next stage
              </button>
              <button
                className="btn btn--ghost btn--small"
                disabled={run.isPending}
                onClick={() => {
                  if (window.confirm("Rebuild today from the first stage? The published edition stays until the new one publishes."))
                    run.mutate({ force: true });
                }}
              >
                Rebuild today
              </button>
            </div>
          )}
          {run.data && (
            <p role="status" className="admin-muted">
              {words(run.data.outcome)}
              {run.data.reason ? `: ${words(run.data.reason)}` : ""}
            </p>
          )}
          <Diagnostics data={data} refresh={refresh} />
          <Stages data={data} latest={latest} run={run} />
          <EditionPreview latest={latest} refresh={refresh} />
          <details>
            <summary>Safety counts and recent items</summary>
            <ul className="admin-list">
              {data.safetyCounts.map((row) => (
                <li key={`${row.safety_status}:${row.reason}`}>
                  <span>
                    {words(row.safety_status)}
                    {row.reason ? ` · ${words(row.reason)}` : ""}
                  </span>
                  <strong>{row.n}</strong>
                </li>
              ))}
            </ul>
            <ul className="admin-list">
              {data.items.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.source} · {item.kind} · {words(item.safetyStatus)} ·{" "}
                      {item.visibility}
                      {item.reason ? ` · ${words(item.reason)}` : ""}
                      {item.scope ? ` · checked: ${words(item.scope)}` : ""}
                      {item.uncertain ? " · approved while uncertain" : ""}
                    </p>
                  </div>
                  {item.visibility === "active" && (
                    <button
                      className="btn btn--ghost btn--small"
                      disabled={action.isPending}
                      onClick={() => action.mutate({ path: "hide", id: item.id })}
                    >
                      Hide
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Rejected items ({data.rejected.length})</summary>
            <ul className="admin-list">
              {data.rejected.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.source} · {words(item.reason)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Hidden items ({data.hidden?.length ?? 0})</summary>
            <p className="admin-muted">
              Kiriya’s “not for me” hides and yours, side by side. Hides never
              train the scoring.
            </p>
            <ul className="admin-list">
              {(data.hidden ?? []).map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      hidden by {item.hiddenBy ?? "—"} · {item.source} ·{" "}
                      {item.kind} · {item.credit?.name}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </details>
          <EventsEditor data={data} refresh={refresh} />
          <LexiconEditor
            key={JSON.stringify(data.lexicon)}
            data={data}
            refresh={refresh}
          />
          <Storage data={data} />
          <Usage data={data} />
        </>
      )}
      {[run.error, action.error].filter(Boolean).map((error, i) => (
        <p role="alert" className="admin-error" key={i}>
          {error.message}
        </p>
      ))}
    </section>
  );
}
