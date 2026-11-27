# Events engine: Instagram trigger shortlist (SG anime / cosplay / pop-ups)

Researched 2026-11-27. No instagram.com pages were fetched. Handles come from organisers' own sites, articles crediting the account, or listing pages. **Follower counts could not be verified from any non-Instagram source** (search returned none), so none are given; check them once in the Apify run. Activity is inferred from event dates in 2026 coverage.

Confidence: **A** = organiser's own site links it; **B** = named in an article/guide; **C** = account is real but its role is secondary.

| # | Handle | Who | Covers | Early-trigger value | Followers / activity | Evidence |
|---|---|---|---|---|---|---|
| 1 | animefestivalasia | AFA (SOZO Pte Ltd) | AFA SG (Suntec, 27-29 Nov 2026), guests, concerts, tickets | Announces months ahead; biggest SG anime event | n/v; active (AFASG26 running now) | A: animefestival.asia footer |
| 2 | sgcomiccon | Singapore Comic Con (GenXP) | SGCC 4-6 Dec 2026, guests, exclusives | Guest and ticket drops | n/v; active | A: singaporecomiccon.com |
| 3 | neotokyoproject | Neo Tokyo Project, organiser of Doujin Market (Doujima) and Doumini | Doujin Market (May, Suntec), Doumini 12-13 Dec 2026 | Only organiser account found; no separate Doujin Market handle on its site | n/v; active (2026 editions) | A: neotokyoproject.com |
| 4 | anipluscafe.sg | ANIPLUS Cafe, Esplanade Mall | Collab cafés (Miku Colorful Stage, Haikyu!!, hololive, Blue Archive) | Where collab cafés are announced first | n/v; active 2026 | B: hololive/Aniplus announcements, 2024 listing |
| 5 | gundambasesg | The Gundam Base Singapore, Jewel Changi (opened 3 Feb 2026) | Merch drops, exclusives | Drop notices; narrow fandom fit | n/v; active 2026 | B: GetGo guide (single source) |
| 6 | cossetevent | COSSET cosplay and ACG flea market | COSSET 03 and others | Cosplay community; Instagram-first | n/v; active 2026 (COSSET 02 in Mar 2026) | A: cossetevent.carrd.co |
| 7 | dokidokianimemarket | DOKI! DOKI! Anime Market | Anime markets (Jun 2026) | Merch and market dates | n/v | B: credited in TheSmartLocal 2026 guide |
| 8 | mush.mers | Operator of acgevents.sg (personal project) | Calendar of SG ACG events, fan cafés, Apothecary Diaries exhibition entry | Closest thing to an aggregator found; lists fan cafés and small events | n/v; personal account, may post little | A: acgevents.sg footer (only social link) |
| 9 | afashop.co | AFA merch shop (AFASHOP) | AFA exclusives, merch | Merch drops | n/v | A: animefestival.asia |
| 10 | thesmartlocalsg | TheSmartLocal | General SG lifestyle, incl. pop-ups and cons | Broad, noisy, mostly not anime | n/v; very active | A: site header |
| 11 | (EOY, Cosfest, SCC) | EOY LLP (theeoy.com); Singapore Cosplay Club / Cosfest (Facebook: cosfestsg) | EOY Festival 25-26 Dec 2026 at Suntec; Cosfest | Important, but **no Instagram handle found** | - | theeoy.com and egg.network list only Facebook |

Items 12-20 were not found: no verified SG pop-up tracker, "what's on in SG for otaku" or cosplay-hub account surfaced without scraping. Not listed because handles cannot be backed by a source: Hakken (only Facebook, hakkenonline), Randamu Anime / Randamu World (Telegram only), Konbini market (no results), Toei Animation Store, Sanrio/Miku pop-ups.

## Recommended 8

1. **animefestivalasia**: the biggest SG anime event and Suntec/EXPO convention trigger (guests, Miku, concerts).
2. **sgcomiccon**: second big convention; guest and exclusive merch announcements.
3. **neotokyoproject**: Doujin Market and Doumini (doujin, artists, merch).
4. **anipluscafe.sg**: collab cafés (Miku, anime IP) which match her fandoms most directly.
5. **gundambasesg**: merch drops and exclusives at Jewel; weak fandom fit, but one of few active retail-drop accounts.
6. **cossetevent**: cosplay community and flea market, Instagram-only.
7. **dokidokianimemarket**: anime market and merch events outside the big cons.
8. **mush.mers**: acgevents.sg's operator; the only aggregator-style source found. Verify it posts before committing; swap for afashop.co if quiet.

Alternates: afashop.co, thesmartlocalsg, then (once handles are confirmed) EOY and Cosfest/Singapore Cosplay Club.

Gap: pop-up stores in malls (Suntec, VivoCity, Plaza Singapura, MBS) have no obvious dedicated account. Cover them with a mall or news source (Time Out SG, The Beat, Geek Culture, Mothership) outside Instagram, not by watching accounts.

## Registry check (server/lib/events/registry.js INSTAGRAM_ACCOUNTS)

| Registry handle | Verdict |
|---|---|
| animefestivalasia | Right |
| sgcomiccon | Right |
| doujinmarket | Unverified, probably wrong. Organiser's site links `neotokyoproject` only |
| konbini.sg | Unverified; no source found. Remove or confirm |
| anipluscafesg | Wrong. Use `anipluscafe.sg` |
| thegundambasesg | Wrong. Use `gundambasesg` |
| sgcosplayclub | Unverified; no source found (Cosfest has only a Facebook page, cosfestsg) |
| cosset.sg | Wrong. Use `cossetevent` |

Missing: neotokyoproject, dokidokianimemarket, mush.mers, afashop.co, and an EOY handle.
