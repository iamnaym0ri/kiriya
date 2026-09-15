import { Icon } from "./WorldPrimitives.jsx";

export default function BirthdayName({ children = "kiriya" }) {
  return <span className="birthday-name">
    <span className="birthday-name__ink">{children}</span>
    <span className="name-charms" aria-hidden="true">
      <Icon name="heart" className="name-charm name-charm--heart" size={30} />
      <Icon name="heart" className="name-charm name-charm--tiny" size={15} />
      <span className="name-charm name-charm--star">✧</span>
      <span className="name-charm name-charm--petal">✿</span>
    </span>
  </span>;
}
