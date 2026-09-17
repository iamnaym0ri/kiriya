import BirthdayName from "../BirthdayName.jsx";
import "./WorldWelcome.css";

// `intro={false}` keeps just the greeting and name, for pages that write their own line below.
export default function WorldWelcome({ birthday = false, name = "kiriya", id = "home-title", intro = true }) {
  return <>
    <p className="handwritten world-welcome__greeting">{birthday ? "happy birthday," : "there you are, lovely."}</p>
    <h1 id={id} className="world-welcome__name"><BirthdayName>{name}</BirthdayName></h1>
    {intro && <p className="home-welcome__line world-welcome__line">A world just for you <em>full of soo much love and all ur faves <span className="welcome-emoticon" aria-label="sending you love">(˘ ³˘)♡</span></em></p>}
    {intro && <p className="home-welcome__description world-welcome__description">Your favourite characters, a song on repeat, a page to doodle on.<br className="desktop-break"/> Stay for a while. It’s all here for you. ♡</p>}
  </>;
}
