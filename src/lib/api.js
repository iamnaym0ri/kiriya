// Every call to the site's own API goes through here: JSON in, JSON out, cookies included, and the
// header the server requires on writes.
//
// Inside the iPhone app the site is bundled into the app itself and runs on capacitor://localhost,
// where a kiriya.love cookie never travels. There the API lives at https://kiriya.love, and the
// session is a signed token the server hands back at sign-in, sent as a bearer header and kept in
// sessionStorage (it survives an in-app reload, and is gone when the app is closed: Face ID then
// opens it again). Private photo links arrive signed for this, see server/lib/mediaLinks.js.

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `Request failed (${status})`);
    this.status = status;
    this.code = body?.error ?? "unknown";
    this.body = body;
  }
}

// VITE_API_ORIGIN lets a test build of the bundle talk to a local server from another port.
export const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN || (typeof location !== "undefined" && location.protocol === "capacitor:" ? "https://kiriya.love" : "");
/** True inside the bundled iPhone app (and test builds of it): bearer tokens, absolute API links. */
export const isBundledApp = Boolean(API_ORIGIN);

const TOKEN = "kiriya:app-session";
let token = null;
if (isBundledApp) {
  try {
    token = sessionStorage.getItem(TOKEN);
  } catch {
    token = null;
  }
}

export const appToken = () => token;
export function setAppToken(value) {
  token = value || null;
  try {
    if (token) sessionStorage.setItem(TOKEN, token);
    else sessionStorage.removeItem(TOKEN);
  } catch {
    // Storage unavailable: the token still lives in memory until the app closes.
  }
}

/** The full address of an API path, for the few places that can't use `api()`. */
export const apiUrl = (path) => `${API_ORIGIN}/api${path}`;

/** Headers that sign a request in: the bearer token inside the app, nothing on the website. */
export const authHeaders = () => (isBundledApp && token ? { Authorization: `Bearer ${token}` } : {});

export async function api(path, { method = "GET", body, signal } = {}) {
  const session = path === "/session" || path.startsWith("/session/");
  const response = await fetch(apiUrl(path), {
    method,
    signal,
    credentials: isBundledApp ? "omit" : "same-origin",
    headers: {
      Accept: "application/json",
      ...authHeaders(),
      ...(isBundledApp && session ? { "x-kw-token": "1" } : {}),
      ...(method !== "GET" ? { "Content-Type": "application/json", "x-kw": "1" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  if (isBundledApp && session) {
    if (data?.token) setAppToken(data.token);
    else if (path === "/session/lock") setAppToken(null);
  }
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}
