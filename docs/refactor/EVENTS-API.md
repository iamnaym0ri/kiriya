# Events & merch API (phase 6)

The contract between the events engine (`reno/events`: `worker/**`, `server/lib/events/**`,
`server/routes/events.js`) and the events screens (`reno/events-ui`: `src/world/events/**`). Shapes
here are stable; a change is announced to the coordinator first.

- The API (Vercel, Hono) only **reads** what the Railway worker stored, plus her saves and "seen"
  marks and Josh's pasted links. It never calls Claude, Apify, NEA, LTA or any event site.
- **Local dev:** with no `DATABASE_URL`, the first events request seeds 12 sample events into your
  own PGlite (`server/lib/events/fixtures.js`, `origin: "fixture"`, every card has `fixture: true`).
  Dates are real 2026 events; guests, prices, merch and tips are made up. `EVENTS_FIXTURES=0` turns
  the samples off. Samples never exist in production.
- Singapore only (`tier: "sg"`). Hidden events are invisible except to admin tools.

## Conventions

- **Auth:** `/api/events/*` needs a session (`kiriya` or `admin`), except `calendar.ics` and the
  dev-only `fixture-art`. Admin routes are `/api/admin/events/*`. POSTs need `x-kw: 1` and a JSON body.
- **Josh sees what she sees.** Reads return her saves and her "last looked" marks. His save and seen
  calls answer `{ ..., preview: true }` and change nothing (like the feed's keep button).
- **Ids** are opaque strings (`afa-singapore:2026`, `ev-konbini-2027`, `fx-…` in dev). Always
  `encodeURIComponent` them in paths and query strings. Merch ids are `"<eventId>~<itemId>"`.
- **Dates are Singapore dates** (`YYYY-MM-DD`). Times are `HH:MM` 24-hour SGT; `startsAt`/`endsAt`
  are ISO with `+08:00` and are `null` when the time isn't known. Instants (`updatedAt`, `at`) are
  ISO UTC.
- **Every claim carries its sources:** any object with `sourceIds: ["s1", …]` also has
  `sourceId` (the first, or `null`). Ids point into the event's `sources` list.
- **Errors:** `{ error, message }` with a status; `message` is friendly and may be shown.
- Responses are `Cache-Control: private, no-store` (calendar: `private, max-age=300`).

### Enums

| Field | Values |
| --- | --- |
| `kind` | `con` (convention), `fair` (fair & market), `popup`, `merch` (a merch drop), `concert`, `cafe` (collab café), `other` |
| `status` | `upcoming`, `on_now`, `past`, `cancelled` |
| `phase` / timeline `stage` | `announced`, `guests`, `tickets`, `merch`, `schedule`, `day`, `after` |
| timeline `state` | `done`, `now`, `next`, `unknown` |
| `tickets.status` | `on_sale`, `soon`, `sold_out`, `free`, `tbc`, `closed` |
| `merch.status` (card) | `none`, `revealed`, `exclusives` |
| merch item `kind` / `status` | `exclusive`, `merch`, `collab`, `limited`, `freebie` / `revealed`, `preorder`, `on_sale`, `sold_out` |
| source `kind` | `official`, `venue`, `ticketing`, `news`, `listing`, `social`, `newsletter`, `owner` |
| link `kind` | `official`, `tickets`, `instagram`, `map`, `venue`, `news`, `other` |
| update `kind` | `new`, `dates`, `venue`, `guests`, `tickets`, `merch`, `schedule`, `cancelled`, `weather`, `transit`, `note`, `after` |
| `size.scale` | `small`, `medium`, `large`, `huge` |
| weather `icon` | `sunny`, `fair`, `cloudy`, `rain`, `thundery`, `windy`, `hazy` |
| fandom ids | `miku`, `vocaloid`, `sekai`, `apothecary`, `plave`, `rotten-girl`, `cosplay`, `j-fashion`, `vtuber`, `genshin`, `frieren`, `witch-hat`, `bungo`, `oshi-no-ko`, `bocchi`, `girls-band-cry`, `sanrio`, `pokemon`, `anime` (others appear slugged); labels come with each card |

## Her side: `/api/events`

### `GET /api/events` — the list (events and merch drops)

Query: `when=upcoming|past|all` (default `upcoming`, which includes `on_now`), `kind=con,popup`,
`fandom=miku,apothecary`, `saved=1`, `limit` (1–200, default 100). Upcoming is soonest first with
dates-tbc last; past is most recent first.

```json
{
  "events": [EventCard],
  "filters": {
    "kinds":   [{ "id": "con", "label": "convention", "count": 4 }],
    "fandoms": [{ "id": "anime", "label": "anime", "count": 8 }]
  },
  "me": Me,
  "today": "2026-11-27",
  "updatedAt": "2026-11-25T09:30:00.000Z"
}
```

`filters` counts the `when` set before the kind/fandom/saved filters, so chips keep their counts.

**EventCard**

```json
{
  "id": "fx-afa-singapore-2026",
  "kind": "con", "kindLabel": "convention",
  "name": "AFA Singapore 2026",
  "tagline": "the big one: three days of anime, cosplay and concerts at suntec",
  "startsOn": "2026-11-27", "endsOn": "2026-11-29",
  "startsAt": "2026-11-27T10:00:00+08:00", "endsAt": "2026-11-29T20:00:00+08:00",
  "datesTbc": false,
  "dateLabel": "27–29 nov",              // "dates tbc" when unknown; year shown only if not this year
  "timeLabel": "10am – 9pm",             // first day's hours, or null
  "venueName": "Suntec Singapore Convention & Exhibition Centre", "venueArea": "City Hall",
  "city": "Singapore",
  "hers": true,                          // tied to her fandoms (cons always are)
  "big": true,                           // a con/pop-up/merch tied to her fandoms: news is pushed at once
  "fandoms": ["anime", "cosplay", "miku", "sekai"],
  "fandomLabels": ["anime", "cosplay", "hatsune miku", "project sekai"],
  "tags": ["cosplay competition", "concerts", "artist alley"],
  "tickets": { "status": "on_sale", "from": 18, "label": "from S$18" },
  "merch": { "status": "exclusives", "count": 3, "exclusives": 2, "label": "2 exclusives" },
  "status": "on_now",
  "phase": "day",                        // the timeline stage it's at
  "countdown": { "days": 0, "label": "on now · day 1 of 3" },   // "tomorrow", "in 5 days", "in 3 weeks", "ended", "dates tbc"
  "image": { "url": "…", "alt": "…", "credit": "…" },          // or null; our own Blob copy, never an Instagram link
  "url": "https://animefestival.asia/afasg26/",                 // official page
  "updatedAt": "2026-11-18T03:00:00.000Z",
  "lastUpdate": { "at": "…", "title": "schedule out", "kind": "schedule" },   // or null
  "unseenUpdates": 2,                    // log entries newer than lastLookedAt (or the section mark)
  "saved": false,
  "lastLookedAt": null,                  // when she last opened this event (ISO) or null
  "confidence": "official",              // official | listing | social | unconfirmed | owner_confirmed
  "fixture": true                        // dev samples only
}
```

**Me** (on every response): `{ "role": "kiriya", "preview": false, "lastLookedAt": "…"|null,
"saved": { "events": ["id", …], "merch": ["eventId~itemId", …] } }`. `lastLookedAt` here is the
whole section's mark (moved by `POST /api/events/seen` without an `eventId`).

### `GET /api/events/:id` — one event, everything

`{ "event": EventDetail, "me": Me }`. 404 `event_not_found` if it's gone or hidden.

EventDetail is EventCard plus:

```json
{
  "dossier": {
    "about": {
      "summary": Claim,                  // what it is
      "like": Claim | null,              // what it's like
      "highlights": [Claim]
    },
    "days": [{
      "date": "2026-11-28", "label": "saturday", "opens": "10:00", "closes": "21:00",
      "startsAt": "2026-11-28T10:00:00+08:00", "endsAt": "2026-11-28T21:00:00+08:00",
      "timeLabel": "10am – 9pm", "dateLabel": "28 nov",
      "note": "cosplay singles finals 3pm", "sourceIds": ["s1"], "sourceId": "s1"
    }],                                  // empty when only a range is known (see datesNote)
    "datesNote": Claim | null,           // e.g. "open daily during mall hours, 10am – 10pm"
    "venue": {
      "name": "…", "hall": "Halls 401–404, Level 4", "address": "1 Raffles Boulevard, Singapore 039593",
      "area": "City Hall", "lat": 1.2937, "lng": 103.8572,
      "directions": [Claim],             // MRT station + exit, bus, taxi drop-off
      "sourceIds": ["s1"], "sourceId": "s1"
    } | null,
    "tickets": {
      "status": "on_sale", "opensAt": "2026-09-01T12:00:00+08:00" | null, "buyUrl": "https://…" | null,
      "tiers": [{ "name": "1-day pass", "price": 18, "currency": "SGD", "priceLabel": "S$18",
                  "status": "on_sale", "note": "Friday is quietest", "sourceIds": ["s5"], "sourceId": "s5" }],
      "note": Claim | null
    },
    "links": [{ "label": "official site", "url": "https://…", "kind": "official" }],
    "guests": [{ "name": "…", "role": "cosplay judge", "day": "2026-11-28" | null, "fandoms": ["cosplay"],
                 "note": "…" | null, "sourceIds": ["s2"], "sourceId": "s2" }],
    "merch": [MerchCard],                // merch and exclusives (same shape as /merch)
    "size": { "scale": "huge", "text": "…", "sourceIds": ["s6"], "sourceId": "s6" } | null,
    "tips": [Claim],
    "popup": { "about": Claim, "sold": [Claim] } | null      // pop-ups and cafés: what it's about, what's sold
  },
  "timeline": [{                         // always the seven stages, in order
    "stage": "tickets", "title": "tickets on sale", "text": "1-day from S$18" | null,
    "at": "2026-09-01T12:00:00+08:00" | null, "state": "done",
    "sourceIds": ["s5"], "sourceId": "s5"
  }],
  "updates": [{                          // the update log, newest first
    "id": "uuid", "at": "2026-11-10T03:00:00.000Z", "kind": "merch",
    "title": "exclusives revealed", "text": "AFA × Hatsune Miku acrylic stand, …",
    "big": true, "unseen": true, "sourceIds": ["s3"], "sourceId": "s3"
  }],
  "sources": [{
    "id": "s3", "label": "AFA's Instagram: merch reveal", "url": "https://www.instagram.com/…",
    "kind": "social", "publisher": "AFA on Instagram", "at": "2026-11-10T03:00:00Z",
    "images": ["/api/uploads/media?path=events/…"]   // Instagram post images, our own copies
  }],
  "weather": Weather | null,
  "transit": { "status": "normal" | "disrupted", "alerts": [{ "line": "CCL", "message": "…", "stations": ["…"], "at": "…" }],
               "fetchedAt": "…", "credit": "LTA DataMall" } | null,
  "admin": { "origin": "crawler", "hidden": false, "investigatedAt": "…", "firstSeenAt": "…", "confidence": "official" }  // Josh only
}
```

`Claim` is `{ "text": "…", "sourceIds": ["s1"], "sourceId": "s1" }`.

`unseen` on updates is relative to this event's `lastLookedAt` (or the section mark). Show the
detail, then call `POST /api/events/seen { eventId }`.

**Weather** — the worker picks the source by distance to the event (Open-Meteo 5–16 days out, the
NEA four-day outlook within 4 days, the NEA 2-hour forecast on the day):

```json
{
  "source": "open-meteo" | "nea-4day" | "nea-2h",
  "label": "NEA four-day outlook",
  "fetchedAt": "2026-11-26T02:00:00Z",
  "days": [{ "date": "2026-11-28", "summary": "Thundery showers in the afternoon", "icon": "thundery",
             "tempLow": 24, "tempHigh": 31, "rainChance": 70 | null }],   // only event days from today on
  "now": { "area": "City", "forecast": "Light Showers", "icon": "rain", "validUntil": "…" } | null,   // on the day
  "note": "it's all indoors, but bring an umbrella for the walk from the MRT." | null,
  "credit": "Source: National Environment Agency, data.gov.sg (Singapore Open Data Licence)"   // must be shown
}
```

Show `credit` wherever weather shows (Open-Meteo is CC BY 4.0: "Weather data by Open-Meteo.com").

### `GET /api/events/:id/calendar.ics` — Add to Calendar (no session needed)

`text/calendar`. The app opens this URL and iOS shows its "Add to Calendar" sheet. Public facts only:
name, each day with its times in SGT (all-day dates when times are unknown), venue + address + geo,
official URL. The route calls `toIcs(event)` from `shared/eventCalendar.js` (written by events-ui)
with the **public subset of EventDetail in the same shape**: `id, name, kind, tagline, startsOn,
endsOn, startsAt, endsAt, datesTbc, url, venueName, venueArea, dossier.days[{date, opens, closes,
label, startsAt, endsAt}], dossier.venue{name, hall, address, area, lat, lng}`. Until that file is
merged a built-in fallback answers. 404 for unknown or hidden events.

### `GET /api/events/merch` — merch and exclusives

Query: `fandom=…`, `saved=1`, `when=all` (default: upcoming and on-now events only).
`{ "merch": [MerchCard], "me": Me, "today": "…" }`

```json
{
  "id": "fx-afa-singapore-2026~m-afa-miku-acrylic", "itemId": "m-afa-miku-acrylic",
  "name": "AFA × Hatsune Miku acrylic stand", "kind": "exclusive", "fandoms": ["miku"],
  "price": 25, "currency": "SGD", "priceLabel": "S$25",
  "where": "official merch booth, hall 402", "when": "while stocks last",
  "limited": true, "status": "revealed", "note": "one per person on Friday",
  "image": "…" | null, "saved": false,
  "sourceIds": ["s3"], "sourceId": "s3",
  "event": { "id": "…", "name": "AFA Singapore 2026", "kind": "con", "startsOn": "…", "endsOn": "…",
             "dateLabel": "27–29 nov", "venueName": "…", "status": "on_now" }
}
```

### `GET /api/events/home` — the home section's events & merch block

```json
{
  "next": EventCard | null,       // the soonest dated upcoming event that's hers (else the soonest)
  "onNow": [EventCard],           // happening today
  "upcoming": [EventCard],        // the next four after `next`
  "fresh": [{ "id": "uuid", "at": "…", "kind": "merch", "title": "exclusives revealed", "text": "…", "big": true,
              "event": { "id": "…", "name": "…", "kind": "con", "dateLabel": "27–29 nov" } }],   // ≤4 unseen since the section mark
  "merch": [MerchCard],           // three from her events
  "counts": { "upcoming": 11, "unseenUpdates": 4, "saved": 2 },
  "me": Me, "today": "2026-11-27", "updatedAt": "…"
}
```

### `GET /api/events/saved`

`{ "events": [EventCard], "merch": [MerchCard], "me": Me, "today": "…" }` — hers (Josh sees hers).

### `POST /api/events/:id/save` and `POST /api/events/merch/:merchId/save`

Body `{ "saved": true | false }` (default `true`). → `{ "id": "…", "saved": true, "preview": false }`.
Her session only; Josh's gets `preview: true` and nothing changes. 404 when the event or item is gone.

### `POST /api/events/seen`

Body `{ "eventId": "…" }` moves that event's `lastLookedAt`; `{}` moves the section mark (call it when
she leaves the events tab or the home block has been on screen). → `{ "eventId": "…" | null,
"lastLookedAt": "…", "preview": false }`. Only her session moves it.

### Deep links and pushes

Event pushes are `kind: "event"` (thread `events`) and navigate to `/world?event=<id>#events`, which
the frame maps to the event's page (RENOVATION.md "Deep links in the app"). The weekly digest
navigates to `/world#events`.

## Josh's side: `/api/admin/events`

### `POST /api/admin/events/links` — the paste-a-link box

Body `{ "url": "https://…", "note": "optional words" }`. → 201 (or 200 if the same link was pasted
in the last hour):

```json
{ "id": "uuid", "url": "https://www.instagram.com/p/…", "note": null, "status": "queued",
  "message": "in the queue; it gets checked within a few minutes", "eventId": null,
  "createdAt": "…", "updatedAt": "…", "created": true }
```

`status` moves `queued → checking → researching → added | updated | not_an_event | duplicate |
failed | paused | skipped`; `eventId` is set once it's added to (or matched with) an event. Poll
`GET /api/admin/events/links/:id` (same shape) every few seconds while it's on screen;
`GET /api/admin/events/links` → `{ "links": [Link], "statuses": { status: message } }` lists the last
30. 400 `invalid_link` for junk. Links to sites we don't crawl (Suntec, Singapore EXPO, some malls)
are researched through web search, never fetched.

### `GET /api/admin/events/spend` — the Claude ledger (US$20/month hard ceiling)

```json
{
  "month": "2026-11", "ceilingUsd": 20, "spentUsd": 6.4215, "remainingUsd": 13.5785, "projectedUsd": 7.4,
  "calls": 212, "paused": false, "pausedReason": null,      // "ceiling" | "pace" when paused
  "byPurpose": [{ "purpose": "investigate", "model": "claude-opus-5-5", "calls": 14, "usd": 5.9, "webSearches": 61 }],
  "days": [{ "day": "2026-11-26", "usd": 0.41 }],
  "recent": [{ "at": "…", "model": "claude-haiku-5-5", "purpose": "triage", "usd": 0.0003, "inputTokens": 2100,
               "outputTokens": 90, "cacheReadTokens": 1800, "cacheWriteTokens": 0, "webSearches": 0,
               "eventId": null, "signalId": "uuid", "dryRun": false }]
}
```

`PUT /api/admin/events/spend { "ceilingUsd": 12 }` lowers the ceiling (0–20; never above 20).
"pace" means this month is being spent faster than it passes; it resumes the next day.

### Other admin routes

- `GET /api/admin/events/status` → `{ worker: { healthy, lastTickAt, dryRun, version, … }, queue: { queued: 2, … },
  sources: [{ id, name, method, lastCheckAt, status, nextAt }], recentUpdates: [{ id, eventId, at, kind, title, push, pushedAt }] }`.
- `PATCH /api/admin/events/:id { hidden?, hers?, big? }` → `{ event: EventDetail }`.
- `POST /api/admin/events/:id/refresh` → 202 `{ id, status: "queued", eventId }`: the worker looks into it again.

## The worker: `/api/jobs/events` (not for screens)

`POST /api/jobs/events/deliver { digest?: true }` with `Authorization: Bearer $CRON_SECRET`: the
Railway worker asks Vercel to send due pushes, so push keys stay in Vercel only.

## Running the engine (for the coordinator and Josh)

**Pieces.** The Railway worker (`node worker/index.js`, config `worker/railway.json`: point the
service's config-as-code path at it) ticks every minute: queue first-research for events with no
dossier, check sources that are due (≤6 a tick, each at its own cadence, robots.txt first, blocked
sites never), Apify Instagram (every 8 h), the newsletter inbox (every 30 min), the signal queue
(≤3 a tick: Haiku triage → Opus investigation), weather (every 3 h; 30 min on event days) and
trains, then asks Vercel to deliver pushes (`/api/jobs/events/deliver`). It writes a heartbeat to
`settings.events_worker` (admin status) and answers `GET /health`. The OpenAI weekly events stage is
retired (no import, no cron).

**Railway variables** (none are needed for a dry run):

| Variable | What |
| --- | --- |
| `DATABASE_URL` | the same Neon database as Vercel |
| `ANTHROPIC_API_KEY` | Claude; without it everything runs as a dry run (a stand-in answers, nothing billed) |
| `CRON_SECRET` | the same value as in Vercel; lets the worker ask Vercel to send pushes |
| `APIFY_TOKEN` | Apify Instagram trigger (optional `APIFY_INSTAGRAM_ACTOR`, default `apify~instagram-scraper`; `EVENTS_INSTAGRAM_EVERY_HOURS`, default 8) |
| `BLOB_READ_WRITE_TOKEN` (or `BLOB_STORE_ID`) | to copy Instagram images into the private Blob store (`events/` folder) |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | the newsletter inbox (read-only scope `gmail.readonly`); optional `EVENTS_GMAIL_QUERY` |
| `LTA_DATAMALL_KEY` | train alerts on event days (optional) |
| `DATA_GOV_SG_API_KEY` | higher NEA rate limit (optional; works without) |
| `EVENTS_DRY_RUN=1` | force a dry run even with a key |
| `EVENTS_CLAUDE_CEILING_USD` | lower the monthly ceiling (never above 20; admin can lower it too) |

**Vercel variables:** `EVENTS_PUSH_AUDIENCE` = `admin` (default: Josh's phones only while the app
is a surprise) → `kiriya` or `both` when Josh says. App test mode always routes event pushes to
Josh only, marked "test". Nothing else new (push keys, `CRON_SECRET` and Blob already exist).

**Cost guard.** Every Claude call checks the month's ledger first (`event_spend`): it needs the
call's worst case (triage US$0.02, investigation US$1.50, refresh US$1.00) to fit under the ceiling
and under the month's pace (ceiling × day/days-in-month + US$4). An investigation also stops at
US$1.20 itself. When paused, signals wait as `paused` and resume the next day or month. Web search
is capped at 5 uses (3 on refresh), web fetch at 6 (4), 8k tokens each; prompts are cached.
