// robots.txt, checked before every fetch (RFC 9309, plus the common Crawl-delay extension).
// What we read ends up in front of Claude, so a URL must be allowed for our own user agent AND for
// Anthropic's crawler tokens: a site that opts out of AI crawlers is not read by us either.

export const USER_AGENT = "kiriya-love-events/1.0 (+https://kiriya.love; private, one person; checks a few pages a day)";
export const AGENT_TOKENS = ["kiriya-love-events", "ClaudeBot", "anthropic-ai", "Claude-Web"];
const MAX_BYTES = 500 * 1024; // RFC 9309 asks crawlers to read at least 500 KiB

/** Parses robots.txt into groups: [{agents: [lowercase tokens], rules: [{allow, pattern}], crawlDelay}]. */
export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text ?? "").slice(0, MAX_BYTES).split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue; // rules before any user-agent line are ignored
    if (key === "allow" || key === "disallow") {
      // An empty Disallow allows everything; an empty Allow means nothing.
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = Math.min(n, 120);
    }
  }
  return { groups };
}

const tokenOf = (agent) => agent.toLowerCase().split("/")[0].trim();

/** The groups that apply to one product token: exact matches (merged), else "*". */
export function groupsFor(parsed, token) {
  const t = tokenOf(token);
  const exact = parsed.groups.filter((g) => g.agents.some((a) => a !== "*" && tokenOf(a) === t));
  if (exact.length) return exact;
  return parsed.groups.filter((g) => g.agents.includes("*"));
}

function patternRegex(pattern) {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

// Percent-encoding is compared in one normal form (upper-case hex; unreserved characters decoded).
const normPath = (p) =>
  p.replace(/%([0-9a-f]{2})/gi, (m, hex) => {
    const ch = String.fromCharCode(parseInt(hex, 16));
    return /[A-Za-z0-9\-._~]/.test(ch) ? ch : `%${hex.toUpperCase()}`;
  });

/** Whether `pathWithQuery` is allowed for one token. Longest matching rule wins; a tie allows. */
export function isAllowed(parsed, token, pathWithQuery) {
  const path = normPath(pathWithQuery || "/");
  if (path === "/robots.txt") return true;
  let best = null;
  for (const group of groupsFor(parsed, token)) {
    for (const rule of group.rules) {
      const pattern = normPath(rule.pattern);
      if (!patternRegex(pattern).test(path)) continue;
      const length = pattern.length;
      if (!best || length > best.length || (length === best.length && rule.allow && !best.allow)) best = { length, allow: rule.allow };
    }
  }
  return best ? best.allow : true;
}

export function crawlDelayFor(parsed, tokens = AGENT_TOKENS) {
  let delay = null;
  for (const token of tokens) for (const g of groupsFor(parsed, token)) if (g.crawlDelay != null) delay = Math.max(delay ?? 0, g.crawlDelay);
  return delay;
}

/**
 * The verdict for one URL from a cached robots record `{status, text}`:
 * - 2xx: the rules decide, for every token in AGENT_TOKENS;
 * - 404/410 (no robots.txt): allowed;
 * - 401/403, 5xx or unreachable: not allowed (we can't tell, so we stay away and retry another day).
 */
export function robotsVerdict(record, url, tokens = AGENT_TOKENS) {
  const u = new URL(url);
  const target = `${u.pathname || "/"}${u.search}`;
  if (!record) return { allowed: false, reason: "robots_unknown" };
  if (record.status === 404 || record.status === 410) return { allowed: true, reason: "no_robots", crawlDelay: null };
  if (record.status >= 200 && record.status < 300) {
    const parsed = parseRobots(record.text);
    const denied = tokens.find((t) => !isAllowed(parsed, t, target));
    return denied ? { allowed: false, reason: `robots_disallow:${denied}` } : { allowed: true, reason: "robots_allow", crawlDelay: crawlDelayFor(parsed, tokens) };
  }
  return { allowed: false, reason: `robots_${record.status ?? "unreachable"}` };
}
