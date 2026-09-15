import { useQuery } from "@tanstack/react-query";
import InterestIcon from "../../shared/icons/InterestIcon.jsx";
import "./OutfitCard.css";

// Open-Meteo: free, no key, CORS-friendly. Their licence asks for a visible credit link.
async function fetchWeather({ latitude, longitude }) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    "&current=temperature_2m,apparent_temperature,weather_code" +
    "&daily=temperature_2m_max,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=1";
  const response = await fetch(url);
  if (!response.ok) throw new Error("weather unavailable");
  const data = await response.json();
  return {
    now: Math.round(data.current.temperature_2m),
    feels: Math.round(data.current.apparent_temperature),
    max: Math.round(data.daily.temperature_2m_max[0]),
    rainChance: data.daily.precipitation_probability_max[0],
    uv: data.daily.uv_index_max[0],
    code: data.current.weather_code,
  };
}

function sky(code) {
  if (code === 0) return "clear";
  if (code <= 3) return "cloudy";
  if (code >= 95) return "stormy";
  if (code >= 51) return "rainy";
  return "hazy";
}

export default function OutfitCard({ outfits, moodKey, city, weatherNotes }) {
  const weather = useQuery({ queryKey: ["weather", city.name], queryFn: () => fetchWeather(city), staleTime: 30 * 60_000, retry: 1 });
  const outfit = outfits[moodKey ?? "iris"];
  const w = weather.data;

  const notes = [];
  if (w) {
    if (w.rainChance >= 50) notes.push(weatherNotes.rain);
    if (w.feels >= 27) notes.push(weatherNotes.hot);
    notes.push(weatherNotes.aircon);
  }

  return (
    <section className="outfit" aria-labelledby="outfit-title">
      <header className="outfit__head">
        <div>
          <h2 id="outfit-title" className="outfit__title">
            Outfit idea
          </h2>
          <p className="outfit__vibe">{outfit.vibeName}</p>
        </div>
        {w ? (
          <div className="outfit__weather" aria-label={`${city.name}: ${w.now} degrees, feels like ${w.feels}, ${w.rainChance}% chance of rain`}>
            <span className="outfit__temp">{w.now}°</span>
            <span className="outfit__sky">
              {sky(w.code)}, {w.rainChance}% rain
            </span>
          </div>
        ) : (
          <div className="outfit__weather outfit__weather--empty">{weather.isError ? "No weather right now" : "Checking the sky…"}</div>
        )}
      </header>

      <ul className="outfit__pieces">
        <li>
          <span className="outfit__slot">Top</span>
          {outfit.top}
        </li>
        <li>
          <span className="outfit__slot">Bottom</span>
          {outfit.bottom}
        </li>
        <li>
          <span className="outfit__slot">Shoes</span>
          {outfit.shoes}
        </li>
        <li>
          <span className="outfit__slot">Extra</span>
          {outfit.accessory}
        </li>
      </ul>

      {notes.length > 0 && (
        <ul className="outfit__notes">
          {notes.map((note) => (
            <li key={note}>
              <InterestIcon name="fashion" size={16} />
              {note}
            </li>
          ))}
        </ul>
      )}
      <p className="outfit__credit">
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Weather data by Open-Meteo.com
        </a>
      </p>
    </section>
  );
}
