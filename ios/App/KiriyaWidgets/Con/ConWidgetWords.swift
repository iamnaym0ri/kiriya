import Foundation

// The words on the ticket: dates, venues and the countdown phrases, in the site's voice
// (src/world/feeds/FeedPieces.jsx: "UR PICK · SINGAPORE", "today!!", "tomorrow", "in 3 days").
// Dates are formatted by hand from the Singapore day, so they never depend on the phone's
// locale or time zone.

enum ConWidgetWords {
    private static let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    private static let weekdaysLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    private static let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    private static let monthsLong = ["January", "February", "March", "April", "May", "June", "July",
                                     "August", "September", "October", "November", "December"]

    static func weekday(_ day: ConWidgetDay) -> String { weekdays[day.weekday] }
    static func month(_ day: ConWidgetDay) -> String { months[day.civil.month - 1] }

    /// "27–29 Nov" · "28 Nov" · "30 Nov–1 Dec"
    static func shortRange(_ event: ConWidgetEvent) -> String {
        let a = event.first.civil, b = event.last.civil
        if event.first == event.last { return "\(a.day) \(months[a.month - 1])" }
        if a.month == b.month && a.year == b.year { return "\(a.day)–\(b.day) \(months[b.month - 1])" }
        return "\(a.day) \(months[a.month - 1])–\(b.day) \(months[b.month - 1])"
    }

    /// "Fri 27 – Sun 29 Nov" · "Sat 28 Nov" · "Mon 30 Nov – Tue 1 Dec". Cons longer than a week
    /// (exhibitions) drop the weekdays: "30 Sep – 1 Nov".
    static func longRange(_ event: ConWidgetEvent) -> String {
        let a = event.first.civil, b = event.last.civil
        let wa = weekdays[event.first.weekday], wb = weekdays[event.last.weekday]
        if event.first == event.last { return "\(wa) \(a.day) \(months[a.month - 1])" }
        if event.dayCount > 7 { return "\(a.day) \(months[a.month - 1]) – \(b.day) \(months[b.month - 1])" }
        if a.month == b.month && a.year == b.year { return "\(wa) \(a.day) – \(wb) \(b.day) \(months[b.month - 1])" }
        return "\(wa) \(a.day) \(months[a.month - 1]) – \(wb) \(b.day) \(months[b.month - 1])"
    }

    /// "Sun 29 Nov"
    static func day(_ day: ConWidgetDay) -> String {
        let c = day.civil
        return "\(weekdays[day.weekday]) \(c.day) \(months[c.month - 1])"
    }

    /// "Friday 27 November", for VoiceOver.
    static func spokenDay(_ day: ConWidgetDay) -> String {
        let c = day.civil
        return "\(weekdaysLong[day.weekday]) \(c.day) \(monthsLong[c.month - 1])"
    }

    static func spokenRange(_ event: ConWidgetEvent) -> String {
        event.first == event.last ? spokenDay(event.first) : "\(spokenDay(event.first)) to \(spokenDay(event.last))"
    }

    /// "in 12 days" · "in 2 days" · "tomorrow" · "today!!" · "on now" (the site's countdown words).
    static func phrase(_ event: ConWidgetEvent, today: ConWidgetDay) -> String {
        let away = today.days(to: event.first)
        if away > 1 { return "in \(away) days" }
        if away == 1 { return "tomorrow" }
        if away == 0 { return "today!!" }
        return event.last == today ? "last day!" : "on now"
    }

    /// A short name for tight spots: a leading acronym ("AFA", "SJ60", "EOY"), else the whole
    /// name when it's short enough, else nil.
    static func shortTitle(_ event: ConWidgetEvent, max: Int) -> String? {
        let words = event.title.split(separator: " ")
        if let first = words.first, words.count > 1 {
            let letters = first.filter { $0.isLetter || $0.isNumber }
            if (2...6).contains(letters.count), letters == letters.uppercased(), letters.contains(where: \.isLetter) {
                return String(first)
            }
        }
        return event.title.count <= max ? event.title : nil
    }

    // MARK: Venues

    /// Well-known Singapore venues, as people say them.
    private static let knownVenues: [(match: String, name: String)] = [
        ("suntec", "Suntec"),
        ("sands expo", "Marina Bay Sands"),
        ("marina bay sands", "Marina Bay Sands"),
        ("singapore expo", "Singapore EXPO"),
        ("max atria", "MAX Atria"),
        ("city square mall", "City Square Mall"),
        ("fever exhibition hall", "Fever Exhibition Hall"),
        ("*scape", "*SCAPE"),
        ("plaza singapura", "Plaza Singapura"),
        ("national library", "National Library"),
        ("resorts world", "Resorts World Sentosa"),
        ("jewel changi", "Jewel Changi"),
        ("vivocity", "VivoCity"),
        ("bugis+", "Bugis+"),
        ("bugis junction", "Bugis Junction"),
        ("raffles city", "Raffles City"),
        ("gardens by the bay", "Gardens by the Bay"),
        ("esplanade", "Esplanade"),
        ("the star", "The Star"),
        ("indoor stadium", "Indoor Stadium"),
        ("kallang", "Kallang"),
    ]

    private static let suffixes = [
        " convention & exhibition centre", " convention and exhibition centre", " expo & convention centre",
        " expo and convention centre", " convention centre", " exhibition centre", " convention center",
    ]

    /// "Hall 405, Suntec Singapore Convention & Exhibition Centre" → "Suntec · Hall 405"
    /// (or just "Suntec" without the hall, where room is short).
    static func shortVenue(_ venue: String?, hall: Bool = true) -> String? {
        guard let venue = venue?.trimmingCharacters(in: .whitespacesAndNewlines), !venue.isEmpty else { return nil }
        let lower = venue.lowercased()
        let parts = venue.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        // A hall, level or atrium is worth keeping: it's where to walk to.
        let spot = parts.first { part in
            let p = part.lowercased()
            return p.hasPrefix("hall ") || p.hasPrefix("halls ") || p.hasPrefix("level ") || p.hasPrefix("l1 ")
                || p.hasPrefix("l2 ") || p.hasPrefix("l3 ") || p.hasPrefix("b1 ") || p.hasPrefix("b2 ")
                || p.hasSuffix(" atrium")
        }
        var place: String
        if let known = knownVenues.first(where: { lower.contains($0.match) }) {
            place = known.name
        } else {
            place = parts.first { $0 != spot && !$0.contains(where: \.isNumber) } ?? parts.first ?? venue
            for suffix in suffixes where place.lowercased().hasSuffix(suffix) {
                place = String(place.dropLast(suffix.count))
                break
            }
        }
        if hall, let spot, !place.lowercased().contains(spot.lowercased()) {
            let short = spot.replacingOccurrences(of: " Atrium", with: " atrium")
            return "\(place) · \(short)"
        }
        return place
    }

    /// The city line ("Singapore"), from the con's city, else Singapore (the widget only shows SG cons).
    static func city(_ event: ConWidgetEvent) -> String {
        guard let city = event.city?.trimmingCharacters(in: .whitespaces), !city.isEmpty else { return "Singapore" }
        return city
    }

    /// Up to `limit` tags, lowercased like the site's chips.
    static func tags(_ event: ConWidgetEvent, limit: Int) -> [String] {
        Array(event.tags.map { $0.lowercased() }.prefix(limit))
    }

    // MARK: VoiceOver

    static func spoken(_ moment: ConWidgetMoment) -> String {
        guard let event = moment.event, let countdown = moment.countdown else {
            if let ended = moment.justEnded { return "\(ended.title) was lovely. Nothing else on the calendar yet." }
            return "Next con: nothing on the calendar yet."
        }
        var parts: [String] = []
        if let ended = moment.justEnded { parts.append("\(ended.title) was lovely.") }
        parts.append("Next con: \(event.title)\(event.hers ? ", your pick" : "").")
        switch countdown {
        case .days(let days): parts.append("In \(days) days.")
        case .hours(let days, _): parts.append(days == 1 ? "Tomorrow." : "In 2 days.")
        case .today: parts.append("It's today!")
        case .on(let day, let total): parts.append(moment.isLastDay ? "Happening now, last day, day \(day) of \(total)." : "Happening now, day \(day) of \(total).")
        }
        parts.append(spokenRange(event) + ".")
        if let venue = event.venue { parts.append("At \(venue), \(city(event)).") }
        if !event.tags.isEmpty { parts.append(event.tags.joined(separator: ", ") + ".") }
        return parts.joined(separator: " ")
    }
}
