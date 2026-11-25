import AppIntents
import WidgetKit

// "Thinking of you" without opening the app: the Home Screen and Lock Screen widget buttons and
// Siri / Shortcuts all run this intent. Target membership: App and KiriyaWidgets (Apple: an intent
// used by an interactive widget belongs to both; it runs in whichever process asked for it).
// The Siri phrases live in the App target only (KiriyaAppShortcuts.swift).

enum TapKind: String, AppEnum {
    case thinking, hug, kiss, morning, night, miss, water

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Little tap"
    static var caseDisplayRepresentations: [TapKind: DisplayRepresentation] = [
        .thinking: "♡ thinking of you",
        .hug: "🫂 a hug",
        .kiss: "😘 a kiss",
        .morning: "☀️ good morning",
        .night: "🌙 goodnight",
        .miss: "🥺 miss you",
        .water: "💧 drink some water",
    ]

    var emoji: String { TapCatalog.emoji(for: rawValue) }
    var label: String { TapCatalog.all.first { $0.key == rawValue }?.label ?? "a tap" }
}

struct SendTapIntent: AppIntent {
    static var title: LocalizedStringResource = "Send a little tap"
    static var description = IntentDescription("Sends a ♡, a hug or a kiss on kiriya.love without opening the app.")

    @Parameter(title: "Tap", default: .thinking)
    var tap: TapKind

    init() {}

    init(tap: TapKind) {
        self.tap = tap
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard KiriyaAPI.isSetUp else {
            return .result(dialog: "Open kiriya.love once, then this works from anywhere ♡")
        }
        do {
            // Each press is its own message, so the id is fresh every time.
            try await KiriyaAPI.sendTap(tap.rawValue, clientId: KiriyaAPI.clientId("w", UUID().uuidString, tap.rawValue))
            KiriyaStore.markTapSent(tap.rawValue)
            // Widgets reload by themselves after a button press; Siri needs the nudge.
            WidgetCenter.shared.reloadAllTimelines()
            return .result(dialog: "Sent \(tap.emoji)")
        } catch {
            return .result(dialog: "That didn’t send. Try again in a moment?")
        }
    }
}
