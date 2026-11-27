// The photo and video viewer (round 3): PhotoSwipe (MIT, photoswipe.com) with its video plugin
// (ISC). A tapped photo grows out of its tile to the full width of the screen at its own height;
// pinch or double-tap to zoom, swipe sideways through the message's photos and videos, swipe down
// (or tap the ✕) to close. Videos play with sound and native controls. Loaded only when first used.
import "photoswipe/style.css";

let safe = null;
/** The phone's safe-area insets, measured once (the viewer keeps photos clear of the notch). */
function safeArea() {
  if (safe) return safe;
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)";
  document.body.append(probe);
  const style = getComputedStyle(probe);
  safe = { top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0 };
  probe.remove();
  return safe;
}

const CLOSE_SVG = '<svg aria-hidden="true" class="pswp__icn" viewBox="0 0 24 24" width="24" height="24"><path d="m6 6 12 12M6 18 18 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/**
 * Opens the viewer.
 * @param slides [{ type: "image"|"video", src, poster?, width, height, alt?, element? }]
 * @param index which slide to start on
 */
export async function openViewer(slides, index = 0) {
  const [{ default: PhotoSwipeLightbox }, { default: PhotoSwipeVideoPlugin }] = await Promise.all([import("photoswipe/lightbox"), import("photoswipe-video-plugin")]);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const dataSource = slides.map((slide) => ({
    ...(slide.type === "video" ? { type: "video", videoSrc: slide.src, msrc: slide.poster ?? "" } : { src: slide.src, msrc: slide.thumb ?? slide.src }),
    width: slide.width || 1080,
    height: slide.height || 1080,
    alt: slide.alt ?? "",
    element: slide.element ?? undefined,
    thumbCropped: true,
  }));
  const lightbox = new PhotoSwipeLightbox({
    dataSource,
    pswpModule: () => import("photoswipe"),
    showHideAnimationType: reduced ? "none" : "zoom",
    bgOpacity: 1,
    spacing: 0.08,
    loop: false,
    // Photos open as wide as the screen at their own height; a double tap fills it.
    initialZoomLevel: "fit",
    secondaryZoomLevel: 2.5,
    maxZoomLevel: 5,
    paddingFn: () => ({ top: safeArea().top, bottom: safeArea().bottom, left: 0, right: 0 }),
    arrowPrev: !coarse,
    arrowNext: !coarse,
    zoom: !coarse,
    counter: slides.length > 1,
    closeTitle: "Close",
    closeSVG: CLOSE_SVG,
    errorMsg: "this one couldn’t open just now",
    mainClass: "chat-viewer",
  });
  new PhotoSwipeVideoPlugin(lightbox, { videoAttributes: { controls: "", playsinline: "", preload: "auto" }, autoplay: false });
  // A video that can't start by itself (no gesture left) simply waits for its play button.
  lightbox.on("contentActivate", ({ content }) => {
    const video = content?.element;
    if (video?.tagName === "VIDEO") video.play?.()?.catch?.(() => {});
  });
  lightbox.on("destroy", () => setTimeout(() => lightbox.destroy(), 0));
  lightbox.init();
  lightbox.loadAndOpen(index);
  return lightbox;
}
