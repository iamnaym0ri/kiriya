import SwiftUI
import WidgetKit

// The "Little note" widget: the newest little note from Josh, passed to her and taped down on her
// Home Screen. Small, medium and large on the Home Screen (and StandBy), rectangular on the Lock
// Screen. On Josh's phone it shows his last note to her, stamped "she opened it ♡" once she has.
//
// Target membership: KiriyaWidgets (this folder, its Fonts/, ../../KiriyaShared/*.swift).
// NotesWidgetMailbox.swift also goes into KiriyaNotificationService, which hands every NOTE push's
// words to the widget the moment it lands (see the integration notes in ios/CardLab/WidgetNotes).

struct NotesWidget: Widget {
    var body: some WidgetConfiguration {
        // iOS 26 can also wake it with a WidgetKit push (NotesWidgetPush.swift); before that, the
        // notification service extension and the timeline do it.
        if #available(iOS 26.0, *) {
            return base.pushHandler(NotesWidgetPushHandler.self)
        } else {
            return base
        }
    }

    private var base: some WidgetConfiguration {
        StaticConfiguration(kind: NotesWidgetMailbox.kind, provider: NotesWidgetProvider()) { entry in
            NotesWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Little note")
        .description("The newest little note, passed to you and taped right here.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
        // The paper comes nearly to the edges; the widget keeps its own small margins.
        .contentMarginsDisabled()
    }
}

struct NotesWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var renderingMode
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.showsWidgetContainerBackground) private var showsBackground

    let entry: NotesWidgetEntry

    var body: some View {
        GeometryReader { proxy in
            NotesWidgetCanvas(entry: entry, look: look(proxy.size))
        }
        .widgetURL(link)
        .containerBackground(for: .widget) {
            if family == .accessoryRectangular {
                Color.clear
            } else {
                NotesWidgetDesk(dark: colorScheme == .dark)
            }
        }
    }

    private func look(_ size: CGSize) -> NotesWidgetLook {
        let kind: NotesWidgetLook.Size
        switch family {
        case .systemSmall: kind = .small
        case .systemLarge, .systemExtraLarge: kind = .large
        case .accessoryRectangular, .accessoryCircular, .accessoryInline: kind = .rectangular
        default: kind = .medium
        }
        return NotesWidgetLook(size: kind, tinted: renderingMode != .fullColor, dark: colorScheme == .dark,
                               background: showsBackground, canvas: size)
    }

    /// The note itself (or the letter / doodle it's about); the notes page otherwise.
    private var link: URL? {
        entry.scene.note?.link ?? URL(string: "kiriyalove://open/world/notes")
    }
}
