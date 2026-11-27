import { useEffect, useMemo, useState } from "react";
import { openPrivate, useMediaUrl } from "../../../lib/chatCrypto.js";
import { chatLook } from "./list.js";

/** Opens her background photo's sealed file key (prefs.backgroundKey), if it has one. */
function useBackgroundFile(prefs) {
  const envelope = prefs?.backgroundKey ?? null;
  const url = prefs?.background === "photo" ? (prefs?.backgroundUrl ?? null) : null;
  const [opened, setOpened] = useState({ for: null, sealed: null });
  const id = envelope ? `${envelope.k}:${envelope.sealed.slice(0, 24)}` : null;
  useEffect(() => {
    if (!envelope || !url) return undefined;
    let alive = true;
    openPrivate("background", envelope).then((value) => alive && setOpened({ for: id, sealed: value?.key ? { key: value.key, mime: value.mime } : false }));
    return () => {
      alive = false;
    };
    // `id` names the envelope; its object identity changes on every prefs refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, url]);
  if (!url) return null;
  if (!envelope) return { url };
  if (opened.for !== id) return { url, sealed: "opening" };
  return opened.sealed ? { url, sealed: opened.sealed } : null;
}

/**
 * The .chat root's attributes for someone's prefs (theme/list.js chatLook), with her photo
 * background opened and ready to show. Spread the result onto the element.
 */
export function useChatLook(prefs) {
  const file = useBackgroundFile(prefs);
  const photoUrl = useMediaUrl(file && file.sealed !== "opening" ? file : null);
  return useMemo(() => {
    const look = chatLook(prefs);
    if (look["data-background"] !== "photo") return look;
    // Until the photo has opened (or if it can't), the theme's own background shows instead.
    if (!photoUrl) return { ...look, "data-background": "theme", style: {} };
    return { ...look, style: { ...look.style, "--chat-photo": `url("${photoUrl}")` } };
  }, [prefs, photoUrl]);
}
