import AppIntents
import WidgetKit

// "Peel the tape": tapping a sealed note on the widget opens it right there on the Home Screen.
// It runs in the widget extension (no app launch): the note is marked opened on this phone first,
// so the widget can unfold it straight away, then the server hears about it, exactly as when she
// opens a note inside its notification (POST /api/widget/notes/:id/open, via KiriyaAPI).
// Target membership: KiriyaWidgets only.

struct NotesWidgetPeelIntent: AppIntent {
    static let title: LocalizedStringResource = "Open the little note"
    static let description = IntentDescription("Peels the tape off a new little note so it opens right on the widget.")
    /// Only ever started from the widget's own button.
    static let isDiscoverable = false

    @Parameter(title: "Note")
    var noteID: String

    init() {}

    init(noteID: String) {
        self.noteID = noteID
    }

    func perform() async throws -> some IntentResult {
        let id = noteID.trimmingCharacters(in: .whitespaces)
        guard !id.isEmpty else { return .result() }
        // The widget reloads by itself once this returns; marking first means it unfolds even offline.
        NotesWidgetMailbox.markOpened(id, reload: false)
        // Counted as opened (the badge, the app's list), as in the notification. The widget waits
        // for this before it unfolds, so it gets a second and a half; if the network is slower, the
        // next timeline tells the server instead (NotesWidgetProvider.catchUpOpened).
        await withTaskGroup(of: Void.self) { group in
            group.addTask { try? await KiriyaAPI.openNote(id) }
            group.addTask { try? await Task.sleep(nanoseconds: 1_500_000_000) }
            _ = await group.next()
            group.cancelAll()
        }
        return .result()
    }
}
