import Foundation

// The "Next con" widget's data: the cons from the widget snapshot (GET /api/widget/app), read with
// its own forgiving decoder so an older or newer server can never break the widget, and the
// countdown worked out for any moment.
//
// Time: every event date is a date-only day, local to Singapore (events.starts_on / ends_on). A con
// starts at 00:00 Singapore time on its first day and ends at 00:00 the day after its last day.
// Singapore has had no daylight saving since 1982, so a day here is always 24 hours at UTC+8 and the
// arithmetic below needs no time-zone database. If the server ever sends a doors-open time
// (`opensAt`, ISO 8601), the "today" state counts down to it as well.

// MARK: - A day in Singapore

struct ConWidgetDay: Hashable, Comparable {
    /// Days since 1970-01-01 (proleptic Gregorian).
    let number: Int

    /// Singapore is UTC+8 all year. (The render lab moves this to stage a midnight a few seconds
    /// away for its demo; the app never changes it.)
    nonisolated(unsafe) static var utcOffset: TimeInterval = 8 * 3600

    init(number: Int) { self.number = number }

    init(year: Int, month: Int, day: Int) {
        // Howard Hinnant's days_from_civil.
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let mp = (month + 9) % 12
        let doy = (153 * mp + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        number = era * 146_097 + doe - 719_468
    }

    /// "2026-11-27" (anything after the tenth character is ignored, so "2026-11-27T00:00:00Z" works too).
    init?(_ text: String?) {
        guard let text else { return nil }
        let parts = text.prefix(10).split(separator: "-")
        guard parts.count == 3, parts[0].count == 4,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]),
              (1...12).contains(month), (1...31).contains(day) else { return nil }
        self.init(year: year, month: month, day: day)
        guard civil.month == month, civil.day == day else { return nil }  // no 31 February
    }

    /// The Singapore day a moment falls on.
    init(containing date: Date) {
        let seconds = date.timeIntervalSince1970 + Self.utcOffset
        number = Int((seconds / 86_400).rounded(.down))
    }

    /// 00:00 Singapore time on this day.
    var start: Date { Date(timeIntervalSince1970: TimeInterval(number) * 86_400 - Self.utcOffset) }

    func adding(_ days: Int) -> ConWidgetDay { ConWidgetDay(number: number + days) }
    func days(to other: ConWidgetDay) -> Int { other.number - number }

    var civil: (year: Int, month: Int, day: Int) {
        let z = number + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let day = doy - (153 * mp + 2) / 5 + 1
        let month = mp < 10 ? mp + 3 : mp - 9
        return (yoe + era * 400 + (month <= 2 ? 1 : 0), month, day)
    }

    /// 0 = Sunday … 6 = Saturday (1970-01-01 was a Thursday).
    var weekday: Int { ((number % 7) + 11) % 7 }

    static func < (a: ConWidgetDay, b: ConWidgetDay) -> Bool { a.number < b.number }
}

// MARK: - A con

struct ConWidgetEvent: Identifiable, Hashable {
    let id: String
    let title: String
    let first: ConWidgetDay
    let last: ConWidgetDay
    let venue: String?
    let city: String?
    let tags: [String]
    /// One of her picks (events.hers): "ur pick ♡", as the site says.
    let hers: Bool
    /// Where a tap on this con goes (kiriyalove://open/…), when the server names one.
    let link: URL?
    /// Doors open, when the server knows it.
    let opensAt: Date?

    var dayCount: Int { first.days(to: last) + 1 }
    var start: Date { first.start }
    var end: Date { last.adding(1).start }

    func isOver(on day: ConWidgetDay) -> Bool { last < day }
}

// MARK: - The snapshot, as this widget reads it

/// Every field optional and every value checked, so a field the server adds, drops or changes the
/// type of only ever hides that one detail.
struct ConWidgetWireEvent: Decodable {
    var id: String?
    var title: String?
    var startsOn: String?
    var endsOn: String?
    var daysAway: Int?
    var venue: String?
    var city: String?
    var tags: [String]?
    var hers: Bool?
    var link: String?
    var opensAt: String?

    private enum Keys: String, CodingKey {
        case id, title, name, startsOn, endsOn, daysAway, venue, city, tags, hers, link, opensAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        func text(_ key: Keys) -> String? {
            guard let value = try? c.decodeIfPresent(String.self, forKey: key) else { return nil }
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
        id = text(.id)
        title = text(.title) ?? text(.name)
        startsOn = text(.startsOn)
        endsOn = text(.endsOn)
        daysAway = (try? c.decodeIfPresent(Int.self, forKey: .daysAway)) ?? nil
        venue = text(.venue)
        city = text(.city)
        if let list = try? c.decodeIfPresent([ConWidgetLossy<String>].self, forKey: .tags) {
            tags = list.compactMap(\.value)
        }
        hers = (try? c.decodeIfPresent(Bool.self, forKey: .hers)) ?? nil
        link = text(.link)
        opensAt = text(.opensAt)
    }

    /// The con, or nil when it has no usable date. `today` places an old server's `daysAway`.
    func event(today: ConWidgetDay) -> ConWidgetEvent? {
        guard let first = ConWidgetDay(startsOn) ?? daysAway.map({ today.adding($0) }) else { return nil }
        var last = ConWidgetDay(endsOn) ?? first
        if last < first || first.days(to: last) > 400 { last = first }
        let name = title ?? "a con"
        let linkURL = link.flatMap(URL.init(string:)).flatMap { $0.scheme == "kiriyalove" ? $0 : nil }
        return ConWidgetEvent(
            id: id ?? "\(name.lowercased())|\(first.number)",
            title: name,
            first: first,
            last: last,
            venue: venue,
            city: city,
            tags: (tags ?? []).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty },
            hers: hers ?? false,
            link: linkURL,
            opensAt: opensAt.flatMap(ConWidgetFeed.parseInstant))
    }
}

/// An array element that may fail on its own without failing the array.
struct ConWidgetLossy<Value: Decodable>: Decodable {
    let value: Value?
    init(from decoder: Decoder) throws { value = try? decoder.singleValueContainer().decode(Value.self) }
}

struct ConWidgetWireSnapshot: Decodable {
    struct Links: Decodable { var events: String? }
    var nextEvent: ConWidgetWireEvent?
    /// Proposed: the next few cons (ongoing ones included), soonest first.
    var events: [ConWidgetLossy<ConWidgetWireEvent>]?
    var links: Links?
}

// MARK: - The feed

struct ConWidgetFeed {
    /// Soonest first; a con stays in the list until the day after it ends.
    var events: [ConWidgetEvent]
    /// The app's events section (links.events).
    var eventsLink: URL

    static let defaultLink = URL(string: "kiriyalove://open/world#events")!

    init(events: [ConWidgetEvent], eventsLink: URL? = nil) {
        self.events = ConWidgetFeed.ordered(events)
        self.eventsLink = eventsLink ?? Self.defaultLink
    }

    /// Reads the snapshot JSON the app and the other widgets keep in the App Group.
    init?(snapshotJSON data: Data, now: Date = Date()) {
        guard let wire = try? JSONDecoder().decode(ConWidgetWireSnapshot.self, from: data) else { return nil }
        let today = ConWidgetDay(containing: now)
        var list = (wire.events ?? []).compactMap(\.value).compactMap { $0.event(today: today) }
        if let next = wire.nextEvent?.event(today: today), !list.contains(where: { Self.same($0, next) }) {
            list.append(next)
        }
        let link = wire.links?.events.flatMap(URL.init(string:)).flatMap { $0.scheme == "kiriyalove" ? $0 : nil }
        self.init(events: list, eventsLink: link)
    }

    func link(for event: ConWidgetEvent?) -> URL { event?.link ?? eventsLink }

    private static func same(_ a: ConWidgetEvent, _ b: ConWidgetEvent) -> Bool {
        a.id == b.id || (a.title.lowercased() == b.title.lowercased() && a.first == b.first)
    }

    /// Soonest first; on the same day her picks first, then by name. Duplicates dropped.
    static func ordered(_ events: [ConWidgetEvent]) -> [ConWidgetEvent] {
        var seen: [ConWidgetEvent] = []
        for event in events.sorted(by: { a, b in
            if a.first != b.first { return a.first < b.first }
            if a.hers != b.hers { return a.hers }
            if a.last != b.last { return a.last < b.last }
            return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedAscending
        }) where !seen.contains(where: { same($0, event) }) {
            seen.append(event)
        }
        return seen
    }

    static func parseInstant(_ text: String) -> Date? {
        let plain = ISO8601DateFormatter()
        if let date = plain.date(from: text) { return date }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: text)
    }
}

// MARK: - The countdown at a moment

enum ConWidgetCountdown: Equatable {
    /// Three or more days to go: the big day count.
    case days(Int)
    /// One or two days to go (under 48 hours to the start of day one): a live hours clock.
    case hours(days: Int, until: Date)
    /// Day one (and a one-day con's only day). `doors` when a doors-open time is still ahead.
    case today(doors: Date?)
    /// Day two onwards of a longer con.
    case on(day: Int, of: Int)
}

struct ConWidgetMoment {
    let date: Date
    let today: ConWidgetDay
    /// The con in the spotlight: the one on now, or the next to start.
    let event: ConWidgetEvent?
    let countdown: ConWidgetCountdown?
    /// The cons after it, soonest first.
    let later: [ConWidgetEvent]
    /// A con that ended yesterday, for one day of "that was lovely".
    let justEnded: ConWidgetEvent?

    init(events: [ConWidgetEvent], at date: Date) {
        self.date = date
        let today = ConWidgetDay(containing: date)
        self.today = today
        let live = events.filter { !$0.isOver(on: today) }
        event = live.first
        later = Array(live.dropFirst())
        justEnded = events.filter { $0.last == today.adding(-1) }.sorted { ($0.hers ? 0 : 1) < ($1.hers ? 0 : 1) }.first
        if let event = live.first {
            let away = today.days(to: event.first)
            if away >= 3 {
                countdown = .days(away)
            } else if away >= 1 {
                countdown = .hours(days: away, until: event.start)
            } else {
                let day = event.first.days(to: today) + 1
                if day <= 1 {
                    countdown = .today(doors: event.opensAt.flatMap { $0 > date && ConWidgetDay(containing: $0) == today ? $0 : nil })
                } else {
                    countdown = .on(day: day, of: event.dayCount)
                }
            }
        } else {
            countdown = nil
        }
    }

    var isLastDay: Bool {
        guard let event, case .on = countdown else { return false }
        return event.last == today
    }
}
