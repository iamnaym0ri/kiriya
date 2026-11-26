import SwiftUI
import UserNotifications
import WidgetKit

// What the content extension draws: a sealed envelope that opens into the note (Letter/), the
// wax-sealed letter (FormalLetter/), or the jar a note comes out of (Jar/). Each card draws its own
// look; this file holds what they share: the notification's state, its buttons, and the card's
// height for the host.

@MainActor
final class NoteCardModel: ObservableObject {
    enum Kind { case note, letter, jar }
    enum Stage: Equatable { case sealed, open, pulling, pulled, failed(String) }
    enum Heart { case idle, sending, sent, failed }

    /// A letter, as its push carries it (server/push/apns.js letterPayload). A long one arrives
    /// trimmed (`truncated`) and is fetched whole as soon as the card shows.
    struct LetterDetails: Equatable {
        var id: String?
        var title: String
        var text: String
        var from: String
        var kind: String?
        var openWhen: String?
        var date: Date?
        var lockedUntil: Date?
        var truncated: Bool

        var isLocked: Bool { (lockedUntil ?? .distantPast) > Date() }
    }

    @Published var kind: Kind = .note
    @Published var stage: Stage = .sealed
    @Published var heading = ""
    @Published var noteTitle: String?
    @Published var text = ""
    @Published var byline = ""
    @Published var label: String?
    @Published var truncated = false
    @Published var preview = false
    @Published var letter: LetterDetails?
    @Published var heart: Heart = .idle

    var openInApp: () -> Void = {}
    /// The card's natural height, for the notification's size (NotificationViewController).
    var reportHeight: (CGFloat) -> Void = { _ in }
    var setActions: ([UNNotificationAction]) -> Void = { _ in }
    private var noteId: String?

    func load(_ notification: UNNotification) {
        let content = notification.request.content
        let info = content.userInfo
        switch info["kind"] as? String {
        case "jar", "reminder": kind = .jar
        case "letter": kind = .letter
        default: kind = .note
        }
        heading = content.title
        if kind == .letter {
            letter = Self.letter(from: info["letter"] as? [String: Any], body: content.body)
        } else if let note = info["note"] as? [String: Any] {
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
        Self.warmServices()
        // iOS keeps a notification's changed buttons, so a card shown again starts from the full set.
        switch kind {
        case .note: setActions([NotificationButtons.openNote, NotificationButtons.heart, NotificationButtons.openApp])
        case .letter:
            setActions(letter?.isLocked == true
                ? [NotificationButtons.heart, NotificationButtons.openApp]
                : [NotificationButtons.openLetter, NotificationButtons.heart, NotificationButtons.openApp])
            fetchWholeLetter()
        case .jar: setActions([NotificationButtons.pull(again: false), NotificationButtons.openApp])
        }
    }

    func openEnvelope() {
        guard kind != .jar, stage == .sealed else { return }
        if kind == .letter, letter?.isLocked == true { return }
        probe(kind == .letter ? "open letter" : "open note")
        withAnimation(.spring(response: 0.55, dampingFraction: 0.78)) { stage = .open }
        setActions([NotificationButtons.heart, NotificationButtons.openApp])
        let id = kind == .letter ? letter?.id : noteId
        guard let id else { return }
        let isLetter = kind == .letter
        // Off the main thread: the first request and the first widget reload in this process set
        // things up (a URL session, a connection to WidgetKit), which would otherwise land in the
        // middle of the opening and cost it frames.
        Task.detached(priority: .utility) {
            if isLetter {
                try? await KiriyaAPI.openLetter(id)
            } else {
                // The Home Screen widget shows the note open at once, whatever the server has heard.
                NotesWidgetMailbox.markOpened(id, reload: false)
                try? await KiriyaAPI.openNote(id)
            }
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    /// Debug builds log the frames around an opening (NotificationViewController's FrameProbe).
    var probe: (String) -> Void = { _ in }

    /// Once per process, while the first card is still sealed: the URL session and WidgetKit's
    /// connection are set up in the background, so the first button press doesn't pay for them.
    private static var warmedServices = false
    private static func warmServices() {
        guard !warmedServices else { return }
        warmedServices = true
        Task.detached(priority: .utility) {
            _ = URLSession.shared.configuration
            _ = WidgetCenter.shared
        }
    }

    /// A long letter's push carries only its start; the rest comes while she looks at the envelope.
    private func fetchWholeLetter() {
        guard let current = letter, current.truncated, !current.isLocked, let id = current.id, KiriyaAPI.isSetUp else { return }
        Task {
            guard let full = try? await KiriyaAPI.letter(id), let text = full.text, letter?.id == id else { return }
            letter?.text = text
            letter?.truncated = false
        }
    }

    private static func letter(from payload: [String: Any]?, body: String) -> LetterDetails {
        guard let payload, let title = payload["title"] as? String else {
            // A push without the letter (an older server): the announcement is all there is.
            return LetterDetails(id: nil, title: "a letter for you", text: body, from: "", truncated: true)
        }
        let nonEmpty: (Any?) -> String? = { ($0 as? String).flatMap { $0.isEmpty ? nil : $0 } }
        return LetterDetails(id: nonEmpty(payload["id"]),
                             title: title,
                             text: (payload["text"] as? String) ?? "",
                             from: nonEmpty(payload["from"]) ?? "",
                             kind: nonEmpty(payload["kind"]),
                             openWhen: nonEmpty(payload["openWhen"]),
                             date: date(payload["date"]),
                             lockedUntil: date(payload["lockedUntil"]),
                             truncated: (payload["truncated"] as? Bool) ?? false)
    }

    private static func date(_ value: Any?) -> Date? {
        guard let text = value as? String else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return precise.date(from: text) ?? ISO8601DateFormatter().date(from: text)
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
    static let openLetter = UNNotificationAction(identifier: KiriyaNotificationActions.openHere, title: "Open letter 💌", options: [],
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
    /// True for a moment while the sealed card waits: see `warmingCopy`.
    @State private var warming = false
    /// The kinds of card already drawn open once in this process.
    @MainActor private static var warmed: Set<String> = []

    var body: some View {
        Group {
            switch model.kind {
            case .note: noteCard
            case .letter: letterCard
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

    private var noteCard: some View {
        let content = LetterContent(heading: model.heading, title: model.noteTitle, text: model.text,
                                    byline: model.byline, truncated: model.truncated)
        return withHeartStatus(
            LetterCard(content: content,
                       isOpen: model.stage == .open,
                       onTapSealed: { model.openEnvelope() },
                       maxHeight: 720 - Self.statusHeight)
                .background(alignment: .top) {
                    if warming {
                        warmingCopy(LetterCard(content: content, isOpen: true, maxHeight: 720 - Self.statusHeight))
                    }
                }
                .task(id: "note|\(content.text)") { await warmUp("note") })
    }

    // MARK: a letter

    /// The letter's own card (FormalLetter/FormalLetterCard.swift): a wax-sealed envelope that opens
    /// into the letter on cream paper. A long letter scrolls inside its paper; one that isn't ready
    /// yet stays sealed with its date on it.
    private var letterCard: some View {
        let letter = model.letter
        let content = FormalLetterContent(heading: model.heading, title: letter?.title ?? "",
                                          text: letter?.text ?? "", from: letter?.from ?? "",
                                          kind: letter?.kind, openWhen: letter?.openWhen, date: letter?.date,
                                          lockedUntil: letter?.lockedUntil, truncated: letter?.truncated ?? false)
        return withHeartStatus(
            FormalLetterCard(content: content,
                             isOpen: model.stage == .open,
                             onTapSealed: { model.openEnvelope() },
                             scrollable: true,
                             maxHeight: 720 - Self.statusHeight)
                .background(alignment: .top) {
                    if warming {
                        warmingCopy(FormalLetterCard(content: content, isOpen: true, scrollable: true, maxHeight: 720 - Self.statusHeight))
                    }
                }
                .task(id: "letter|\(content.text)") {
                    if !(letter?.isLocked ?? false) { await warmUp("letter") }
                })
    }

    // MARK: the first opening

    /// The first time a card opens in this process it pays for everything drawn for the first time
    /// (the paper's view tree, its lettering at every size, its shapes), and the opening's first
    /// frames stutter; every later opening is smooth. So while the sealed card waits, the open card
    /// is drawn once, out of sight behind it (the sealed card is opaque, and the copy is all but
    /// transparent too), then taken away. Once per kind of card in this process.
    private func warmingCopy(_ card: some View) -> some View {
        card
            .opacity(0.001)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    /// Waits until the notification has finished growing into view, then draws the open copy for a
    /// few frames. Skipped if she opens the card first (it is warming up by then anyway).
    private func warmUp(_ kind: String) async {
        guard !Self.warmed.contains(kind), model.stage == .sealed else { return }
        try? await Task.sleep(for: .milliseconds(700))
        guard !Task.isCancelled, model.stage == .sealed, !Self.warmed.contains(kind) else { return }
        Self.warmed.insert(kind)
        model.probe("warm \(kind)")
        warming = true
        try? await Task.sleep(for: .milliseconds(300))
        warming = false
    }

    /// The card, with a small strip under it once "Send one back" is pressed.
    private func withHeartStatus(_ card: some View) -> some View {
        VStack(spacing: 0) {
            card
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
