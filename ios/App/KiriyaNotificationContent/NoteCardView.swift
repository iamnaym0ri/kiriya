import SwiftUI
import UserNotifications
import WidgetKit

// What the content extension draws: a sealed envelope that opens into the note, or the jar that a
// note comes out of. The site's lilac look (the same colours as the widgets, WidgetTheme.swift).

enum Palette {
    static let paper = Color(red: 1.0, green: 0.969, blue: 0.984)        // #fff7fb
    static let lilac = Color(red: 0.937, green: 0.898, blue: 0.965)      // #efe5f6
    static let lilacDeep = Color(red: 0.851, green: 0.776, blue: 0.925)  // #d9c6ec
    static let plum = Color(red: 0.306, green: 0.184, blue: 0.388)       // #4e2f63
    static let soft = Color(red: 0.541, green: 0.416, blue: 0.639)       // #8a6aa3
    static let heart = Color(red: 0.886, green: 0.267, blue: 0.361)      // #e2445c
    static let line = Color(red: 0.851, green: 0.776, blue: 0.925).opacity(0.55)

    static var background: some View {
        LinearGradient(colors: [paper, lilac, lilacDeep.opacity(0.8)], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

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
            stage = .failed("open kiriya.love once, then the jar opens from here ♡")
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
        // The same id the app's own "♡ back" uses, so a retry can never send twice.
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

/// The buttons under the card once it has changed (the first set comes from the app's categories).
enum NotificationButtons {
    static let heart = UNNotificationAction(identifier: KiriyaNotificationActions.heart, title: "send one back", options: [],
                                            icon: UNNotificationActionIcon(systemImageName: "heart.fill"))
    static let openApp = UNNotificationAction(identifier: KiriyaNotificationActions.openApp, title: "Open in app", options: [.foreground],
                                              icon: UNNotificationActionIcon(systemImageName: "arrow.up.forward.app"))
    static func pull(again: Bool) -> UNNotificationAction {
        UNNotificationAction(identifier: KiriyaNotificationActions.pull, title: again ? "Pull another" : "Pull one", options: [],
                             icon: UNNotificationActionIcon(systemImageName: "sparkles"))
    }
}

struct NoteCardView: View {
    @ObservedObject var model: NoteCardModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var bob = false

    var body: some View {
        VStack(spacing: 14) {
            switch model.kind {
            case .note: note
            case .jar: jar
            }
            footer
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 18)
        .frame(maxWidth: .infinity)
        .background(Palette.background)
        .onAppear { if !reduceMotion { bob = true } }
    }

    // MARK: a little note

    @ViewBuilder private var note: some View {
        if model.stage == .sealed {
            VStack(spacing: 10) {
                Text(model.heading)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundStyle(Palette.soft)
                    .multilineTextAlignment(.center)
                picture("envelope", height: 150)
                    .rotationEffect(.degrees(bob ? -3 : 3))
                    .offset(y: bob ? -3 : 3)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 1.6).repeatForever(autoreverses: true), value: bob)
                    .onTapGesture { model.openEnvelope() }
                    .accessibilityAddTraits(.isButton)
                    .accessibilityLabel(Text("Open the note"))
                Text("tap to open ♡")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(Palette.soft)
            }
            .transition(.opacity)
        } else {
            VStack(spacing: 6) {
                picture("envelope", height: 48)
                    .rotationEffect(.degrees(-8))
                    .opacity(0.9)
                paper(title: model.noteTitle, label: nil)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    // MARK: the jar

    @ViewBuilder private var jar: some View {
        switch model.stage {
        case .pulled:
            VStack(spacing: 6) {
                picture("jar", height: 52)
                paper(title: nil, label: model.label)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                if model.preview {
                    Text("a preview: her jar is untouched")
                        .font(.system(size: 12, design: .rounded))
                        .foregroundStyle(Palette.soft)
                }
            }
        default:
            VStack(spacing: 10) {
                Text(model.heading)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundStyle(Palette.soft)
                    .multilineTextAlignment(.center)
                picture("jar", height: 150)
                    .rotationEffect(.degrees(model.stage == .pulling ? (bob ? -6 : 6) : 0))
                    .animation(model.stage == .pulling && !reduceMotion ? .easeInOut(duration: 0.12).repeatForever(autoreverses: true) : .default, value: bob)
                    .onTapGesture { model.pull() }
                    .accessibilityAddTraits(.isButton)
                    .accessibilityLabel(Text("Pull a note from the jar"))
                if case .failed(let message) = model.stage {
                    Text(message)
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundStyle(Palette.heart)
                } else {
                    Text(model.stage == .pulling ? "pulling one out…" : "tap the jar to pull one ♡")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundStyle(Palette.soft)
                }
            }
        }
    }

    // MARK: pieces

    private func paper(title: String?, label: String?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let label, !label.isEmpty {
                Text(label)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(Palette.soft)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Palette.lilac))
            }
            if let title {
                Text(title)
                    .font(.system(size: 19, weight: .bold, design: .rounded))
                    .foregroundStyle(Palette.plum)
            }
            Text(model.text)
                .font(.system(size: 17, design: .rounded))
                .foregroundStyle(Palette.plum)
                .lineSpacing(4)
                .lineLimit(28)
                .fixedSize(horizontal: false, vertical: true)
            if model.truncated {
                Text("the rest is waiting in the app ♡")
                    .font(.system(size: 13, design: .rounded))
                    .foregroundStyle(Palette.soft)
            }
            if !model.byline.isEmpty {
                Text(model.byline)
                    .font(.system(size: 17, design: .serif).italic())
                    .foregroundStyle(Palette.soft)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Palette.paper)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Palette.lilacDeep, lineWidth: 1.5))
                .shadow(color: Palette.plum.opacity(0.12), radius: 8, x: 2, y: 4)
        )
        .rotationEffect(.degrees(-1.2))
        .padding(.horizontal, 4)
    }

    @ViewBuilder private var footer: some View {
        HStack {
            switch model.heart {
            case .idle: EmptyView()
            case .sending: status("sending your ♡…", Palette.soft)
            case .sent: status("sent ♡", Palette.heart)
            case .failed: status("that didn’t send. try again?", Palette.heart)
            }
            Spacer(minLength: 0)
            Button { model.openInApp() } label: {
                Text("open in app ›")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Palette.soft)
            }
            .buttonStyle(.plain)
        }
    }

    private func status(_ text: String, _ color: Color) -> some View {
        Text(text)
            .font(.system(size: 14, weight: .bold, design: .rounded))
            .foregroundStyle(color)
            .transition(.scale.combined(with: .opacity))
    }

    private func picture(_ name: String, height: CGFloat) -> some View {
        Group {
            if let image = UIImage(named: name) {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                Image(systemName: name == "jar" ? "sparkles" : "envelope.fill").resizable().scaledToFit().foregroundStyle(Palette.soft)
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }
}
