import SwiftUI
import WidgetKit

// kiriya.love's Home Screen and Lock Screen widgets (docs/refactor/MAC-BUILD.md).
// Target membership: KiriyaWidgets, plus ../KiriyaShared/*.swift. The little note is Notes/NotesWidget.swift
// (same kind, "LittleNoteWidget", so a widget already placed carries on as the new one), and the next
// con is Con/ConWidget.swift (kind "NextConWidget"), and thinking of you is Signals/ (kind "ThinkingOfYouWidget").

@main
struct KiriyaWidgetsBundle: WidgetBundle {
    var body: some Widget {
        NotesWidget()
        NoteJarWidget()
        SignalsWidget()
        ConWidget()
    }
}

struct NoteJarWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NoteJarWidget", provider: KiriyaProvider()) { entry in
            NoteJarView(entry: entry)
        }
        .configurationDisplayName("Note jar")
        .description("A red heart on the jar when new notes are waiting.")
        .supportedFamilies([.systemSmall])
    }
}
