import SwiftUI
import WidgetKit

// kiriya.love's Home Screen and Lock Screen widgets (docs/refactor/MAC-BUILD.md).
// Target membership: KiriyaWidgets, plus ../KiriyaShared/*.swift.

@main
struct KiriyaWidgetsBundle: WidgetBundle {
    var body: some Widget {
        LittleNoteWidget()
        NoteJarWidget()
        ThinkingOfYouWidget()
        NextConWidget()
    }
}

struct LittleNoteWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LittleNoteWidget", provider: KiriyaProvider()) { entry in
            LittleNoteView(entry: entry)
        }
        .configurationDisplayName("Little note")
        .description("The newest little note, right on your Home Screen.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
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

struct ThinkingOfYouWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ThinkingOfYouWidget", provider: KiriyaProvider()) { entry in
            ThinkingOfYouView(entry: entry)
        }
        .configurationDisplayName("Thinking of you")
        .description("Send a ♡, a hug or a kiss without opening the app.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular])
    }
}

struct NextConWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextConWidget", provider: KiriyaProvider()) { entry in
            NextConView(entry: entry)
        }
        .configurationDisplayName("Next con")
        .description("Counting down to the next con or pop-up.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
