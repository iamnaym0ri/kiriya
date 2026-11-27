// Stand-in for src/lib/api.js in Node: each device's requests go to the real Hono app through the
// handler the test registers in globalThis.__chatDevices[<device>].
const device = new URL(import.meta.url).searchParams.get("device");
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `Request failed (${status})`);
    this.status = status;
    this.code = body?.error ?? "unknown";
    this.body = body;
  }
}
export const API_ORIGIN = "";
export const isBundledApp = false;
export const apiUrl = (path) => `/api${path}`;
export const authHeaders = () => ({});
export const appToken = () => null;
export const setAppToken = () => {};
export async function api(path, { method = "GET", body } = {}) {
  const handler = globalThis.__chatDevices?.[device];
  if (!handler) throw new ApiError(0, { message: "no device" });
  const { status, data } = await handler(path, { method, body });
  if (status >= 400) throw new ApiError(status, data);
  return data;
}
