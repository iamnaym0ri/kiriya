import { useState } from "react";
import { useSaveMemory } from "../../lib/chat.js";
import { haptic } from "../../lib/native.js";
import "./SaveMemory.css";

/** "save to our memories ✿" for a letter, a little note or a jar note (the chat has its own, in the long-press menu). */
export default function SaveMemory({ kind, sourceId, className = "text-link save-memory" }) {
  const save = useSaveMemory();
  const [done, setDone] = useState(false);
  if (!sourceId) return null;
  return (
    <button
      type="button"
      className={className}
      disabled={save.isPending || done}
      onClick={() =>
        save.mutate(
          { kind, sourceId },
          {
            onSuccess: () => {
              setDone(true);
              haptic("success");
            },
          },
        )
      }
    >
      {done ? "saved to our memories ✿" : save.isError ? "that didn’t save. try again?" : save.isPending ? "saving…" : "save to our memories ✿"}
    </button>
  );
}
