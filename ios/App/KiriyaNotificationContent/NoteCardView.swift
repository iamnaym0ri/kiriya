import SwiftUI
import UserNotifications
import WidgetKit

// What the content extension draws: a sealed envelope that opens into the note (Letter/), or the
// jar a note comes out of (Jar/). Both cards draw the site's lilac look themselves; this file holds
// what they share: the notification's state, its buttons, and the card's height for the host.

@MainActor
final class NoteCardModel: ObservableObject {
    enum Kind { case note, jar }
    enum Stage: Equatable { case sealed, open, pulling, pulled, failed(String) }
    enum Heart { case idle, sending, sent, failed }

    @Published var kind: Kind = .note
    @Published var stage: Stage = .sealed
    @Published var heading = ""
    @Published var noteTitle: String?
    @Published var text = ""
    @Published var byline = ""
    @Published var label: String?
    @Published var truncated = false
    @Published var preview = false
    @Published var heart: Heart = .idle

    var openInApp: () -> Void = {}
    /// The card's natural height, for the notification's size (NotificationViewController).
    var reportHeight: (CGFloat) -> Void = { _ in }
    var setActions: ([UNNotificationAction]) -> Void = { _ in }
    private var noteId: String?

    func load(_ notification: UNNotification) {
        let content = notification.request.content
        let info = content.userInfo
        let kindName = info["kind"] as? String
        kind = (kindName == "jar" || kindName == "reminder") ? .jar : .note
        heading = content.title
        if let note = info["note"] as? [String: Any] {
            noteId = note["id"] as? String
            noteTitle = (note["title"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            text = (note["text"] as? String) ?? content.body
            if let from = note["from"] as? String, !from.isEmpty { byline = "— \(from)" }
            truncated = (note["truncated"] as? Bool) ?? false
        } else {
            // A push without the whole note (an older server): the preview is all there is.
            text = content.body
            truncated = kind == .note
        }
        stage = .sealed
        // iOS keeps a notification's changed buttons, so a card shown again starts from the full set.
        setActions(kind == .note
            ? [NotificationButtons.openNote, NotificationButtons.heart, NotificationButtons.openApp]
            : [NotificationButtons.pull(again: false), NotificationButtons.openApp])
    }

    func openEnvelope() {
        guard kind == .note, stage == .sealed else { return }
        withAnimation(.spring(response: 0.55, dampingFraction: 0.78)) { stage = .open }
        setActions([NotificationButtons.heart, NotificationButtons.openApp])
        if let noteId {
            Task {
                try? await KiriyaAPI.openNote(noteId)
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }

    func pull() {
        guard kind == .jar, stage != .pulling else { return }
        guard KiriyaAPI.isSetUp else {
            stage = .failed("open kiriya.love once, then the jar opens from here ❤️")
            return
        }
        withAnimation(.easeInOut(duration: 0.25)) { stage = .pulling }
        Task {
            do {
                let pulled = try await KiriyaAPI.pullJar()
                text = pulled.note.text
                byline = pulled.note.byline ?? ""
                label = pulled.note.label
                preview = pulled.preview ?? false
                withAnimation(.spring(response: 0.55, dampingFraction: 0.78)) { stage = .pulled }
                setActions([NotificationButtons.pull(again: true), NotificationButtons.openApp])
                WidgetCenter.shared.reloadAllTimelines()
            } catch KiriyaAPIError.badResponse(404) {
                // Every note has been pulled (the server's "jar_empty"); new ones come in the morning.
                withAnimation { stage = .failed("the jar is waiting for new notes ❤️") }
            } catch KiriyaAPIError.badResponse(401) {
                withAnimation { stage = .failed("open kiriya.love once, then the jar opens from here ❤️") }
            } catch {
                withAnimation { stage = .failed("the jar got a little stuck. try again?") }
            }
        }
    }

    func sendHeart(notificationId: String) {
        guard heart != .sending, heart != .sent else { return }
        guard KiriyaAPI.isSetUp else {
            heart = .failed
            return
        }
        withAnimation { heart = .sending }
        // The same id the app's own "send one back" uses, so a retry can never send twice.
        let clientId = KiriyaAPI.clientId("n", notificationId, "heart")
        Task {
            do {
                try await KiriyaAPI.sendTap("thinking", clientId: clientId)
                KiriyaStore.markTapSent("thinking")
                WidgetCenter.shared.reloadAllTimelines()
                withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) { heart = .sent }
            } catch {
                withAnimation { heart = .failed }
            }
        }
    }
}

/// The buttons under the card once it has changed. The first set comes from the app's categories
/// (ios/App/App/KiriyaNotifications.swift): an icon, the words, then a colour emoji (so the heart is red).
enum NotificationButtons {
    static let openNote = UNNotificationAction(identifier: KiriyaNotificationActions.openHere, title: "Open note 💌", options: [],
                                               icon: UNNotificationActionIcon(systemImageName: "envelope.open"))
    static let heart = UNNotificationAction(identifier: KiriyaNotificationActions.heart, title: "Send one back ❤️", options: [],
                                            icon: UNNotificationActionIcon(systemImageName: "heart.fill"))
    static let openApp = UNNotificationAction(identifier: KiriyaNotificationActions.openApp, title: "Open in app", options: [.foreground],
                                              icon: UNNotificationActionIcon(systemImageName: "arrow.up.forward.app"))
    static func pull(again: Bool) -> UNNotificationAction {
        UNNotificationAction(identifier: KiriyaNotificationActions.pull, title: again ? "Pull another ✨" : "Pull one ✨", options: [],
                             icon: UNNotificationActionIcon(systemImageName: "sparkles"))
    }
}

// MARK: - The card

struct NoteCardView: View {
    @ObservedObject var model: NoteCardModel

    var body: some View {
        Group {
            switch model.kind {
            case .note: letter
            case .jar: jar
            }
        }
        .frame(maxWidth: .infinity)
        .fixedSize(horizontal: false, vertical: true)
        .background(GeometryReader { proxy in Color.clear.preference(key: CardHeight.self, value: proxy.size.height) })
        .onPreferenceChange(CardHeight.self) { height in model.reportHeight(height) }
        .frame(maxHeight: .infinity, alignment: .top)
        .background(LetterPalette.background)
    }

    // MARK: a little note

    /// The sealed envelope that opens into the note (Letter/LetterCard.swift). It draws its own
    /// background and margins; a small strip under it says how "Send one back" went.
    private static let statusHeight: CGFloat = 40

    private var letter: some View {
        VStack(spacing: 0) {
            LetterCard(content: LetterContent(heading: model.heading, title: model.noteTitle, text: model.text,
                                              byline: model.byline, truncated: model.truncated),
                       isOpen: model.stage == .open,
                       onTapSealed: { model.openEnvelope() },
                       maxHeight: 720 - Self.statusHeight)
            if model.heart != .idle {
                heartStatus
                    .frame(maxWidth: .infinity)
                    .frame(height: Self.statusHeight)
                    .transition(.opacity)
            }
        }
    }

    @ViewBuilder private var heartStatus: some View {
        switch model.heart {
        case .idle: EmptyView()
        case .sending: status("sending your ❤️…", LetterPalette.softInk)
        case .sent: status("sent ❤️", LetterPalette.heart)
        case .failed: status("that didn’t send. try again?", LetterPalette.heart)
        }
    }

    private func status(_ text: String, _ color: Color) -> some View {
        Text(text)
            .font(.system(size: 14, weight: .bold, design: .rounded))
            .foregroundStyle(color)
    }

    // MARK: the jar

    /// The app's note jar (Jar/JarCard.swift): it waits with its count, wiggles while the server
    /// picks a note, then gives the note up. It draws its own heading, captions and background.
    private var jar: some View {
        JarCard(heading: model.heading,
                newCount: JarCard.newCount(fromTitle: model.heading),
                state: jarState,
                onPull: { model.pull() })
    }

    private var jarState: JarCardState {
        switch model.stage {
        case .pulling: return .pulling
        case .pulled:
            return .pulled(JarPulledNote(text: model.text, byline: model.byline, label: model.label, isPreview: model.preview))
        case .failed(let message): return .failed(message)
        case .sealed, .open: return .waiting
        }
    }
}

/// The card's natural height (see NoteCardView.body).
struct CardHeight: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}
