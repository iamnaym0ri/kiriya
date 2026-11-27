import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { useIsAdmin } from "../../lib/session.js";
import { useDailyStyle } from "../../shared/DailyStyle.jsx";
import { AdminEdit, EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";
import { MeIcon } from "./parts.jsx";

// The top of her tab: her little world at a glance (server/routes/meSection.js `glance`). On Josh's
// phone it's the same card she sees, with a pencil for the things only he sets.

export const glanceKey = ["me", "glance"];

export function useGlance() {
  return useQuery({ queryKey: glanceKey, queryFn: () => api("/me/glance"), staleTime: 30_000, refetchOnWindowFocus: true });
}

const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

// Her own card says hello instead of repeating the name already in the tab's title.
function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-SG", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Singapore" }).format(now));
  if (hour < 5) return "still up, lovely?";
  if (hour < 12) return "morning, lovely";
  if (hour < 18) return "hi, lovely";
  return "evening, lovely";
}

function Avatar({ url, name }) {
  return (
    <span className="me-profile__avatar" aria-hidden="true">
      {url ? (
        <img src={url} alt="" width="68" height="68" />
      ) : (
        <span className="me-profile__monogram">{name.slice(0, 1).toLowerCase()}</span>
      )}
      <svg className="me-profile__bloom" viewBox="0 0 24 24" width="22" height="22">
        <path d="M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zM12 9.6c-1.2-2.2-.6-4.6 0-5.4.6.8 1.2 3.2 0 5.4zM14.4 12c2.2-1.2 4.6-.6 5.4 0-.8.6-3.2 1.2-5.4 0zM12 14.4c1.2 2.2.6 4.6 0 5.4-.6-.8-1.2-3.2 0-5.4zM9.6 12c-2.2 1.2-4.6.6-5.4 0 .8-.6 3.2-1.2 5.4 0z" />
      </svg>
    </span>
  );
}

function Stat({ to, value, label }) {
  return (
    <Link className="me-stat" to={to}>
      <strong>{value ?? "·"}</strong>
      <span>{label}</span>
    </Link>
  );
}

/** Josh sets the day they count from (or clears it). */
function TogetherSheet({ open, onClose, since }) {
  const queryClient = useQueryClient();
  const [day, setDay] = useState(since ?? "");
  useEffect(() => {
    if (open) setDay(since ?? "");
  }, [open, since]);
  const save = useMutation({
    mutationFn: (value) => api("/admin/hub/together", { method: "PUT", body: { since: value } }),
    onSuccess: (data) => queryClient.setQueryData(glanceKey, data),
  });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <EditSheet
      open={open}
      title="our day"
      subtitle="her card counts the days of you two from it"
      onClose={onClose}
      dirty={(day || null) !== (since ?? null)}
      saveDisabled={!day}
      onSave={() => save.mutateAsync(day)}
      onDelete={since ? () => save.mutateAsync(null) : undefined}
      deleteLabel="Take the count off her card"
    >
      <EditField label="the day it all started" hint="only you can change this. it shows on her card as “… days of us”.">
        <input type="date" value={day} max={today} onChange={(event) => setDay(event.target.value)} />
      </EditField>
    </EditSheet>
  );
}

export default function ProfileCard() {
  const glance = useGlance();
  const admin = useIsAdmin();
  const { current, open: openCorner, allowed } = useDailyStyle();
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const data = glance.data;
  const counts = data?.counts ?? {};
  const name = data?.displayName ?? "Kiriya";
  const together = data?.together;
  const birthdaySoon = data && data.birthday.daysUntil > 0 && data.birthday.daysUntil <= 30;

  return (
    <section className="app-card me-profile" aria-label={admin ? "Her little world, as she sees it" : "Your little world"}>
      <div className="me-profile__top">
        <Avatar url={data?.avatarUrl} name={name} />
        <div className="me-profile__who">
          <span className="me-profile__tag">{admin ? `${name.toLowerCase()}’s` : "your"} little world</span>
          <h2 className="me-profile__name">{admin ? name.toLowerCase() : greeting()}</h2>
          {allowed && (
            <button type="button" className="me-profile__feeling" onClick={openCorner}>
              <span className="me-profile__feeling-face" aria-hidden="true">
                {current?.feeling?.emoji ?? <MeIcon name="heart" size={14} />}
              </span>
              <span>{current ? `${current.label.toLowerCase()} · ${current.feeling?.label?.toLowerCase() ?? "feeling it out"}` : "how are you feeling?"}</span>
            </button>
          )}
        </div>
        {admin && <AdminEdit compact label="her profile photos" className="me-profile__edit" onClick={() => navigate("/world/me/photos")} />}
      </div>

      <div className="me-profile__stats">
        <Stat to="/world/mail" value={counts.letters} label={plural(counts.letters, "letter")} />
        <Stat to="/world/mail" value={counts.notes} label={plural(counts.notes, "note")} />
        <Stat to="/world/play" value={counts.doodles} label={plural(counts.doodles, "doodle")} />
        <Stat to="/world/play" value={counts.stickers} label={plural(counts.stickers, "sticker")} />
      </div>

      {(together || birthdaySoon || admin) && (
        <div className="me-profile__ribbon">
          {together ? (
            <span className="me-profile__days">
              <span aria-hidden="true">✿</span> {together.days.toLocaleString("en-SG")} days of us
            </span>
          ) : birthdaySoon ? null : (
            admin && <span className="me-profile__days me-profile__days--unset">count the days of you two?</span>
          )}
          {birthdaySoon && (
            <span className="me-profile__birthday">
              {data.birthday.daysUntil === 1 ? "your birthday is tomorrow ♡" : `${data.birthday.daysUntil} days till your birthday ♡`}
            </span>
          )}
          {admin && <AdminEdit compact label="our day" onClick={() => setEditing(true)} />}
        </div>
      )}
      {admin && <TogetherSheet open={editing} onClose={() => setEditing(false)} since={together?.since ?? null} />}
    </section>
  );
}
