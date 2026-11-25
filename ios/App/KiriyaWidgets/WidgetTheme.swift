import SwiftUI
import WidgetKit

// The site's lilac look, for widgets: soft lilac paper, plum ink, a red heart.
enum KiriyaTheme {
    static let paper = Color(red: 1.0, green: 0.969, blue: 0.984)        // #fff7fb
    static let lilac = Color(red: 0.937, green: 0.898, blue: 0.965)      // #efe5f6
    static let lilacDeep = Color(red: 0.851, green: 0.776, blue: 0.925)  // #d9c6ec
    static let lid = Color(red: 0.706, green: 0.541, blue: 0.816)        // #b48ad0
    static let plum = Color(red: 0.306, green: 0.184, blue: 0.388)       // #4e2f63
    static let soft = Color(red: 0.541, green: 0.416, blue: 0.639)       // #8a6aa3
    static let heart = Color(red: 0.886, green: 0.267, blue: 0.361)      // #e2445c

    static let noteColors: [Color] = [
        Color(red: 1.0, green: 0.957, blue: 0.788),  // #fff4c9
        Color(red: 1.0, green: 0.851, blue: 0.902),  // #ffd9e6
        Color(red: 0.875, green: 0.953, blue: 1.0),  // #dff3ff
        Color(red: 0.914, green: 1.0, blue: 0.894),  // #e9ffe4
    ]

    static var background: some View {
        LinearGradient(colors: [paper, lilac, lilacDeep], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    static func rounded(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }

    /// The little "kiriya ✦" mark in a corner.
    static var mark: some View {
        Text("kiriya ✦")
            .font(.system(size: 11, weight: .semibold, design: .serif).italic())
            .foregroundStyle(soft)
    }
}

extension View {
    /// Lilac paper on the Home Screen; the system's own look on the Lock Screen.
    @ViewBuilder
    func kiriyaContainer(_ family: WidgetFamily) -> some View {
        switch family {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            containerBackground(for: .widget) { Color.clear }
        default:
            containerBackground(for: .widget) { KiriyaTheme.background }
        }
    }
}

/// "in 3 days" / "tomorrow" / "today ♡", counted in Singapore time from the entry's date.
enum KiriyaDates {
    static func daysAway(_ event: KiriyaSnapshot.Event?, from date: Date) -> Int? {
        guard let event else { return nil }
        if let day = event.startsOn, let start = parse(day) {
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = singapore
            let from = calendar.startOfDay(for: date)
            return max(0, calendar.dateComponents([.day], from: from, to: start).day ?? 0)
        }
        return event.daysAway.map { max(0, $0) }
    }

    static func phrase(_ days: Int) -> String {
        switch days {
        case 0: return "today ♡"
        case 1: return "tomorrow"
        default: return "in \(days) days"
        }
    }

    static func pretty(_ day: String?) -> String? {
        guard let day, let date = parse(day) else { return nil }
        let format = DateFormatter()
        format.timeZone = singapore
        format.locale = Locale(identifier: "en_SG")
        format.dateFormat = "EEE d MMM"
        return format.string(from: date)
    }

    private static let singapore = TimeZone(identifier: "Asia/Singapore") ?? .current

    private static func parse(_ day: String) -> Date? {
        let format = DateFormatter()
        format.calendar = Calendar(identifier: .gregorian)
        format.timeZone = singapore
        format.locale = Locale(identifier: "en_US_POSIX")
        format.dateFormat = "yyyy-MM-dd"
        return format.date(from: String(day.prefix(10)))
    }
}
