import Foundation

// Sample cons for the lab: Singapore's real 2026 dates (server/feeds/events/sources.js, checked
// 2026-09-15) plus a couple of made-up edge cases. Nothing here reaches the server.

enum ConLab {
    static func day(_ text: String) -> ConWidgetDay { ConWidgetDay(text)! }

    /// "2026-11-26 14:18:30" read as Singapore time.
    static func sgt(_ text: String) -> Date {
        let parts = text.split(separator: " ")
        let d = day(String(parts[0]))
        let hms = parts.count > 1 ? parts[1].split(separator: ":").compactMap { Double($0) } : []
        let seconds = (hms.first ?? 0) * 3600 + (hms.count > 1 ? hms[1] : 0) * 60 + (hms.count > 2 ? hms[2] : 0)
        return d.start.addingTimeInterval(seconds)
    }

    static func event(_ id: String, _ title: String, _ from: String, _ to: String, venue: String?, tags: [String], hers: Bool, opensAt: Date? = nil) -> ConWidgetEvent {
        ConWidgetEvent(id: id, title: title, first: day(from), last: day(to), venue: venue, city: "Singapore",
                       tags: tags, hers: hers, link: URL(string: "kiriyalove://open/world?event=\(id)#events"), opensAt: opensAt)
    }

    static let afa = event("afa-singapore:2026", "AFA Singapore", "2026-11-27", "2026-11-29",
                           venue: "Suntec Singapore Convention & Exhibition Centre", tags: ["anime", "cosplay", "music"], hers: true)
    static let sj60 = event("sj60-musubi-festival:2026", "SJ60 Musubi Festival", "2026-11-28", "2026-11-29",
                            venue: "Marina Bay Sands, Hall D&E", tags: ["japan culture", "anime", "music"], hers: false)
    static let sgcc = event("singapore-comic-con:2026", "Singapore Comic Con", "2026-12-04", "2026-12-06",
                            venue: "Marina Bay Sands Expo & Convention Centre", tags: ["comics", "cosplay", "pop culture"], hers: true)
    static let doujin = event("doujin-market:2026", "Doujin Market / Doumini", "2026-12-12", "2026-12-13",
                              venue: "Hall 405, Suntec Singapore Convention & Exhibition Centre", tags: ["doujin", "artist alley", "comics"], hers: false)
    static let eoy = event("eoy-festival:2026", "EOY Music, Comics & Arts Festival", "2026-12-25", "2026-12-26",
                           venue: "Suntec City Convention Centre, Hall 405", tags: ["comics", "music", "artist alley"], hers: false)
    static let cosset = event("cosset:2026", "COSSET cosplay flea market", "2026-12-19", "2026-12-19",
                              venue: "*SCAPE, 2 Orchard Link", tags: ["cosplay", "flea market"], hers: false)
    static let apothecary = event("apothecary-diaries-exhibition-sg:2026", "The Apothecary Diaries Exhibition", "2026-09-30", "2026-11-01",
                                  venue: "Fever Exhibition Hall, 25 Scotts Road, Singapore 228220", tags: ["the apothecary diaries", "exhibition"], hers: true)
    static let animeEarth = event("anime-earth:2026", "Anime Earth", "2026-09-28", "2026-10-04",
                                  venue: "L1 Atrium, City Square Mall", tags: ["anime", "cosplay", "marketplace"], hers: false)
    static let hoyofest = event("hoyofest-sg:2027", "HoYoFEST Singapore", "2027-04-03", "2027-04-04",
                                venue: "Singapore EXPO Hall 7", tags: ["genshin impact", "honkai: star rail", "games"], hers: false)

    static let season = [afa, sj60, sgcc, doujin, cosset, eoy]

    struct Scenario {
        let name: String
        let note: String
        let now: Date
        let events: [ConWidgetEvent]
        var state: ConWidgetEntry.State = .ready

        var feed: ConWidgetFeed { ConWidgetFeed(events: events, eventsLink: URL(string: "kiriyalove://open/world#events")) }
        var entry: ConWidgetEntry { ConWidgetEntry(date: now, feed: feed, state: state) }
        var moment: ConWidgetMoment { ConWidgetMoment(events: feed.events, at: now) }
    }

    static let scenarios: [Scenario] = [
        Scenario(name: "far", note: "10 days to AFA", now: sgt("2026-11-17 14:00"), events: season),
        Scenario(name: "near2", note: "in 2 days: 33 h clock", now: sgt("2026-11-25 15:00"), events: season),
        Scenario(name: "near", note: "tomorrow: 9 h 41 m clock", now: sgt("2026-11-26 14:18:48"), events: season),
        Scenario(name: "today", note: "day one of AFA", now: sgt("2026-11-27 10:30"), events: season),
        Scenario(name: "doors", note: "day one, doors at 11:00 (if the server sends opensAt)", now: sgt("2026-11-27 09:47:30"),
                 events: [event("afa-singapore:2026", "AFA Singapore", "2026-11-27", "2026-11-29",
                                venue: "Suntec Singapore Convention & Exhibition Centre", tags: ["anime", "cosplay", "music"], hers: true,
                                opensAt: sgt("2026-11-27 11:00"))] + Array(season.dropFirst())),
        Scenario(name: "ongoing", note: "AFA day 2 of 3", now: sgt("2026-11-28 16:00"), events: season),
        Scenario(name: "lastday", note: "AFA's last day", now: sgt("2026-11-29 12:00"), events: season),
        Scenario(name: "ended", note: "the morning after: AFA was lovely, next up SGCC", now: sgt("2026-11-30 09:00"), events: season),
        Scenario(name: "oneday", note: "a one-day flea market, today", now: sgt("2026-12-19 11:00"), events: [cosset, eoy]),
        Scenario(name: "exhibition", note: "a five-week exhibition, day 15", now: sgt("2026-10-14 15:00"), events: [apothecary, afa, sj60, sgcc]),
        Scenario(name: "longname", note: "a long name, not her pick", now: sgt("2026-12-14 20:00"), events: [eoy, hoyofest]),
        Scenario(name: "faraway", note: "three-digit days", now: sgt("2026-12-27 12:00"), events: [hoyofest]),
        Scenario(name: "endednone", note: "the last con ended yesterday, nothing next", now: sgt("2026-12-27 12:00"), events: [eoy]),
        Scenario(name: "none", note: "nothing on the calendar", now: sgt("2026-11-26 14:00"), events: []),
        Scenario(name: "setup", note: "before the app's first open", now: sgt("2026-11-26 14:00"), events: [], state: .notSetUp),
    ]

    static func scenario(_ name: String) -> Scenario? { scenarios.first { $0.name == name } }

    // MARK: Live scenarios for the lab's own widgets (relative to the real clock)

    /// The season moved so that `kind` happens around now.
    static func live(_ kind: String, now: Date) -> [ConWidgetEvent] {
        let today = ConWidgetDay(containing: now)
        func shifted(_ e: ConWidgetEvent, by days: Int) -> ConWidgetEvent {
            ConWidgetEvent(id: e.id, title: e.title, first: e.first.adding(days), last: e.last.adding(days), venue: e.venue,
                           city: e.city, tags: e.tags, hers: e.hers, link: e.link, opensAt: e.opensAt)
        }
        let anchor: Int  // where AFA's first day lands, relative to today
        switch kind {
        case "far": anchor = 10
        case "near": anchor = 1
        case "today": anchor = 0
        case "ongoing": anchor = -1
        case "ended": anchor = -3
        case "none": return []
        case "exhibition":
            let shift = today.adding(-14).number - apothecary.first.number
            let later = today.adding(9).number - afa.first.number
            return [shifted(apothecary, by: shift)] + season.map { shifted($0, by: later) }
        default: anchor = 10
        }
        let shift = today.adding(anchor).number - afa.first.number
        return season.map { shifted($0, by: shift) }
    }
}

// MARK: - The staged midnight (live page and demo widget)

/// Stages a Singapore "midnight" a few seconds away (by moving the day boundary), with AFA
/// starting at it, so the hours clock can be watched running out and the ticket turning to today.
enum ConLabDemo {
    nonisolated(unsafe) static var midnight = Date()

    static func stage(secondsToMidnight: Double, anchor: Date = Date()) {
        stage(at: anchor.addingTimeInterval(secondsToMidnight))
    }

    static func stage(at date: Date) {
        let target = date.timeIntervalSince1970.rounded()
        let rem = target.truncatingRemainder(dividingBy: 86_400)
        ConWidgetDay.utcOffset = rem == 0 ? 0 : 86_400 - rem
        midnight = Date(timeIntervalSince1970: target)
    }

    /// AFA tomorrow (from the staged day), then the rest of the season after it.
    static func feed() -> ConWidgetFeed {
        let tomorrow = ConWidgetDay(containing: midnight)
        let shift = tomorrow.number - ConLab.afa.first.number
        let events = ConLab.season.map { e in
            ConWidgetEvent(id: e.id, title: e.title, first: e.first.adding(shift), last: e.last.adding(shift), venue: e.venue,
                           city: e.city, tags: e.tags, hers: e.hers, link: e.link, opensAt: nil)
        }
        return ConWidgetFeed(events: events)
    }
}

