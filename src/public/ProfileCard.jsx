import { useEffect, useState } from "react";
import Tilt from "react-parallax-tilt";
import Typewriter from "typewriter-effect";
import { useReducedMotion } from "motion/react";
import { siDiscord, siTiktok } from "simple-icons";
import Doily from "../shared/Doily.jsx";
import Wordmark from "../shared/Wordmark.jsx";
import InterestIcon, { INTEREST_LABELS } from "../shared/icons/InterestIcon.jsx";
import "./ProfileCard.css";

const numberFormat = new Intl.NumberFormat("en");

function BrandIcon({ icon }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="brand-icon">
      <path d={icon.path} />
    </svg>
  );
}

export default function ProfileCard({ profile, entered, gyroscope }) {
  const reduce = useReducedMotion();
  const [activeBadge, setActiveBadge] = useState(null);
  const [copied, setCopied] = useState(false);
  const [hoverCapable, setHoverCapable] = useState(false);

  useEffect(() => {
    setHoverCapable(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  const badges = profile.birthday?.isBirthdayWeek ? ["birthday", ...profile.badges] : profile.badges;
  const tiktok = profile.socials?.tiktok;
  const tiktokUrl = tiktok?.url || (tiktok?.handle ? `https://www.tiktok.com/@${tiktok.handle.replace(/^@/, "")}` : null);
  const discord = profile.socials?.discord?.username;

  async function copyDiscord() {
    try {
      await navigator.clipboard.writeText(discord);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const tiltEnabled = !reduce && (hoverCapable || gyroscope);

  return (
    <Tilt
      className="pcard-tilt"
      tiltEnable={tiltEnabled}
      tiltMaxAngleX={5}
      tiltMaxAngleY={7}
      perspective={1400}
      transitionSpeed={900}
      glareEnable={tiltEnabled}
      glareMaxOpacity={0.14}
      glareColor="#ffffff"
      glarePosition="all"
      glareBorderRadius="34px"
      gyroscope={Boolean(gyroscope) && !reduce}
    >
      <section className="pcard" aria-label={`${profile.name}'s profile`}>
        <span className="pcard__lace" aria-hidden="true" />
        <div className="pcard__avatar">
          <Doily size={132}>
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={`${profile.name}'s profile picture`} />
            ) : (
              <span className="pcard__initial" aria-hidden="true">
                k
              </span>
            )}
          </Doily>
        </div>

        <Wordmark text={profile.name} play={entered} />

        <ul className="pcard__badges" aria-label="Badges">
          {badges.map((badge) => (
            <li key={badge}>
              <button
                type="button"
                className="pcard__badge"
                data-badge={badge}
                data-active={activeBadge === badge}
                onClick={() => setActiveBadge((current) => (current === badge ? null : badge))}
                aria-label={INTEREST_LABELS[badge] ?? badge}
                aria-describedby={activeBadge === badge ? "pcard-badge-label" : undefined}
              >
                <InterestIcon name={badge} size={20} />
              </button>
            </li>
          ))}
        </ul>
        <p className="pcard__badge-label" id="pcard-badge-label" aria-live="polite">
          {activeBadge ? INTEREST_LABELS[activeBadge] : " "}
        </p>

        <div className="pcard__bio">
          {entered && !reduce ? (
            <Typewriter
              options={{
                strings: profile.bioLines,
                autoStart: true,
                loop: true,
                delay: 42,
                deleteSpeed: 18,
                pauseFor: 2200,
                cursor: "▍",
                wrapperClassName: "pcard__bio-text",
                cursorClassName: "pcard__bio-cursor",
              }}
            />
          ) : (
            <span className="pcard__bio-text">{profile.bioLines[0]}</span>
          )}
          <span className="sr-only">{profile.bioLines.join(". ")}</span>
        </div>

        {(tiktokUrl || discord) && (
          <div className="pcard__socials">
            {tiktokUrl && (
              <a className="pcard__social" href={tiktokUrl} target="_blank" rel="noreferrer">
                <BrandIcon icon={siTiktok} />
                <span>{tiktok.handle ? `@${tiktok.handle.replace(/^@/, "")}` : "TikTok"}</span>
              </a>
            )}
            {discord && (
              <button type="button" className="pcard__social" onClick={copyDiscord}>
                <BrandIcon icon={siDiscord} />
                <span>{copied ? "Copied!" : discord}</span>
              </button>
            )}
          </div>
        )}

        {profile.views !== null && profile.views !== undefined && (
          <p className="pcard__views">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {numberFormat.format(profile.views)} {profile.views === 1 ? "view" : "views"}
          </p>
        )}
      </section>
    </Tilt>
  );
}
