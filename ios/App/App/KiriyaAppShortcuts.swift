import AppIntents

// Siri and the Shortcuts app: "Send a heart with kiriya.love". App target only (one
// AppShortcutsProvider per app; the widget extension shares the intent, not the phrases).
// Every phrase has to contain the app's name; INAlternativeAppNames in Info.plist adds "kiriya".
struct KiriyaAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: SendTapIntent(),
            phrases: [
                "Send a heart with \(.applicationName)",
                "Send a \(\.$tap) with \(.applicationName)",
                "Tell \(.applicationName) I’m thinking of you",
            ],
            shortTitle: "Send a ♡",
            systemImageName: "heart.fill"
        )
    }
}
