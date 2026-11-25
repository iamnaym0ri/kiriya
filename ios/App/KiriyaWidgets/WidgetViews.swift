import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Little note: the newest note from him (from her, on his phone).

struct LittleNoteView: View {
    @Environment(\.widgetFamily) private var family
    let entry: KiriyaEntry

    private var note: KiriyaSnapshot.Note? { entry.snapshot.latestNote }
    private var unopened: Bool { note.map { $0.opened != true } ?? false }
    private var from: String { "from \(entry.snapshot.otherName)" }

    var body: some View {
        content
            .widgetURL(KiriyaLink.url(entry.snapshot.links?.notes, fallback: "/world/notes"))
            .kiriyaContainer(family)
    }

    @ViewBuilder
    private var content: some View {
        if family == .accessoryRectangular {
            VStack(alignment: .leading, spacing: 1) {
                Label(from, systemImage: unopened ? "envelope.fill" : "envelope.open")
                    .font(.headline)
                    .widgetAccentable()
                Text(note?.preview ?? note?.title ?? "no notes yet ♡")
                    .font(.caption)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if !entry.isSetUp {
            OpenTheAppFirst()
        } else {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: unopened ? "envelope.fill" : "envelope.open.fill")
                        .foregroundStyle(unopened ? KiriyaTheme.heart : KiriyaTheme.soft)
                    Text(unopened ? "a new note ♡" : from)
                        .font(KiriyaTheme.rounded(12, .semibold))
                        .foregroundStyle(KiriyaTheme.soft)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
                if let note {
                    Text(note.title ?? "a little note")
                        .font(KiriyaTheme.rounded(family == .systemSmall ? 15 : 17, .bold))
                        .foregroundStyle(KiriyaTheme.plum)
                        .lineLimit(2)
                    Text(note.preview ?? "")
                        .font(KiriyaTheme.rounded(13))
                        .foregroundStyle(KiriyaTheme.plum.opacity(0.85))
                        .lineLimit(family == .systemSmall ? 3 : 4)
                } else {
                    Text("no notes yet ♡")
                        .font(KiriyaTheme.rounded(15, .bold))
                        .foregroundStyle(KiriyaTheme.plum)
                    Text("they’ll show up right here.")
                        .font(KiriyaTheme.rounded(13))
                        .foregroundStyle(KiriyaTheme.soft)
                }
                Spacer(minLength: 0)
                KiriyaTheme.mark
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

// MARK: - Note jar: a jar with a red heart while new notes wait.

struct JarDrawing: View {
    let fresh: Int
    private static let tilts: [Double] = [-14, 9, -6, 12]

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(spacing: 0) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(KiriyaTheme.lid)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(KiriyaTheme.plum, lineWidth: 2))
                    .frame(width: 40, height: 10)
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(0.6))
                    .overlay(alignment: .bottom) {
                        HStack(spacing: -4) {
                            ForEach(0..<4, id: \.self) { index in
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(KiriyaTheme.noteColors[index])
                                    .overlay(RoundedRectangle(cornerRadius: 3).stroke(KiriyaTheme.plum, lineWidth: 1))
                                    .frame(width: 18, height: 13)
                                    .rotationEffect(.degrees(Self.tilts[index]))
                            }
                        }
                        .padding(.bottom, 9)
                    }
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(KiriyaTheme.plum, lineWidth: 2.5))
                    .frame(width: 66, height: 64)
            }
            if fresh > 0 {
                ZStack {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(KiriyaTheme.heart)
                    Text("\(min(fresh, 9))")
                        .font(KiriyaTheme.rounded(13, .heavy))
                        .foregroundStyle(.white)
                        .offset(y: -1)
                }
                .offset(x: 16, y: -8)
            }
        }
    }
}

struct NoteJarView: View {
    @Environment(\.widgetFamily) private var family
    let entry: KiriyaEntry

    private var fresh: Int { entry.snapshot.jar?.fresh ?? 0 }
    private var line: String {
        guard fresh > 0 else { return "pull a little note" }
        return fresh == 1 ? "1 new note ♡" : "\(fresh) new notes ♡"
    }

    var body: some View {
        Group {
            if !entry.isSetUp {
                OpenTheAppFirst()
            } else {
                VStack(spacing: 8) {
                    JarDrawing(fresh: fresh)
                        .frame(maxHeight: .infinity)
                    Text(line)
                        .font(KiriyaTheme.rounded(13, .semibold))
                        .foregroundStyle(KiriyaTheme.plum)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
        }
        .widgetURL(KiriyaLink.url(entry.snapshot.links?.jar, fallback: "/world#note-jar"))
        .kiriyaContainer(family)
    }
}

// MARK: - Thinking of you: buttons that send a tap without opening the app (iOS 17).

struct TapButton: View {
    let tap: TapKind
    var size: CGFloat = 26

    var body: some View {
        Button(intent: SendTapIntent(tap: tap)) {
            Text(tap.emoji)
                .font(.system(size: size))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.white.opacity(0.6)))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(KiriyaTheme.lilacDeep, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("Send \(tap.label)"))
    }
}

struct ThinkingOfYouView: View {
    @Environment(\.widgetFamily) private var family
    let entry: KiriyaEntry

    private let taps: [TapKind] = [.thinking, .hug, .kiss, .miss]

    private var header: String {
        if let sent = entry.sentTap { return "sent \(sent)" }
        return "to \(entry.snapshot.otherName)"
    }

    var body: some View {
        content
            .widgetURL(KiriyaLink.url(entry.snapshot.links?.chat, fallback: "/world/chat"))
            .kiriyaContainer(family)
    }

    @ViewBuilder
    private var content: some View {
        if family == .accessoryCircular {
            Button(intent: SendTapIntent(tap: .thinking)) {
                ZStack {
                    AccessoryWidgetBackground()
                    Image(systemName: entry.sentTap == nil ? "heart.fill" : "checkmark.circle.fill")
                        .font(.system(size: 22, weight: .semibold))
                        .widgetAccentable()
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text("Send a heart"))
        } else if !entry.isSetUp {
            OpenTheAppFirst()
        } else if family == .systemMedium {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(header)
                        .font(KiriyaTheme.rounded(14, .bold))
                        .foregroundStyle(entry.sentTap == nil ? KiriyaTheme.plum : KiriyaTheme.heart)
                        .invalidatableContent()
                    Spacer()
                    KiriyaTheme.mark
                }
                HStack(spacing: 8) {
                    ForEach(taps, id: \.self) { tap in TapButton(tap: tap, size: 30) }
                }
            }
        } else {
            VStack(spacing: 6) {
                Text(header)
                    .font(KiriyaTheme.rounded(12, .bold))
                    .foregroundStyle(entry.sentTap == nil ? KiriyaTheme.plum : KiriyaTheme.heart)
                    .lineLimit(1)
                    .invalidatableContent()
                Grid(horizontalSpacing: 6, verticalSpacing: 6) {
                    GridRow { TapButton(tap: taps[0]); TapButton(tap: taps[1]) }
                    GridRow { TapButton(tap: taps[2]); TapButton(tap: taps[3]) }
                }
            }
        }
    }
}

// MARK: - Next con: a countdown to the next event she's going to love.

struct NextConView: View {
    @Environment(\.widgetFamily) private var family
    let entry: KiriyaEntry

    private var event: KiriyaSnapshot.Event? { entry.snapshot.nextEvent }

    var body: some View {
        content
            .widgetURL(KiriyaLink.url(entry.snapshot.links?.events, fallback: "/world#events"))
            .kiriyaContainer(family)
    }

    @ViewBuilder
    private var content: some View {
        if !entry.isSetUp {
            OpenTheAppFirst()
        } else if let event, let days = KiriyaDates.daysAway(event, from: entry.date) {
            VStack(alignment: .leading, spacing: 4) {
                Label("next con", systemImage: "sparkles")
                    .font(KiriyaTheme.rounded(12, .semibold))
                    .foregroundStyle(KiriyaTheme.soft)
                Text(days == 0 ? "today ♡" : String(days))
                    .font(KiriyaTheme.rounded(days == 0 ? 26 : 38, .heavy))
                    .foregroundStyle(KiriyaTheme.plum)
                    .contentTransition(.numericText())
                if days > 0 {
                    Text(days == 1 ? "day to go" : "days to go")
                        .font(KiriyaTheme.rounded(12, .semibold))
                        .foregroundStyle(KiriyaTheme.soft)
                }
                Spacer(minLength: 0)
                Text(event.title ?? "something lovely")
                    .font(KiriyaTheme.rounded(13, .bold))
                    .foregroundStyle(KiriyaTheme.plum)
                    .lineLimit(family == .systemSmall ? 2 : 1)
                if family != .systemSmall {
                    Text([KiriyaDates.pretty(event.startsOn), event.venue].compactMap { $0 }.joined(separator: " · "))
                        .font(KiriyaTheme.rounded(12))
                        .foregroundStyle(KiriyaTheme.soft)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Label("next con", systemImage: "sparkles")
                    .font(KiriyaTheme.rounded(12, .semibold))
                    .foregroundStyle(KiriyaTheme.soft)
                Spacer(minLength: 0)
                Text("nothing on the calendar yet")
                    .font(KiriyaTheme.rounded(14, .bold))
                    .foregroundStyle(KiriyaTheme.plum)
                Text("I’ll keep watch ✦")
                    .font(KiriyaTheme.rounded(12))
                    .foregroundStyle(KiriyaTheme.soft)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

// MARK: - Before the app has handed the widgets their key.

struct OpenTheAppFirst: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "heart.fill").foregroundStyle(KiriyaTheme.heart)
            Text("open kiriya.love once ♡")
                .font(KiriyaTheme.rounded(14, .bold))
                .foregroundStyle(KiriyaTheme.plum)
            Text("then this fills itself in.")
                .font(KiriyaTheme.rounded(12))
                .foregroundStyle(KiriyaTheme.soft)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
