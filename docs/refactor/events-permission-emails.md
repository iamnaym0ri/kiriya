# Permission emails: Suntec Singapore and Singapore EXPO

Drafts for Josh to send (PLAN.md phase 6). Both sites' terms forbid automated access without
written permission, so the events worker never fetches them (`server/lib/events/registry.js`
`BLOCKED_HOSTS`). If either says yes, keep the reply, then remove its host from `BLOCKED_HOSTS` and
add a source for it (Suntec: `sitemap` on `https://www.suntecsingapore.com/sitemap.xml` filtered to
`/visit-events/`; EXPO: `wp-json` on its `event` post type, ordered by `modified`).

Fill in the bracketed parts. Send from your own address.

---

## 1. Suntec Singapore Convention & Exhibition Centre

**To:** the enquiry address on https://www.suntecsingapore.com/contact-us (or their general
enquiries / marketing contact)
**Subject:** Permission request: reading your public event pages for a private, non-commercial site

Dear Suntec Singapore team,

I run a small private website, not open to the public and with no advertising or revenue, that
keeps one person (my partner, who lives in Singapore) up to date on anime, cosplay and pop-culture
events she might like to attend. Many of the events she cares about are held at Suntec, such as AFA
Singapore, Doujin Market, Asia Comics Expo and HoYo FEST.

Your Terms of Use (section 2) ask that nobody runs automated queries against the website without
written permission, so I'm writing to ask for that permission, on these terms:

- **What:** only your sitemap (`/sitemap.xml`) and the public event pages under `/visit-events/`
  that it lists, to see when an event page is added or updated and read its dates, hall and
  opening hours.
- **How often:** the sitemap at most twice a day, and an event page only when its `lastmod` date
  changes, so a few requests a day in total, spaced well apart.
- **How:** an honest user agent (`kiriya-love-events/1.0 (+https://kiriya.love)`), following your
  robots.txt, conditional requests where possible, and stopping at once if you ask.
- **What we show:** facts only (event name, dates, hall, opening hours) with a link back to your
  page. We don't copy your text, images or layout, and nothing is republished or sold.

If you'd prefer that we use something else, such as an events newsletter, a feed or an API, I'd be
glad to use that instead.

Thank you for considering it. I'm happy to answer any questions.

Kind regards,
[Your name]
[Your email]
https://kiriya.love

---

## 2. Singapore EXPO (Constellar)

**To:** the enquiry address on https://www.singaporeexpo.com.sg/contact-us (Constellar)
**Subject:** Permission request: reading your public events listing for a private, non-commercial site

Dear Singapore EXPO team,

I run a small private website, not open to the public and with no advertising or revenue, that
keeps one person (my partner, who lives in Singapore) informed about anime, cosplay, trading-card
and pop-culture fairs she might enjoy. Some of these are held at Singapore EXPO, such as the
Singapore Card Show and consumer fairs.

Your Terms of Use (section 4.8(d)) don't allow robots or scrapers, so I'm asking for written
permission for a very light, polite use:

- **What:** only your public events listing (the WordPress `event` entries your site already
  publishes, ordered by last modified), to notice new or changed events and read their dates and
  halls.
- **How often:** once or twice a day, a single small request each time.
- **How:** an honest user agent (`kiriya-love-events/1.0 (+https://kiriya.love)`), following your
  robots.txt, and stopping straight away if you ask.
- **What we show:** facts only (event name, dates, hall) with a link back to your page. Nothing is
  copied, republished or sold.

If there's an events newsletter, a feed or a partner API you'd rather we use, I'd be happy to.

Thank you for your time.

Kind regards,
[Your name]
[Your email]
https://kiriya.love

---

## Meanwhile (no permission needed)

- Subscribe the events newsletter inbox (`GMAIL_*`) to both venues' newsletters if they have one,
  and to the organisers who book them (AFA/SOZO, Neo Tokyo Project, Eventbrite "follow organiser").
- The Instagram accounts the Apify trigger watches (`INSTAGRAM_ACCOUNTS` in
  `server/lib/events/registry.js`) cover the events held there.
- Opus may still find their pages through web search during an investigation; it never fetches
  them (`web_fetch` `blocked_domains`).
