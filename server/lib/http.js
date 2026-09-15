// Outbound requests from the daily job: always a timeout, always an honest User-Agent.

export const USER_AGENT = "Mozilla/5.0 (compatible; iloveukiriya-digest/1.0; personal, non-commercial)";

export async function fetchWithTimeout(url, { timeoutMs = 12_000, headers = {}, ...options } = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "User-Agent": USER_AGENT, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).host}`);
  return response;
}

export async function getJson(url, options) {
  return (await fetchWithTimeout(url, { ...options, headers: { Accept: "application/json", ...options?.headers } })).json();
}

export async function getText(url, options) {
  return (await fetchWithTimeout(url, options)).text();
}

/** Runs a source and never throws: a broken feed costs one card, not the whole day. */
export async function settle(label, task) {
  try {
    return { label, ok: true, value: await task() };
  } catch (error) {
    return { label, ok: false, error: error.message };
  }
}
