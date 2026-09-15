// Every call to the site's own API goes through here: JSON in, JSON out, cookies included, and the
// header the server requires on writes.

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `Request failed (${status})`);
    this.status = status;
    this.code = body?.error ?? "unknown";
    this.body = body;
  }
}

export async function api(path, { method = "GET", body, signal } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    signal,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(method !== "GET" ? { "Content-Type": "application/json", "x-kw": "1" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}
