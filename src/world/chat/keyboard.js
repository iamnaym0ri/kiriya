// The composer rides on the keyboard (round 3). In the app the web view used to be resized by the
// Keyboard plugin's "native" mode, which waits for the keyboard's whole animation (+0.2 s) before
// resizing, so the composer lagged behind. While the chat is open the plugin is switched to "none"
// and the chat moves itself: keyboardWillShow arrives as the keyboard starts to rise, with its final
// height, and the composer and messages glide up with it (transform only, on the keyboard's own
// curve). Once the keyboard has settled the lift is committed into the layout (the message list
// gets shorter by the same amount and its scroll position moves with it), so nothing jumps and
// every message stays reachable. Hiding plays the same thing backwards.
//
// Safari (the website, the Simulator) keeps following visualViewport, which is all it offers.
import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";

const SHOW_MS = 260;

/** Whether the app's Keyboard plugin is here (only in the iPhone app). */
export const nativeKeyboard = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Keyboard");

/**
 * @param shell the .chat root; it receives --chat-lift (px, applied as a transform) and
 *        --chat-settled (px, taken out of the layout) and data-kb ("up" | "down").
 * @param viewport the scrolling message list, whose scroll position follows each commit.
 */
export function useKeyboardLift({ shell, viewport, enabled }) {
  const state = useRef({ lift: 0, settled: 0, listLift: 0, timer: 0 });

  useEffect(() => {
    const root = shell.current;
    if (!enabled || !root) return undefined;
    const s = state.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // What the composer already keeps clear at the bottom (the tab bar and home indicator), less the
    // 8 pt it keeps between its row and whatever is under it.
    const clearance = () => {
      const composer = root.querySelector(".composer");
      return composer ? Math.max(0, (parseFloat(getComputedStyle(composer).paddingBottom) || 0) - 8) : 0;
    };
    const apply = ({ animate }) => {
      root.dataset.kbAnimate = animate && !reduced ? "1" : "0";
      root.style.setProperty("--chat-lift", `${-(s.lift - s.settled)}px`);
      root.style.setProperty("--chat-list-lift", `${-(s.listLift)}px`);
      root.style.setProperty("--chat-settled", `${s.settled}px`);
    };
    const list = () => viewport.current;

    // How far the messages must rise so the newest stays just above the composer: all the way
    // when the list is full, not at all when a short chat ends well above where the composer goes.
    const neededListLift = (amount) => {
      const node = list();
      const composer = root.querySelector(".composer");
      if (!node || !composer) return amount;
      const items = node.querySelectorAll("[data-message-id], .typing-row");
      const lastItem = items[items.length - 1];
      if (!lastItem) return 0;
      const contentBottom = Math.min(lastItem.getBoundingClientRect().bottom, node.getBoundingClientRect().bottom);
      const composerTopAfter = composer.getBoundingClientRect().top - amount;
      return Math.max(0, Math.min(amount, contentBottom - composerTopAfter + 6));
    };

    const commit = () => {
      // The keyboard has settled: move the lift into the layout and the list's scroll position.
      const node = list();
      const top = node ? node.scrollTop : 0;
      const listLift = s.listLift;
      s.settled = s.lift;
      s.listLift = 0;
      apply({ animate: false });
      if (node && listLift) node.scrollTop = top + listLift;
      root.dataset.kb = s.lift > 0 ? "up" : "down";
    };

    const move = (height) => {
      clearTimeout(s.timer);
      const target = Math.max(0, Math.round(height - clearance()));
      if (target === s.lift && s.settled === target) return;
      const node = list();
      if (s.settled > 0) {
        // Un-commit first (no animation): the list grows back and is held in place by a transform.
        // (Read the scroll position first: growing the list may already pull it back by itself.)
        const top = node ? node.scrollTop : 0;
        const back = Math.min(s.settled, top);
        s.lift = s.settled;
        s.settled = 0;
        s.listLift = back;
        apply({ animate: false });
        if (node) node.scrollTop = top - back;
        void root.offsetHeight; // the un-committed frame is laid out before the glide starts
      }
      const rising = target > s.lift;
      s.listLift = rising ? s.listLift + neededListLift(target - s.lift) : Math.min(s.listLift, target);
      s.lift = target;
      root.dataset.kb = target > 0 ? "moving" : "down";
      apply({ animate: true });
      s.timer = setTimeout(commit, reduced ? 0 : SHOW_MS + 40);
    };

    let cleanup = () => {};
    let done = false;
    if (nativeKeyboard()) {
      root.dataset.kbNative = "1";
      import("@capacitor/keyboard").then(async ({ Keyboard }) => {
        if (done) return;
        await Keyboard.setResizeMode({ mode: "none" }).catch(() => {});
        const shown = await Keyboard.addListener("keyboardWillShow", ({ keyboardHeight }) => move(keyboardHeight));
        const hidden = await Keyboard.addListener("keyboardWillHide", () => move(0));
        // The page itself never scrolls while the chat is open (the chat moves for the keyboard on
        // its own). If iOS nudges it anyway to show the field, put it straight back.
        const settle = () => (window.scrollY || document.documentElement.scrollTop) && window.scrollTo(0, 0);
        const shownDone = await Keyboard.addListener("keyboardDidShow", settle);
        const hiddenDone = await Keyboard.addListener("keyboardDidHide", settle);
        window.addEventListener("scroll", settle, { passive: true });
        cleanup = () => {
          shown.remove();
          hidden.remove();
          shownDone.remove();
          hiddenDone.remove();
          window.removeEventListener("scroll", settle);
          Keyboard.setResizeMode({ mode: "native" }).catch(() => {});
        };
        if (done) cleanup();
      });
    }
    // Local development: the same glide without a phone (`__chatKeyboard(336)`, `__chatKeyboard(0)`).
    if (import.meta.env.DEV) window.__chatKeyboard = move;
    return () => {
      done = true;
      clearTimeout(s.timer);
      cleanup();
      if (import.meta.env.DEV) delete window.__chatKeyboard;
      s.lift = 0;
      s.settled = 0;
      s.listLift = 0;
      root.style.removeProperty("--chat-lift");
      root.style.removeProperty("--chat-list-lift");
      root.style.removeProperty("--chat-settled");
      delete root.dataset.kbNative;
    };
  }, [shell, viewport, enabled]);
}
