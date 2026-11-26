import SwiftUI
import WidgetKit

// The "Next con" widget: a con ticket counting down to the next con in Singapore.
// Same kind as before ("NextConWidget"), so a widget already on a Home Screen keeps working.
//
// Timeline: the countdown only changes at Singapore midnights (a day goes by, a con starts or
// ends; the 48-hour clock also starts at a midnight because cons start at one) and at a doors-open
// time, so there is an entry at each of those for the next two weeks; everything in between moves
// by itself (system timers). The Lock Screen ring adds an entry an hour in the last 48 hours. The
// data is fetched again about every hour, through the same cached snapshot as the other widgets.

struct ConWidget: Widget {
    static let kind = "NextConWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: ConWidgetProvider()) { entry in
            ConWidgetView(entry: entry)
        }
        .configurationDisplayName("Next con")
        .description("A ticket to the next con, counting down live.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge,
                            .accessoryRectangular, .accessoryCircular, .accessoryInline])
        .contentMarginsDisabled()
    }
}

struct ConWidgetEntry: TimelineEntry {
    enum State: Equatable {
        case ready
        /// The app hasn't handed the widgets their key yet.
        case notSetUp
        /// Set up, but no snapshot has ever loaded (first moments, offline).
        case waiting
    }

    let date: Date
    let feed: ConWidgetFeed
    let state: State
    var relevance: TimelineEntryRelevance?
}

enum ConWidgetTimeline {
    static let horizonDays = 14

    /// The moments the widget needs a fresh face: now, every Singapore midnight for two weeks, any
    /// doors-open time, and (Lock Screen ring only) each hour of the last 48 before a con.
    static func dates(for feed: ConWidgetFeed, from now: Date, ringHours: Bool) -> [Date] {
        let today = ConWidgetDay(containing: now)
        let horizon = today.adding(horizonDays).start
        var dates = [now]
        for offset in 1...horizonDays { dates.append(today.adding(offset).start) }
        for event in feed.events {
            if let doors = event.opensAt, doors > now, doors < horizon { dates.append(doors) }
        }
        if ringHours, let next = feed.events.first(where: { $0.start > now }) {
            let left = next.start.timeIntervalSince(now)
            if left <= 48 * 3600 + 3600 {
                var hour = next.start.addingTimeInterval(-48 * 3600)
                while hour < next.start.addingTimeInterval(-3600) {
                    if hour > now { dates.append(hour) }
                    hour.addTimeInterval(3600)
                }
                // The last hour runs as a live mm:ss clock.
                dates.append(next.start.addingTimeInterval(-3600))
            }
        }
        return Array(Set(dates)).sorted()
    }

    static func entries(for feed: ConWidgetFeed, state: ConWidgetEntry.State, from now: Date, ringHours: Bool) -> [ConWidgetEntry] {
        guard state == .ready else { return [ConWidgetEntry(date: now, feed: feed, state: state)] }
        return dates(for: feed, from: now, ringHours: ringHours).map { date in
            ConWidgetEntry(date: date, feed: feed, state: state, relevance: relevance(feed, at: date))
        }
    }

    /// For Smart Stacks: up top while a con is on or about to start.
    static func relevance(_ feed: ConWidgetFeed, at date: Date) -> TimelineEntryRelevance {
        let moment = ConWidgetMoment(events: feed.events, at: date)
        let until = moment.today.adding(1).start.timeIntervalSince(date)
        switch moment.countdown {
        case .today?, .on?: return TimelineEntryRelevance(score: 100, duration: until)
        case .hours?: return TimelineEntryRelevance(score: 70, duration: until)
        case .days(let days)? where days <= 7: return TimelineEntryRelevance(score: 30, duration: until)
        default: return TimelineEntryRelevance(score: 5, duration: until)
        }
    }
}

struct ConWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> ConWidgetEntry {
        ConWidgetEntry(date: Date(), feed: .sample(Date()), state: .ready)
    }

    func getSnapshot(in context: Context, completion: @escaping (ConWidgetEntry) -> Void) {
        let now = Date()
        if context.isPreview {
            completion(ConWidgetEntry(date: now, feed: .sample(now), state: .ready))
            return
        }
        let (feed, state) = Self.current(now: now)
        completion(ConWidgetEntry(date: now, feed: feed, state: state))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ConWidgetEntry>) -> Void) {
        let family = context.family
        Task {
            // Refreshes the shared snapshot (one network fetch a minute at most, for all widgets).
            if KiriyaAPI.isSetUp { _ = await KiriyaAPI.freshSnapshot() }
            let now = Date()
            let (feed, state) = Self.current(now: now)
            let entries = ConWidgetTimeline.entries(for: feed, state: state, from: now, ringHours: family == .accessoryCircular)
            completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(60 * 60))))
        }
    }

    /// The cons from the snapshot the app and widgets keep in the App Group.
    static func current(now: Date) -> (ConWidgetFeed, ConWidgetEntry.State) {
        guard KiriyaAPI.isSetUp else { return (ConWidgetFeed(events: []), .notSetUp) }
        guard let text = KiriyaGroup.defaults?.string(forKey: KiriyaGroup.snapshot),
              let data = text.data(using: .utf8),
              let feed = ConWidgetFeed(snapshotJSON: data, now: now) else {
            return (ConWidgetFeed(events: []), .waiting)
        }
        return (feed, .ready)
    }
}

extension ConWidgetFeed {
    /// For the widget gallery: three real Singapore cons, placed around today.
    static func sample(_ now: Date) -> ConWidgetFeed {
        let today = ConWidgetDay(containing: now)
        func event(_ id: String, _ title: String, _ from: Int, _ days: Int, _ venue: String, _ tags: [String], hers: Bool) -> ConWidgetEvent {
            ConWidgetEvent(id: id, title: title, first: today.adding(from), last: today.adding(from + days - 1),
                           venue: venue, city: "Singapore", tags: tags, hers: hers, link: nil, opensAt: nil)
        }
        return ConWidgetFeed(events: [
            event("sample-afa", "AFA Singapore", 9, 3, "Suntec Singapore Convention & Exhibition Centre", ["anime", "cosplay", "music"], hers: true),
            event("sample-sgcc", "Singapore Comic Con", 16, 3, "Marina Bay Sands Expo & Convention Centre", ["comics", "cosplay", "pop culture"], hers: true),
            event("sample-doujin", "Doujin Market", 24, 2, "Hall 405, Suntec Singapore Convention & Exhibition Centre", ["doujin", "artist alley"], hers: false),
        ])
    }
}
