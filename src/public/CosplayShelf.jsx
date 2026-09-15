import CosplayEmblem from "../shared/icons/CosplayEmblem.jsx";
import "./CosplayShelf.css";

const TINTS = ["pink", "purple", "night"];

export default function CosplayShelf({ cosplays }) {
  if (!cosplays?.length) return null;
  return (
    <section className="cosplays" aria-labelledby="cosplays-title">
      <h2 id="cosplays-title" className="section-title">
        Cosplays
      </h2>
      <ul className="cosplays__row">
        {cosplays.map((cosplay, i) => (
          <li key={cosplay.character} className="polaroid" data-tint={TINTS[i % TINTS.length]} style={{ "--tilt": `${[-3, 2, -1.5, 3][i % 4]}deg` }}>
            <div className="polaroid__photo">
              {cosplay.photoUrl ? (
                <img src={cosplay.photoUrl} alt={`Kiriya as ${cosplay.character}`} loading="lazy" />
              ) : (
                <CosplayEmblem character={cosplay.character} />
              )}
            </div>
            <p className="polaroid__name">{cosplay.character}</p>
            <p className="polaroid__series">{cosplay.series}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
