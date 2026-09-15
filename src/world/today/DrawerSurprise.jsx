import { AnimatePresence, motion } from "motion/react";
import { useOpenDrawer } from "../../lib/world.js";
import { celebrate } from "../../shared/effects.js";
import StickerArt from "../../shared/stickers/StickerArt.jsx";
import "./DrawerSurprise.css";

export default function DrawerSurprise({ drawer }) {
  const open = useOpenDrawer();
  const opened = drawer.opened;
  const reward = drawer.reward;

  function openDrawer(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    open.mutate(undefined, {
      onSuccess: () =>
        celebrate({ x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + 20) / window.innerHeight }, 0.7),
    });
  }

  return (
    <section className="drawer" aria-labelledby="drawer-title">
      <div className="drawer__chest" data-open={opened} aria-hidden="true">
        <div className="drawer__frame">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="drawer__small" />
          ))}
        </div>
        <motion.div className="drawer__box" animate={{ y: opened ? 22 : 0 }} transition={{ type: "spring", stiffness: 220, damping: 16 }}>
          <span className="drawer__label">今日</span>
          <span className="drawer__knob" />
        </motion.div>
      </div>

      <div className="drawer__copy">
        <h2 id="drawer-title" className="drawer__title">
          {opened ? "Today's drawer" : "A drawer with your name on it"}
        </h2>
        <AnimatePresence mode="wait">
          {opened && reward?.sticker ? (
            <motion.div
              key="reward"
              className="drawer__reward"
              initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
            >
              <StickerArt art={reward.sticker.art} size={64} />
              <div>
                <p className="drawer__reward-name">{reward.sticker.name}</p>
                <p className="drawer__reward-line">{reward.sticker.line}</p>
                <p className="drawer__reward-note">Added to your sticker collection.</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="drawer__line">One new thing every day. Nobody knows what's inside, not even Maomao.</p>
              <button type="button" className="btn btn--primary btn--small drawer__open" onClick={openDrawer} disabled={open.isPending}>
                {open.isPending ? "Opening…" : "Open today's drawer"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
