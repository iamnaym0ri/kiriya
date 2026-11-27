import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { Group, Note, Row, SwitchRow } from "./parts.jsx";

// Josh's desk inside his tab: shortcuts into the places where he edits what she sees in place
// (home's pencils, the notes & letters composers), plus the phone-sized pieces of the website's
// admin desk. Nothing here renders on her phone (MeHome only mounts it for the admin).

export const appTestKey = ["admin", "app-test"];

export function useAppTest() {
  const queryClient = useQueryClient();
  const state = useQuery({ queryKey: appTestKey, queryFn: () => api("/admin/app-test"), staleTime: 15_000 });
  const mode = useMutation({
    mutationFn: (on) => api("/admin/app-test/mode", { method: "POST", body: { on } }),
    onMutate: async (on) => {
      await queryClient.cancelQueries({ queryKey: appTestKey });
      const previous = queryClient.getQueryData(appTestKey);
      if (previous) queryClient.setQueryData(appTestKey, { ...previous, mode: { ...previous.mode, on } });
      return { previous };
    },
    onError: (_error, _on, context) => context?.previous && queryClient.setQueryData(appTestKey, context.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: appTestKey }),
  });
  return { state, mode, on: Boolean(state.data?.mode?.on) };
}

const sgTime = (value) => new Date(value).toLocaleString("en-SG", { timeZone: "Asia/Singapore", weekday: "short", hour: "numeric", minute: "2-digit" });

export default function AdminDesk({ jar }) {
  const test = useAppTest();
  const waiting = jar?.counts?.waiting ?? 0;
  const fresh = jar?.counts?.inJar ?? 0;
  return (
    <>
      <Group title="your desk" note="every change shows on her phone the next time she opens the app.">
        <Row to="/world" icon="home" tone="lilac" label="edit home" hint="tap the pencils on the greeting, photos, songs and pinboard" />
        <Row to="/world/mail?compose=note" icon="note" tone="pink" label="write a little note" />
        <Row to="/world/mail?compose=letter" icon="letter" tone="peach" label="write a letter" />
        <Row
          to="/world/mail?compose=jar"
          icon="jar"
          tone="mint"
          label="the note jar"
          hint={jar ? (waiting ? `${waiting} waiting for the morning` : fresh ? `${fresh} new in her jar` : "add a note for her mornings") : null}
        />
        <Row to="/world/play" icon="brush" tone="butter" label="her doodles" hint="leave a heart or a note on one" />
      </Group>

      <Group title="her phone">
        <SwitchRow
          icon="flask"
          tone="sky"
          label="app test mode"
          hint={test.on && test.state.data?.mode?.until ? `on until ${sgTime(test.state.data.mode.until)} · nothing reaches her` : "buttons, widgets and Siri answer you, not her"}
          checked={test.on}
          disabled={test.mode.isPending || !test.state.data}
          onChange={(on) => test.mode.mutate(on)}
        />
        <Row to="/world/me/try" icon="ring" tone="pink" label="try a notification" hint="a sample of each, on your phone only" />
        <Row to="/world/me/widgets" icon="widgets" tone="lilac" label="her widgets" hint="what they show, and test signals" />
      </Group>
      {test.mode.error && <Note tone="error">{test.mode.error.message}</Note>}

      <Group title="behind the scenes">
        <Row to="/world/me/photos" icon="pen" tone="peach" label="signature & profile photos" />
        <Row to="/world/me/passphrases" icon="key" tone="lilac" label="passphrases" />
        <Row to="/world/me/status" icon="pulse" tone="mint" label="how everything is running" />
        <Row to="/admin" icon="desk" tone="plum" label="the full admin desk" hint="everything else, made for a bigger screen" />
      </Group>
    </>
  );
}
