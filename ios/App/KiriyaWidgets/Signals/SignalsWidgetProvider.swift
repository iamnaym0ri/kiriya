import WidgetKit

// The widget's timeline. It needs nothing from the network: the signals are fixed, Josh's name comes
// from the last snapshot the app saved, and the only thing that changes is the moment after a tap.
// So a reload after a button press is instant, and the "sent ♡" moment appears as soon as the request
// has gone. After a send there are two entries: the moment now, and the plain widget once it's over.

struct SignalsWidgetEntry: TimelineEntry {
    var date: Date
    /// Her picks, in order (always four, no repeats); the layouts take what they need.
    var signals: [SignalsWidgetSignal]
    var smallStyle: SignalsWidgetSmallStyle
    /// "Josh" on her phone, "Kiriya" on his.
    var otherName: String
    var isSetUp: Bool
    var moment: SignalsWidgetMoment?

    static func sample(_ date: Date = Date(), smallStyle: SignalsWidgetSmallStyle = .four,
                       signals: [SignalsWidgetSignal] = SignalsWidgetSignal.defaults,
                       moment: SignalsWidgetMoment? = nil, isSetUp: Bool = true, otherName: String = "Josh") -> SignalsWidgetEntry {
        SignalsWidgetEntry(date: date, signals: signals.signalsWidgetUnique(4), smallStyle: smallStyle,
                           otherName: otherName, isSetUp: isSetUp, moment: moment)
    }
}

struct SignalsWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> SignalsWidgetEntry {
        .sample()
    }

    func snapshot(for configuration: SignalsWidgetConfigurationIntent, in context: Context) async -> SignalsWidgetEntry {
        // The gallery always shows the widget as she'll see it once it's set up.
        if context.isPreview {
            return .sample(smallStyle: configuration.smallStyle, signals: configuration.signals, otherName: Self.otherName())
        }
        return entry(for: configuration, at: Date(), moment: SignalsWidgetMemory.moment())
    }

    func timeline(for configuration: SignalsWidgetConfigurationIntent, in context: Context) async -> Timeline<SignalsWidgetEntry> {
        let now = Date()
        var entries = [entry(for: configuration, at: now, moment: SignalsWidgetMemory.moment(now: now))]
        if let moment = entries[0].moment {
            entries.append(entry(for: configuration, at: max(now, moment.endsAt), moment: nil))
        }
        // Nothing changes on its own. The app reloads every widget when it hands over the key, and a
        // button press always reloads; the daily refresh just keeps the name fresh.
        let next = KiriyaAPI.isSetUp ? now.addingTimeInterval(24 * 3600) : now.addingTimeInterval(30 * 60)
        return Timeline(entries: entries, policy: .after(next))
    }

    private func entry(for configuration: SignalsWidgetConfigurationIntent, at date: Date, moment: SignalsWidgetMoment?) -> SignalsWidgetEntry {
        SignalsWidgetEntry(date: date, signals: configuration.signals, smallStyle: configuration.smallStyle,
                           otherName: Self.otherName(), isSetUp: KiriyaAPI.isSetUp, moment: moment)
    }

    static func otherName() -> String {
        if let snapshot = KiriyaAPI.cachedSnapshot() { return snapshot.otherName }
        return KiriyaGroup.defaults?.string(forKey: KiriyaGroup.role) == "admin" ? "Kiriya" : "Josh"
    }
}
