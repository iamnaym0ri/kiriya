import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { countView, usePublicProfile } from "../lib/profile.js";
import { useSession } from "../lib/session.js";
import WorldWelcome from "../shared/profile/WorldWelcome.jsx";
import CosplayPortrait from "../shared/profile/CosplayPortrait.jsx";
import UnlockSheet from "../shared/UnlockSheet.jsx";
import { Credits, Icon, Star } from "../shared/WorldPrimitives.jsx";
import { MusicObject } from "../shared/music/MusicRoom.jsx";
import { BirthdayRibbon, Bow, MaomaoBuddy, MotionToggle, usePlayful } from "../shared/play/PlayfulWorld.jsx";
import { PinBoard, TodayCard } from "./PublicStatus.jsx";
import "./ProfilePage.css";

export default function ProfilePage() {
  const { day } = usePlayful();
  const session = useSession();
  const role = session.data?.role ?? null;
  const [params] = useSearchParams();
  // Unlocked, the site is hers: kiriya.love opens her world. `?view=public` shows her (or the
  // admin's test copy) exactly what visitors see, fresh instead of from the public cache.
  const previewing = Boolean(role) && params.get("view") === "public";
  const publicProfile = usePublicProfile();
  const preview = useQuery({ queryKey: ["me", "public-preview"], queryFn: () => api("/me/public-preview"), enabled: previewing });
  const profile = previewing ? preview : publicProfile;
  const navigate = useNavigate();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [credits, setCredits] = useState(false);
  const [views, setViews] = useState(null);
  const [copied, setCopied] = useState(false);
  const data = profile.data;
  const birthday = day?.endsWith("-09-15") ?? false;
  useEffect(() => {
    if (session.isPending || role) return;
    countView().then(count => { if (count !== null) setViews(count); });
  }, [session.isPending, role]);
  useEffect(() => {
    document.title = birthday ? "happy birthday, kiriya ♡" : "kiriya’s little world ♡";
  }, [birthday]);
  if (role && !previewing) return <Navigate to="/world" replace />;
  const enter = () => role ? navigate("/world") : setUnlockOpen(true);

  return <div className="lilac-scene public-scene">
    {previewing && <p className="public-preview-banner" role="status">
      <span>{role === "admin" ? "Test view: your public profile, built from your admin test choices." : "This is your public profile, exactly as your friends see it ♡"}</span>
      <Link to="/world/settings#sharing">Choose what’s shared <Icon name="arrow" size={14}/></Link>
      <Link to="/world">Back to your world <Icon name="arrow" size={14}/></Link>
    </p>}
    <header className="public-mast">
      <a href="/" className="tiny-wordmark" aria-label="Kiriya’s home">kiriya<span aria-hidden="true">✦</span></a>
      <span className="public-mast__note">a little corner of the internet</span>
      <div className="public-mast__actions">
        <MotionToggle/>
        <button className="quiet-button" onClick={enter}><Icon name="lock" size={15}/><span>Private world</span></button>
      </div>
    </header>
    <BirthdayRibbon/>
    <main className="profile-home" id="main">
      <div className="profile-dateline"><span>YOUR LITTLE LILAC WORLD</span><span>made of little loves <span aria-hidden="true">✧</span></span></div>
      <section className="profile-opening" aria-labelledby="identity-title" data-motion-region>
        <div className="profile-welcome">
          <WorldWelcome birthday={birthday} name={data?.name} id="identity-title"/>
          <TodayCard today={data?.today} name={data?.name}/>
          <aside className="profile-dedication">
            <span className="micro-label">A LITTLE SPACE, JUST FOR U ♡</span>
            <p>i made this just for u<br/>with all ur fave lil things &lt;3</p>
            <span className="profile-dedication__heart" aria-hidden="true">♡</span>
          </aside>
          <div className="profile-stamps" aria-label="A few favourite things">
            <span>✿ LITTLE ARTIST</span><span>♡ VERY LOVED</span><span>🎀 COSPLAY DAYDREAMS</span>
          </div>
          <div className="profile-door">
            <button className="button-plum" onClick={enter}><Icon name="lock" size={16}/>{role ? "Back to your world" : "The rest is just for Kiriya"}<Icon name="arrow" size={18}/></button>
            <span>doodles, little games & a jar full of love</span>
          </div>
          {data?.bioLines?.length > 0 && <details className="profile-about"><summary>a little more about kiriya <span aria-hidden="true">↗</span></summary>{data.bioLines.map((line, i) => <p key={i}>{line}</p>)}</details>}
          <div className="profile-socials">
            {data?.socials?.tiktok?.handle && <a className="quiet-button" href={data.socials.tiktok.url || `https://www.tiktok.com/@${data.socials.tiktok.handle}`} target="_blank" rel="noreferrer">TikTok <Icon name="diagonal" size={14}/></a>}
            {data?.socials?.discord?.username && <button className="quiet-button" onClick={async () => { try { await navigator.clipboard.writeText(data.socials.discord.username); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied!" : data.socials.discord.username} <span className="micro-label">DISCORD</span></button>}
          </div>
          {profile.isError && <button className="quiet-button profile-retry" onClick={() => profile.refetch()}>Profile couldn’t load · try again</button>}
        </div>
        <div className="profile-collage">
          <Bow className="profile-collage__bow"/>
          <CosplayPortrait avatarUrl={data?.avatarUrl}/>
          <Star className="profile-collage__star"/>
          <div className="profile-music"><MusicObject song={data?.song} compact/></div>
          <MaomaoBuddy compact birthday={birthday}/>
          <p className="profile-side-note">a favourite character.<br/>a very favourite person. ♡</p>
        </div>
      </section>
    </main>
    <PinBoard pins={data?.pins} name={data?.name}/>
    <footer className="public-footer">
      <span>made with love for kiriya <span aria-hidden="true">♡</span></span>
      <button onClick={() => setCredits(true)}>Art & credits <Icon name="diagonal" size={12}/></button>
      <span className="public-footer__date">{data?.showViews ? `${(views ?? data.views ?? 0).toLocaleString()} visits to this little world` : "a world of your own"}</span>
    </footer>
    <UnlockSheet open={unlockOpen} onClose={() => setUnlockOpen(false)} onUnlocked={() => { setUnlockOpen(false); navigate("/world"); }}/>
    {credits && <Credits onClose={() => setCredits(false)}/>}
  </div>;
}
