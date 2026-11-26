import SwiftUI
import WidgetKit

// The lab's widget extension: the real ConWidget (it shows "open kiriya.love once" here, as the lab
// has no App Group key) plus lab widgets that feed the same views and timeline with sample cons
// placed around the real clock. Built twice by ../sim.sh: normally, and with -D CON_DEMO as a
// second extension whose only widget stages a Singapore midnight 330 s into each ten-minute slot of
// the clock (it moves the day boundary for its whole process, so it lives in its own extension).

struct ConLabEntryProvider: TimelineProvider {
    let scenario: String

    private func feed(_ now: Date) -> ConWidgetFeed {
        #if CON_DEMO
        ConLabDemoWidgetClock.apply(now: now)
        return ConLabDemo.feed()
        #else
        return ConWidgetFeed(events: ConLab.live(scenario, now: now))
        #endif
    }

    func placeholder(in context: Context) -> ConWidgetEntry {
        ConWidgetEntry(date: Date(), feed: feed(Date()), state: .ready)
    }

    func getSnapshot(in context: Context, completion: @escaping (ConWidgetEntry) -> Void) {
        let now = Date()
        completion(ConWidgetEntry(date: now, feed: feed(now), state: .ready))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ConWidgetEntry>) -> Void) {
        let now = Date()
        let feed = feed(now)
        let entries = ConWidgetTimeline.entries(for: feed, state: .ready, from: now, ringHours: context.family == .accessoryCircular)
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

protocol ConLabKind { static var kind: String { get }; static var scenario: String { get } }
enum ConLabFar: ConLabKind { static let kind = "ConLabFar"; static let scenario = "far" }
enum ConLabNear: ConLabKind { static let kind = "ConLabNear"; static let scenario = "near" }
enum ConLabToday: ConLabKind { static let kind = "ConLabToday"; static let scenario = "today" }
enum ConLabOngoing: ConLabKind { static let kind = "ConLabOngoing"; static let scenario = "ongoing" }
enum ConLabEnded: ConLabKind { static let kind = "ConLabEnded"; static let scenario = "ended" }
enum ConLabNone: ConLabKind { static let kind = "ConLabNone"; static let scenario = "none" }
enum ConLabExhibition: ConLabKind { static let kind = "ConLabExhibition"; static let scenario = "exhibition" }
enum ConLabDemoKind: ConLabKind { static let kind = "ConLabDemo"; static let scenario = "demo" }

struct ConLabWidget<K: ConLabKind>: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: K.kind, provider: ConLabEntryProvider(scenario: K.scenario)) { entry in
            ConWidgetView(entry: entry)
        }
        .configurationDisplayName("Con lab · " + K.scenario)
        .description("Sample cons around today.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular, .accessoryInline])
        .contentMarginsDisabled()
    }
}

#if CON_DEMO
/// The demo's staged midnight: 330 s into the current ten-minute slot of the real clock, so every
/// process of this extension (WidgetKit renders entries in fresh processes too) agrees on it
/// without sharing anything. tools/demo.sh lines the recording up with it.
enum ConLabDemoWidgetClock {
    static let slot: TimeInterval = 600
    static let into: TimeInterval = 330

    static func apply(now: Date) {
        let start = (now.timeIntervalSince1970 / slot).rounded(.down) * slot
        ConLabDemo.stage(at: Date(timeIntervalSince1970: start + into))
    }
}

@main
struct ConLabDemoBundle: WidgetBundle {
    init() { ConWidgetFonts.searchDirectories = [Bundle.main.bundleURL]; ConLabDemoWidgetClock.apply(now: Date()) }
    var body: some Widget {
        ConLabWidget<ConLabDemoKind>()
    }
}
#else
@main
struct ConLabBundle: WidgetBundle {
    init() { ConWidgetFonts.searchDirectories = [Bundle.main.bundleURL] }
    var body: some Widget {
        ConWidget()
        ConLabWidget<ConLabFar>()
        ConLabWidget<ConLabNear>()
        ConLabWidget<ConLabToday>()
        ConLabWidget<ConLabOngoing>()
        ConLabWidget<ConLabEnded>()
        ConLabWidget<ConLabNone>()
        ConLabWidget<ConLabExhibition>()
    }
}
#endif
