// Approximate SGD prices from the keyless Frankfurter v2 API. Verified live on 2026-09-15 from a home
// WSL machine: GET https://api.frankfurter.dev/v2/rates?base=SGD&quotes=JPY,USD returned
// [{"date":"2026-09-15","base":"SGD","quote":"JPY","rate":121.6},{"date":"2026-09-15","base":"SGD","quote":"USD","rate":0.78677}]
// (application/json, 127 bytes). Docs (https://frankfurter.dev/): no API key, "no quotas", abuse is
// rate-limited, mid-market rates blended from central banks, updated about daily.
//
// Requests go through the calling adapter's `ctx.http`, so the adapter must list FX_HOST in `hosts`.
// A missing, malformed or blocked rate never becomes a guess: callers keep `sgd` null.
import { FeedError } from "../config.js";

export const FX_HOST = "api.frankfurter.dev";
export const FX_URL = `https://${FX_HOST}/v2/rates?base=SGD&quotes=JPY,USD`;
export const FX_SOURCE = "Frankfurter v2 (api.frankfurter.dev), blended mid-market";
export const FX_CURRENCIES = ["JPY", "USD"];
const FX_MAX_BYTES = 16 * 1024;
// Errors that belong to the whole invocation rather than to the optional conversion.
const FATAL = new Set(["deadline", "lease_lost"]);

// One lookup per `sourceHttp` instance. The runner creates one instance per source per invocation, so
// this is "cached per invocation" without module-wide state leaking between builds.
const cache = new WeakMap();

/** Parses the verified v2 shape into SGD-per-unit rates. Returns null when nothing usable is present. */
export function parseSgdRates(body, source = FX_SOURCE) {
  if (!Array.isArray(body)) return null;
  const rates = { JPY: null, USD: null, asOf: null, source };
  const dates = [];
  for (const row of body) {
    if (!row || row.base !== "SGD" || !FX_CURRENCIES.includes(row.quote)) continue;
    const rate = Number(row.rate);
    if (!Number.isFinite(rate) || rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date))) continue;
    // Frankfurter quotes SGD→JPY; invert to "SGD per 1 JPY/USD", keeping six significant digits.
    rates[row.quote] = Number((1 / rate).toPrecision(6));
    dates.push(String(row.date));
  }
  if (!dates.length) return null;
  // The oldest contributing publication date is the honest "as of" for the pair set.
  rates.asOf = dates.sort()[0];
  return rates;
}

/**
 * {JPY, USD, asOf, source} in SGD per unit, or null when the API is unavailable. Cached per `http`.
 * Deadline/lease errors still propagate so the runner can checkpoint; other failures resolve to null.
 */
export function sgdRates(http) {
  if (!http || typeof http.json !== "function") throw new FeedError("fx_http_required");
  if (!cache.has(http)) {
    cache.set(
      http,
      http.json(FX_URL, { maxBytes: FX_MAX_BYTES }).then(
        (body) => parseSgdRates(body),
        (error) => {
          if (FATAL.has(error?.code)) throw error;
          return null;
        },
      ),
    );
  }
  return cache.get(http);
}

/** {sgd, fx} for a dated conversion, or null when the currency/rate is unknown. Never estimates. */
export function toSgd(amount, currency, rates) {
  const value = Number(amount);
  if (amount === null || amount === undefined || !Number.isFinite(value) || value < 0) return null;
  const code = String(currency ?? "").toUpperCase();
  if (code === "SGD") return { sgd: Math.round(value * 100) / 100, fx: null };
  if (!FX_CURRENCIES.includes(code) || !rates) return null;
  const rate = rates[code];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || !rates.asOf) return null;
  return {
    sgd: Math.round(value * rate * 100) / 100,
    fx: { rate, asOf: String(rates.asOf).slice(0, 40), source: String(rates.source ?? FX_SOURCE).slice(0, 80) },
  };
}
