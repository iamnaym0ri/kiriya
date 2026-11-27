// The composer's field in the app (round 3): a contenteditable kept to plain text, so the iPhone
// keyboard offers its own stickers and Genmoji. iOS only offers them to a richly editable field,
// and only when the web view allows adaptive image glyphs (MainViewController sets
// WKWebViewConfiguration.supportsAdaptiveImageGlyph). WebKit then inserts one as
//   <picture><source type="image/x-apple-adaptive-glyph" srcset="blob:…"><img src="blob:…" alt="…"></picture>
// (Editor::insertMultiRepresentationHEIC). We take it straight back out of the field and hand it
// over as a picture (`onGlyph`), so the words stay plain text.
//
// Plain-text discipline: pasted or dropped text goes in as text only (execCommand insertText keeps
// undo working), formatting commands do nothing, return makes a line break (it sends on a computer
// keyboard), and the IME, autocorrect, dictation and suggestions are left entirely alone.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const STICKER_EDGE = 320;

/** The field's words, as plain text. */
export function readText(node) {
  if (!node) return "";
  const text = (node.innerText ?? node.textContent ?? "").replace(/ /g, " ");
  return text === "\n" ? "" : text;
}

function caretToEnd(node) {
  const selection = window.getSelection?.();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Replaces the field's words (an edit to start, a draft back, or empty after sending). */
export function setText(node, value, { caretEnd = true } = {}) {
  if (!node) return;
  node.textContent = value ?? "";
  if (caretEnd && document.activeElement === node) caretToEnd(node);
}

async function decode(blob) {
  try {
    return await createImageBitmap(blob);
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * A sticker or Genmoji as a PNG with its transparency (at most 320 px; the glyph's own HEIC holds
 * its sharpest version, the <img> only a small fallback). Returns { file, width, height } or null.
 */
export async function stickerPng(blob) {
  const image = await decode(blob);
  const w = image.width || image.naturalWidth;
  const h = image.height || image.naturalHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, STICKER_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();
  const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) return null;
  return { file: new File([png], "sticker.png", { type: "image/png" }), width: canvas.width, height: canvas.height };
}

/** Whether a pasted picture looks like a sticker (small, with see-through parts) rather than a photo. */
export async function looksLikeSticker(file) {
  if (!/^image\/(png|webp|gif|heic|heif)$/.test(file.type)) return false;
  try {
    const image = await decode(file);
    const w = image.width || image.naturalWidth;
    const h = image.height || image.naturalHeight;
    if (!w || !h || Math.max(w, h) > 640) return false;
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(64, w);
    canvas.height = Math.min(64, h);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
    return false;
  } catch {
    return false;
  }
}

/** The picture behind a glyph WebKit put in the field: its HEIC (sharpest) or the fallback image. */
async function glyphPicture(element) {
  const picture = element.tagName === "PICTURE" ? element : element.closest?.("picture");
  const img = picture ? picture.querySelector("img") : element;
  const sources = picture ? [...picture.querySelectorAll("source")] : [];
  const candidates = [
    ...sources.map((source) => (source.getAttribute("srcset") ?? "").trim().split(/\s+/)[0]),
    img?.getAttribute("src"),
  ].filter((url) => url && /^(blob:|data:image\/)/.test(url));
  for (const url of candidates) {
    try {
      const response = await fetch(url);
      const raw = await response.blob();
      // The glyph's type (image/x-apple-adaptive-glyph) isn't one browsers know; its bytes are HEIC.
      const blob = raw.type === "image/x-apple-adaptive-glyph" ? new Blob([raw], { type: "image/heic" }) : raw;
      const png = await stickerPng(blob);
      if (png) return { ...png, alt: (img?.getAttribute("alt") ?? "").slice(0, 200) };
    } catch {
      // Try the next representation.
    }
  }
  return null;
}

export const RichField = forwardRef(function RichField({ placeholder, empty, label, onText, onGlyph, onFiles, onSubmit, onEscape, onFocus, onBlur }, ref) {
  const node = useRef(null);
  const handlers = useRef({});
  handlers.current = { onText, onGlyph, onFiles, onSubmit, onEscape };
  useImperativeHandle(ref, () => node.current, []);

  useEffect(() => {
    const field = node.current;
    if (!field) return undefined;
    const report = () => handlers.current.onText?.(readText(field));

    const beforeInput = (event) => {
      if (event.isComposing) return;
      const type = event.inputType ?? "";
      // Bold, italic, underline, colours, fonts…: never in a chat message.
      if (type.startsWith("format")) return event.preventDefault();
      if (type === "insertParagraph" || type === "insertLineBreak") {
        if (window.matchMedia?.("(pointer: fine)").matches && type === "insertParagraph") {
          event.preventDefault();
          handlers.current.onSubmit?.();
          return;
        }
        // A plain line break instead of a new <div> block.
        if (type === "insertParagraph") {
          event.preventDefault();
          document.execCommand("insertLineBreak");
        }
      }
    };

    const paste = (event) => {
      const data = event.clipboardData;
      if (!data) return;
      event.preventDefault();
      const files = [...(data.files ?? [])].filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
      if (files.length) handlers.current.onFiles?.(files);
      const text = data.getData("text/plain");
      if (text) document.execCommand("insertText", false, text);
    };

    const drop = (event) => {
      const data = event.dataTransfer;
      if (!data) return;
      event.preventDefault();
      event.stopPropagation();
      const files = [...(data.files ?? [])].filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
      if (files.length) return handlers.current.onFiles?.(files);
      const text = data.getData("text/plain");
      if (text) {
        field.focus();
        document.execCommand("insertText", false, text);
      }
    };

    let composing = false;
    const compositionStart = () => (composing = true);
    const compositionEnd = () => (composing = false);

    // Stickers and Genmoji (and any picture that got in some other way) are taken out of the words.
    const taking = new WeakSet();
    const take = async (element) => {
      if (taking.has(element)) return;
      taking.add(element);
      const picture = await glyphPicture(element).catch(() => null);
      (element.closest?.("picture") ?? element).remove();
      report();
      if (picture) handlers.current.onGlyph?.(picture);
    };
    const observer = new MutationObserver((records) => {
      for (const record of records)
        for (const added of record.addedNodes) {
          if (added.nodeType !== 1) continue;
          const found = added.matches?.("picture, img") ? [added] : [...added.querySelectorAll("picture, img")];
          for (const element of found) if (!(element.tagName === "IMG" && element.closest("picture"))) take(element);
          // Anything else with markup (a stray <div>, <b>…) is flattened to its words.
          if (!composing && !found.length && added.tagName !== "BR" && added.tagName !== "DIV" && added.parentNode === field && added.textContent) {
            added.replaceWith(document.createTextNode(added.textContent));
          }
        }
    });
    observer.observe(field, { childList: true, subtree: true });

    const keyDown = (event) => {
      if (event.key === "Escape") handlers.current.onEscape?.();
    };
    field.addEventListener("beforeinput", beforeInput);
    field.addEventListener("paste", paste);
    field.addEventListener("drop", drop);
    field.addEventListener("input", report);
    field.addEventListener("keydown", keyDown);
    field.addEventListener("compositionstart", compositionStart);
    field.addEventListener("compositionend", compositionEnd);
    return () => {
      field.removeEventListener("compositionstart", compositionStart);
      field.removeEventListener("compositionend", compositionEnd);
      observer.disconnect();
      field.removeEventListener("beforeinput", beforeInput);
      field.removeEventListener("paste", paste);
      field.removeEventListener("drop", drop);
      field.removeEventListener("input", report);
      field.removeEventListener("keydown", keyDown);
    };
  }, []);

  return (
    <div
      ref={node}
      className="composer__rich"
      contentEditable="true"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      data-placeholder={placeholder}
      data-empty={empty || undefined}
      enterKeyHint="send"
      inputMode="text"
      autoCapitalize="sentences"
      autoCorrect="on"
      spellCheck
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
});
