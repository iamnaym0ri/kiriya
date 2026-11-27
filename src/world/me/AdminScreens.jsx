import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useIsAdmin } from "../../lib/session.js";
import { haptic, isNativeApp, refreshWidgets } from "../../lib/native.js";
import { shrinkImage, uploadFile } from "../../lib/uploads.js";
import { TAPS } from "../../../shared/taps.js";
import { EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";
import { appTestKey, useAppTest } from "./AdminDesk.jsx";
import { glanceKey } from "./ProfileCard.jsx";
import { PassphraseForm } from "./SettingsScreens.jsx";
import { Group, MeIcon, Note, Row, Screen, SwitchRow } from "./parts.jsx";

// Josh's screens inside his tab: the phone-sized parts of the website's admin desk (src/admin),
// talking to the same /api/admin routes. The website's /admin stays as it is.

const sgTime = (value) => new Date(value).toLocaleString("en-SG", { timeZone: "Asia/Singapore", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Only for the admin: her phone never shows these screens, even from a typed link. */
function AdminOnly({ children }) {
  const admin = useIsAdmin();
  if (!admin)
    return (
      <Screen title="just for josh">
        <div className="app-empty">
          <strong>nothing to see here ♡</strong>
        </div>
      </Screen>
    );
  return children;
}

/* ---------- try a notification ---------- */

const KINDS = [
  { kind: "chat", icon: "chat", tone: "lilac", label: "a chat message" },
  { kind: "tap", icon: "heart", tone: "pink", label: "thinking of you" },
  { kind: "note", icon: "note", tone: "peach", label: "a little note", hint: "opens in the notification" },
  { kind: "letter", icon: "letter", tone: "butter", label: "a letter", hint: "opens in the notification" },
  { kind: "jar", icon: "jar", tone: "mint", label: "the jar’s morning" },
  { kind: "reminder", icon: "bell", tone: "sky", label: "the jar’s evening nudge" },
];

function useTry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api("/admin/app-test/try", { method: "POST", body }),
    onSuccess: () => {
      haptic("success");
      queryClient.invalidateQueries({ queryKey: appTestKey });
    },
  });
}

function tryOutcome(result) {
  const app = result?.push?.app;
  if (!app) return "sent ♡";
  if (!app.targets) return "no app phone of yours has notifications on yet.";
  return `sent to ${app.sent} of ${app.targets} of your app phones${app.error ? ` · ${app.error}` : ""} ♡`;
}

export function TryScreen() {
  const test = useAppTest();
  const tryOne = useTry();
  const data = test.state.data;
  return (
    <AdminOnly>
      <Screen title="try a notification" short="try one" subtitle="a sample of each, to your own phone only. trying one turns test mode on, so its buttons answer you instead of her.">
        <Group>
          <SwitchRow
            icon="flask"
            tone="sky"
            label="app test mode"
            hint={test.on && data?.mode?.until ? `on until ${sgTime(data.mode.until)}` : `switches itself off after ${data?.hours ?? 12} hours`}
            checked={test.on}
            disabled={test.mode.isPending || !data}
            onChange={(on) => test.mode.mutate(on)}
          />
        </Group>
        <Group title="send me" note={data ? `your app phones with notifications on: ${data.phones}` : null}>
          {KINDS.map((item) => (
            <Row
              key={item.kind}
              onClick={() => tryOne.mutate({ kind: item.kind })}
              icon={item.icon}
              tone={item.tone}
              label={item.label}
              hint={item.hint}
              detail={tryOne.isPending && tryOne.variables?.kind === item.kind && !tryOne.variables?.tap ? "sending…" : null}
            />
          ))}
        </Group>
        <Note tone={tryOne.error ? "error" : "soft"}>{tryOne.error?.message ?? (tryOne.isSuccess ? tryOutcome(tryOne.data) : null)}</Note>
        {data?.log?.length > 0 && (
          <Group title="what your phone sent while testing">
            {data.log.map((entry) => (
              <Row key={entry.at} icon="sparkle" tone="lilac" label={`✓ ${entry.what}`} hint={`from ${entry.channel} · ${sgTime(entry.at)}${entry.replyTo ? " · as a reply" : ""}`} />
            ))}
          </Group>
        )}
      </Screen>
    </AdminOnly>
  );
}

/* ---------- widgets ---------- */

function NotePreview({ note }) {
  return (
    <div className="me-widget me-widget--note">
      <span className="me-widget__tape" aria-hidden="true" />
      <small>little note</small>
      {note ? (
        <>
          <strong>{note.title || "a little note"}</strong>
          <p>{note.preview}</p>
          <em>{note.opened ? (note.reaction ? "she loved it ♡" : "she opened it") : "not opened yet"}</em>
        </>
      ) : (
        <p className="me-widget__empty">no notes yet</p>
      )}
    </div>
  );
}

function JarPreview({ fresh }) {
  return (
    <div className="me-widget me-widget--jar">
      <small>note jar</small>
      <span className="me-widget__jar" aria-hidden="true">
        <MeIcon name="jar" size={40} />
        {fresh > 0 && <span className="me-widget__heart">♥</span>}
      </span>
      <strong>{fresh > 0 ? `${fresh} new ${fresh === 1 ? "note" : "notes"}` : "pull a note"}</strong>
    </div>
  );
}

function ConPreview({ event }) {
  return (
    <div className="me-widget me-widget--con">
      <small>next con</small>
      {event ? (
        <>
          <strong>{event.title}</strong>
          <p>{event.daysAway > 0 ? `in ${event.daysAway} ${event.daysAway === 1 ? "day" : "days"}` : event.daysAway === 0 ? "today!!" : "happening now"}</p>
          {event.venue && <em>{event.venue}</em>}
        </>
      ) : (
        <p className="me-widget__empty">nothing coming up yet</p>
      )}
    </div>
  );
}

function SignalsPreview({ taps = TAPS }) {
  return (
    <div className="me-widget me-widget--signals">
      <small>thinking of you</small>
      <div className="me-widget__taps">
        {taps.slice(0, 4).map((tap) => (
          <span key={tap.key}>
            <b aria-hidden="true">{tap.emoji}</b>
            {tap.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const HOW_TO_ADD = "touch and hold an empty spot on your Home Screen, tap Edit → Add Widget, and search for kiriya.love. there’s a little note, the note jar, thinking of you and the next con.";

export function WidgetsScreen() {
  const admin = useIsAdmin();
  const snapshot = useQuery({ queryKey: ["admin", "hub", "widgets"], queryFn: () => api("/admin/hub/widgets"), enabled: admin, refetchOnWindowFocus: true });
  const tryOne = useTry();
  const [refreshed, setRefreshed] = useState(false);
  const data = snapshot.data;

  return (
    <Screen title={admin ? "her widgets" : "home screen widgets"} short="widgets" subtitle={admin ? "what her widgets show right now, from the same snapshot her phone reads." : HOW_TO_ADD}>
      <div className="me-widgets" aria-label="Widget previews">
        <NotePreview note={admin ? data?.latestNote : { title: "a little note for you", preview: "his newest note, the moment it arrives. tap it to peel it open.", opened: true }} />
        <JarPreview fresh={admin ? data?.jar?.fresh ?? 0 : 2} />
        <SignalsPreview taps={data?.taps ?? TAPS} />
        <ConPreview event={admin ? data?.nextEvent : { title: "the next con", daysAway: 12, venue: "a countdown to it" }} />
      </div>
      {admin && snapshot.error && <Note tone="error">{snapshot.error.message}</Note>}

      {admin && (
        <>
          <Group title="send me a signal" note="each one plays its own little sound and has its own buttons. sent to your phone only, in test mode.">
            {TAPS.map((tap) => (
              <Row
                key={tap.key}
                onClick={() => tryOne.mutate({ kind: "tap", tap: tap.key })}
                icon={null}
                label={
                  <>
                    <span className="me-emoji" aria-hidden="true">
                      {tap.emoji}
                    </span>{" "}
                    {tap.label}
                  </>
                }
                detail={tryOne.isPending && tryOne.variables?.tap === tap.key ? "sending…" : tap.kaomoji}
              />
            ))}
          </Group>
          <Note tone={tryOne.error ? "error" : "soft"}>{tryOne.error?.message ?? (tryOne.isSuccess ? tryOutcome(tryOne.data) : null)}</Note>
          <Group note={HOW_TO_ADD}>
            <Row
              onClick={async () => {
                await refreshWidgets({ force: true });
                snapshot.refetch();
                setRefreshed(true);
              }}
              icon="sparkle"
              tone="lilac"
              label={isNativeApp() ? "refresh the widgets on my phone" : "refresh the preview"}
              detail={refreshed ? "done ♡" : null}
            />
          </Group>
        </>
      )}
    </Screen>
  );
}

/* ---------- signature and profile photos ---------- */

function PhotoRow({ label, url, round, busy, onPick }) {
  return (
    <li className="app-row me-row me-photo">
      <span className={`me-photo__thumb${round ? " me-photo__thumb--round" : ""}`}>{url ? <img src={url} alt="" /> : <MeIcon name="photo" />}</span>
      <span className="app-row__text">
        <span className="me-row__label">{label}</span>
        <small>{busy ? "uploading…" : url ? "tap to change" : "no photo yet"}</small>
      </span>
      <label className="me-photo__pick">
        {url ? "change" : "add"}
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onPick(file);
          }}
        />
      </label>
    </li>
  );
}

export function PhotosScreen() {
  const queryClient = useQueryClient();
  const admin = useIsAdmin();
  const profile = useQuery({ queryKey: ["admin", "profile"], queryFn: () => api("/admin/profile"), enabled: admin });
  const [busy, setBusy] = useState(null);
  const [problem, setProblem] = useState(null);
  const [editing, setEditing] = useState(false);
  const [signature, setSignature] = useState("");
  useEffect(() => {
    if (editing) setSignature(profile.data?.signature ?? "");
  }, [editing, profile.data?.signature]);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "profile"] });
    queryClient.invalidateQueries({ queryKey: ["public-profile"] });
    queryClient.invalidateQueries({ queryKey: ["me", "public-preview"] });
    queryClient.invalidateQueries({ queryKey: glanceKey });
  };
  const saveSignature = useMutation({ mutationFn: (value) => api("/admin/signature", { method: "PUT", body: { signature: value } }), onSuccess: refresh });
  const saveMedia = useMutation({ mutationFn: (body) => api("/admin/profile/media", { method: "PUT", body }), onSuccess: refresh });

  async function upload(slot, folder, file, apply) {
    setBusy(slot);
    setProblem(null);
    try {
      const shrunk = await shrinkImage(file, folder === "avatar" ? 800 : 1400);
      const { url } = await uploadFile(shrunk, { folder });
      await saveMedia.mutateAsync(apply(url));
      haptic("success");
    } catch (error) {
      setProblem(error.message || "that photo didn’t upload. try again?");
    } finally {
      setBusy(null);
    }
  }

  const data = profile.data;
  return (
    <AdminOnly>
      <Screen title="signature & photos" short="photos" subtitle="your signature ends every letter and note. the photos are on her public page.">
        <Group title="signature">
          <Row onClick={() => setEditing(true)} icon="pen" tone="peach" label={data?.signature ?? "…"} hint="how your letters are signed" more />
        </Group>
        {data && (
          <Group title="her public page" note="photos are made smaller before they upload.">
            <PhotoRow label="profile picture" url={data.avatarUrl} round busy={busy === "avatar"} onPick={(file) => upload("avatar", "avatar", file, (url) => ({ avatarUrl: url }))} />
            {data.cosplays.map((cosplay, index) => (
              <PhotoRow
                key={cosplay.character}
                label={cosplay.character}
                url={cosplay.photoUrl}
                busy={busy === cosplay.character}
                onPick={(file) =>
                  upload(cosplay.character, "cosplay", file, (url) => ({ cosplays: data.cosplays.map((c, j) => (j === index ? { ...c, photoUrl: url } : c)) }))
                }
              />
            ))}
          </Group>
        )}
        <Note tone="error">{problem ?? profile.error?.message}</Note>
        <EditSheet
          open={editing}
          title="your signature"
          onClose={() => setEditing(false)}
          dirty={signature !== (data?.signature ?? "")}
          saveDisabled={!signature.trim()}
          onSave={() => saveSignature.mutateAsync(signature)}
        >
          <EditField label="signature" hint="up to 40 characters, e.g. Josh <3">
            <input value={signature} maxLength={40} onChange={(event) => setSignature(event.target.value)} autoCapitalize="words" />
          </EditField>
        </EditSheet>
      </Screen>
    </AdminOnly>
  );
}

/* ---------- passphrases ---------- */

export function PassphrasesScreen() {
  const queryClient = useQueryClient();
  const admin = useIsAdmin();
  const credentials = useQuery({ queryKey: ["admin", "credentials"], queryFn: () => api("/admin/credentials"), enabled: admin });
  const [asking, setAsking] = useState(false);
  const reset = useMutation({
    mutationFn: () => api("/admin/credentials/kiriya/reset", { method: "POST", body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "credentials"] }),
  });
  const kiriya = credentials.data?.kiriya;
  return (
    <AdminOnly>
      <Screen title="passphrases" subtitle="she can change hers in her own tab. if she ever forgets it, put the original back here.">
        <Group title="hers">
          <Row
            icon="key"
            tone="pink"
            label={kiriya?.custom ? "she chose her own" : "the original one"}
            hint={kiriya?.custom ? `on ${sgTime(kiriya.changedAt)}` : "the passphrase set up for her"}
          />
          {kiriya?.custom && <Row onClick={() => setAsking(true)} icon="lock" tone="plum" label="she forgot it: put the original back" danger />}
        </Group>
        {reset.isSuccess && <Note>done. her devices will ask for the original passphrase.</Note>}
        <h2 className="app-group-title">yours</h2>
        <PassphraseForm />
        <EditSheet open={asking} title="put the original back?" onClose={() => setAsking(false)} saveLabel="Reset" onSave={() => reset.mutateAsync()}>
          <p className="me-sheet-text">her passphrase goes back to the original one, and every device of hers signs out. tell her the original before you do ♡</p>
        </EditSheet>
      </Screen>
    </AdminOnly>
  );
}

/* ---------- how everything is running ---------- */

const SERVICE_LABELS = {
  database: "database",
  passphrases: "passphrases set",
  sessions: "private sessions",
  collection: "content collection",
  scheduler: "surprise scheduler (QStash)",
  cronSecret: "daily backstop",
  push: "push notifications",
  fileStorage: "file storage",
};

export function StatusScreen() {
  const admin = useIsAdmin();
  const status = useQuery({ queryKey: ["admin", "status"], queryFn: () => api("/admin/status"), enabled: admin, refetchOnWindowFocus: true });
  const test = useAppTest();
  const data = status.data;
  return (
    <AdminOnly>
      <Screen title="how everything is running" short="status">
        {status.error && <Note tone="error">{status.error.message}</Note>}
        {data && (
          <>
            <Group title="services">
              {Object.entries(data.services).map(([key, value]) => {
                const ok = value === true || typeof value === "string";
                return (
                  <li key={key} className="app-row me-row">
                    <span className={`me-dot${ok ? " me-dot--ok" : ""}`} aria-hidden="true" />
                    <span className="app-row__text">
                      <span className="me-row__label">{SERVICE_LABELS[key] ?? key}</span>
                      {typeof value === "string" && <small>{value}</small>}
                    </span>
                    <span className="app-row__detail">{ok ? "ready" : "not set up"}</span>
                  </li>
                );
              })}
            </Group>
            <Group title="phones">
              <Row icon="bell" tone="pink" label="her devices with surprises on" detail={String(data.devices.filter((d) => d.role === "kiriya").length)} />
              <Row icon="phones" tone="sky" label="your app phones with notifications" detail={test.state.data ? String(test.state.data.phones) : ""} />
              <Row icon="flask" tone="lilac" label="app test mode" detail={test.on ? "on" : "off"} />
            </Group>
            <Group title="today" note={`singapore day ${data.day}`}>
              <Row icon="calendar" tone="peach" label="today’s little bundle" detail={data.today ? `${data.today.cards} notes` : "not made yet"} />
            </Group>
          </>
        )}
      </Screen>
    </AdminOnly>
  );
}
