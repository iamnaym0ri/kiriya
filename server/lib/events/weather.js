// Weather and trains for event days (PLAN.md §6):
// - Open-Meteo daily forecast, 5–16 days out (free, non-commercial, CC BY 4.0);
// - NEA four-day outlook within 4 days, NEA 2-hour forecast on the day (data.gov.sg, Singapore Open
//   Data Licence; an optional DATA_GOV_SG_API_KEY raises the rate limit);
// - LTA DataMall train service alerts on event days (LTA_DATAMALL_KEY).
// These are APIs offered for programmatic use, not crawl targets, so they don't go through the
// robots.txt gate (api.open-meteo.com's robots.txt disallows crawling its API host as a whole).
import { sourceHttp } from "../../feeds/http.js";
import { addDays, daysBetween } from "../time.js";
import { USER_AGENT } from "./robots.js";

export const CREDITS = {
  "open-meteo": "Weather data by Open-Meteo.com (CC BY 4.0)",
  nea: "Source: National Environment Agency, data.gov.sg (Singapore Open Data Licence)",
  lta: "LTA DataMall",
};
const SG_CENTRE = { lat: 1.2937, lng: 103.8572 };

export function apiClient({ send, deadline = Date.now() + 60_000, signal } = {}) {
  const http = sourceHttp(
    { id: "events-apis", hosts: ["api.open-meteo.com", "api-open.data.gov.sg", "datamall2.mytransport.sg"], mediaHosts: [], maxRequests: 40, maxBytes: 2 * 1024 * 1024, paceMs: 300, timeoutMs: 15_000 },
    { deadline, signal, send },
  );
  return {
    json: (url, headers = {}) => http.json(url, { headers: { "user-agent": USER_AGENT, ...headers } }),
  };
}

// WMO weather codes (Open-Meteo) → our icon and a short summary.
export function wmo(code) {
  if (code === 0) return { icon: "sunny", summary: "Clear" };
  if (code <= 2) return { icon: "fair", summary: "Partly cloudy" };
  if (code === 3) return { icon: "cloudy", summary: "Overcast" };
  if (code === 45 || code === 48) return { icon: "hazy", summary: "Fog" };
  if (code >= 51 && code <= 57) return { icon: "rain", summary: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: "rain", summary: code >= 80 ? "Rain showers" : "Rain" };
  if (code >= 95) return { icon: "thundery", summary: "Thunderstorms" };
  return { icon: "cloudy", summary: "Cloudy" };
}

// NEA forecast words → our icon.
export function neaIcon(text) {
  const t = String(text ?? "").toLowerCase();
  if (/thunder/.test(t)) return "thundery";
  if (/shower|rain|drizzle/.test(t)) return "rain";
  if (/haz|mist|fog/.test(t)) return "hazy";
  if (/wind/.test(t)) return "windy";
  if (/fair|sunny/.test(t)) return /night/.test(t) ? "fair" : "sunny";
  if (/partly/.test(t)) return "fair";
  return "cloudy";
}

/** Normalises the three weather feeds into lookups by date (and by area for the 2-hour forecast). */
export function readOpenMeteo(json) {
  const d = json?.daily ?? {};
  return (d.time ?? []).map((date, i) => {
    const w = wmo(d.weather_code?.[i]);
    return { date, summary: w.summary, icon: w.icon, tempLow: round(d.temperature_2m_min?.[i]), tempHigh: round(d.temperature_2m_max?.[i]), rainChance: d.precipitation_probability_max?.[i] ?? null };
  });
}
export function readFourDay(json) {
  const record = json?.data?.records?.[0];
  return (record?.forecasts ?? []).map((f) => ({
    date: String(f.timestamp ?? "").slice(0, 10),
    summary: f.forecast?.summary ?? f.forecast?.text ?? "",
    icon: neaIcon(`${f.forecast?.text ?? ""} ${f.forecast?.summary ?? ""}`),
    tempLow: f.temperature?.low ?? null,
    tempHigh: f.temperature?.high ?? null,
    rainChance: null,
  }));
}
export function readTwoHour(json) {
  const data = json?.data ?? {};
  const item = data.items?.[0];
  const areas = (data.area_metadata ?? []).map((a) => ({ name: a.name, lat: a.label_location?.latitude, lng: a.label_location?.longitude }));
  const forecasts = new Map((item?.forecasts ?? []).map((f) => [f.area, f.forecast]));
  return { areas, forecasts, validUntil: item?.valid_period?.end ?? null };
}
const round = (n) => (n == null ? null : Math.round(n));

export function nearestArea(areas, point) {
  let best = null;
  for (const a of areas) {
    if (a.lat == null) continue;
    const d = (a.lat - point.lat) ** 2 + (a.lng - point.lng) ** 2;
    if (!best || d < best.d) best = { ...a, d };
  }
  return best?.name ?? null;
}

/** The event days from today on (at most the next three), from the dossier or the date range. */
export function eventDays(row, today) {
  const listed = (row.dossier?.days ?? []).map((d) => d.date);
  const days = [];
  if (listed.length) days.push(...listed);
  else if (row.startsOn) {
    const end = row.endsOn ?? row.startsOn;
    for (let d = row.startsOn > today ? row.startsOn : today; d <= end && days.length < 3; d = addDays(d, 1)) days.push(d);
  }
  return [...new Set(days)].filter((d) => d >= today).sort().slice(0, 3);
}

function tip(days, now) {
  const icons = [...days.map((d) => d.icon), now?.icon].filter(Boolean);
  if (icons.includes("thundery")) return "thundery showers likely: bring an umbrella for the walk from the MRT.";
  if (icons.includes("rain")) return "might rain: an umbrella in the bag, just in case.";
  if (days.some((d) => (d.tempHigh ?? 0) >= 33)) return "hot one: water bottle and a fan, especially in cosplay.";
  return null;
}

/**
 * The weather snapshot for one event, or null when it's more than 16 days away (or undated).
 * `feeds`: {openMeteo: (lat,lng) => days[], fourDay: days[], twoHour: {areas, forecasts, validUntil}}.
 */
export async function weatherFor(row, today, feeds, { fetchedAt = new Date().toISOString() } = {}) {
  if (!row.startsOn || row.status === "cancelled") return null;
  const days = eventDays(row, today);
  if (!days.length) return null;
  const out = daysBetween(today, days[0]);
  if (out > 16) return null;
  const venue = row.dossier?.venue;
  const point = venue?.lat != null && venue?.lng != null ? { lat: venue.lat, lng: venue.lng } : SG_CENTRE;
  let source;
  let list = [];
  let now = null;
  if (days[0] === today) {
    source = "nea-2h";
    const two = feeds.twoHour;
    const area = two ? nearestArea(two.areas, point) : null;
    if (area && two.forecasts.get(area)) now = { area, forecast: two.forecasts.get(area), icon: neaIcon(two.forecasts.get(area)), validUntil: two.validUntil };
    list = (feeds.fourDay ?? []).filter((d) => days.includes(d.date));
    const om = feeds.openMeteo ? (await feeds.openMeteo(point.lat, point.lng)) ?? [] : [];
    const todays = om.find((d) => d.date === today);
    if (todays) list = [todays, ...list.filter((d) => d.date !== today)];
  } else if (out <= 4) {
    source = "nea-4day";
    list = (feeds.fourDay ?? []).filter((d) => days.includes(d.date));
  } else {
    source = "open-meteo";
    const om = feeds.openMeteo ? (await feeds.openMeteo(point.lat, point.lng)) ?? [] : [];
    list = om.filter((d) => days.includes(d.date));
  }
  if (!list.length && !now) return null;
  const labels = { "open-meteo": "Open-Meteo 16-day forecast", "nea-4day": "NEA four-day outlook", "nea-2h": "NEA 2-hour forecast" };
  const usesOpenMeteo = source === "open-meteo" || list.some((d) => d.rainChance != null);
  return {
    source,
    label: labels[source],
    fetchedAt,
    days: list,
    now,
    note: tip(list, now) ?? (source === "open-meteo" ? "an early look; it firms up four days out." : null),
    credit: source === "open-meteo" ? CREDITS["open-meteo"] : usesOpenMeteo ? `${CREDITS.nea}; ${CREDITS["open-meteo"]}` : CREDITS.nea,
  };
}

/** Loads the feeds the given events need (each at most once), through `api`. */
export async function loadWeatherFeeds(api, rows, today, { dataGovKey = process.env.DATA_GOV_SG_API_KEY } = {}) {
  const need = { openMeteo: false, fourDay: false, twoHour: false };
  for (const row of rows) {
    const days = row.startsOn ? eventDays(row, today) : [];
    if (!days.length) continue;
    const out = daysBetween(today, days[0]);
    if (out > 16) continue;
    if (days[0] === today) need.twoHour = need.fourDay = need.openMeteo = true;
    else if (out <= 4) need.fourDay = true;
    else need.openMeteo = true;
  }
  const headers = dataGovKey ? { "x-api-key": dataGovKey } : {};
  const cache = new Map();
  const feeds = {};
  if (need.fourDay) feeds.fourDay = readFourDay(await api.json("https://api-open.data.gov.sg/v2/real-time/api/four-day-outlook", headers).catch(() => null));
  if (need.twoHour) {
    const json = await api.json("https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast", headers).catch(() => null);
    feeds.twoHour = json ? readTwoHour(json) : null;
  }
  if (need.openMeteo)
    feeds.openMeteo = async (lat, lng) => {
      const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      if (!cache.has(key))
        cache.set(
          key,
          api
            .json(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSingapore&forecast_days=16`)
            .then(readOpenMeteo)
            .catch(() => null),
        );
      return cache.get(key);
    };
  return { feeds, need };
}

// ---------------------------------------------------------------------------------------------
// Trains (LTA DataMall TrainServiceAlerts): Status 1 normal, 2 disrupted.
// ---------------------------------------------------------------------------------------------

export function readTrainAlerts(json, fetchedAt = new Date().toISOString()) {
  const v = json?.value ?? {};
  const disrupted = Number(v.Status) === 2;
  const messages = [v.Message].flat().filter(Boolean);
  const alerts = [v.AffectedSegments]
    .flat()
    .filter(Boolean)
    .map((s) => ({
      line: s.Line ?? null,
      direction: s.Direction ?? null,
      stations: String(s.Stations ?? "").split(",").map((x) => x.trim()).filter(Boolean),
      freeBus: s.FreePublicBus ?? null,
      shuttle: s.FreeMRTShuttle ?? null,
      message: messages.map((m) => m.Content).filter(Boolean).join(" ") || null,
      at: messages[0]?.CreatedDate ?? null,
    }));
  if (disrupted && !alerts.length && messages.length) alerts.push({ line: null, direction: null, stations: [], freeBus: null, shuttle: null, message: messages.map((m) => m.Content).join(" "), at: messages[0]?.CreatedDate ?? null });
  return { status: disrupted ? "disrupted" : "normal", alerts, fetchedAt, credit: CREDITS.lta };
}

export async function loadTrainAlerts(api, { key = process.env.LTA_DATAMALL_KEY } = {}) {
  if (!key) return null;
  const json = await api.json("https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts", { AccountKey: key, accept: "application/json" });
  return readTrainAlerts(json);
}
