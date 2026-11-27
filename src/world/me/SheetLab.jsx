import { useState } from "react";
import { AdminEdit, EditField, EditSheet } from "../../shared/admin/AdminEdit.jsx";

// Dev only (/world/me?lab=sheet): the shared admin pencil and sheet, with every state to try.
export default function SheetLab() {
  const [open, setOpen] = useState(null);
  const [text, setText] = useState("there you are, lovely.");
  const [draft, setDraft] = useState(text);
  const [fail, setFail] = useState(false);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  return (
    <div className="app-section">
      <header className="app-section__head">
        <h1 className="app-section__title">sheet lab</h1>
      </header>
      <div className="app-section__body" style={{ display: "grid", gap: 16, padding: "0 16px" }}>
        <p style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong data-testid="greeting">{text}</strong>
          <AdminEdit label="greeting" onClick={() => { setDraft(text); setOpen("edit"); }} />
          <AdminEdit label="greeting" compact onClick={() => { setDraft(text); setOpen("edit"); }} />
        </p>
        <label><input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> saving fails</label>
        <button type="button" onClick={() => setOpen("long")}>a long sheet</button>
        <button type="button" onClick={() => setOpen("info")}>a sheet with no save</button>
      </div>
      <EditSheet
        open={open === "edit"}
        title="the greeting"
        subtitle="she sees it at the top of home"
        onClose={() => setOpen(null)}
        dirty={draft !== text}
        saveDisabled={!draft.trim()}
        onSave={async () => {
          await wait(600);
          if (fail) throw new Error("That didn’t save. Check the connection and try again.");
          setText(draft);
        }}
        onDelete={async () => { await wait(300); setText(""); }}
        deleteLabel="Clear the greeting"
      >
        <EditField label="greeting" hint="a short line, lowercase is lovely">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} />
        </EditField>
        <EditField label="a longer note">
          <textarea rows={4} placeholder="something for later…" />
        </EditField>
      </EditSheet>
      <EditSheet open={open === "long"} title="a long one" onClose={() => setOpen(null)} onSave={() => wait(300)}>
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i}>line {i + 1}: scroll me, then pull down from the top to close.</p>
        ))}
      </EditSheet>
      <EditSheet open={open === "info"} title="just looking" onClose={() => setOpen(null)}>
        <p>no save button, only Done.</p>
      </EditSheet>
    </div>
  );
}
