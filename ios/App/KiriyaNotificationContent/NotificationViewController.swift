import SwiftUI
import UIKit
import UserNotifications
import UserNotificationsUI
import WidgetKit

/// kiriya.love's notification content extension: what a little note or the note jar shows when its
/// notification is pressed and held (docs/refactor/MAC-BUILD.md).
///
/// - A little note arrives sealed in its envelope (Letter/). "Open note 💌" (or a tap on the
///   envelope) opens it right here and the note comes to rest on top; it counts as opened, as in
///   the app. The server sends the note's full text in the push (server/push/apns.js notePayload).
/// - The jar's morning push and the evening reminder get "Pull one ✨": a note comes out of the
///   app's own jar (Jar/) right here, the same draw as in the app (on Josh's phone, a preview that
///   changes nothing).
/// - "Send one back ❤️" sends a heart without opening anything; "Open in app" opens the page.
/// Target membership: KiriyaNotificationContent (NoteCardView, Letter/, Jar/ and their fonts, via
/// ios/scripts/add-native-targets.rb), plus ../KiriyaShared/KiriyaShared.swift.
final class NotificationViewController: UIViewController, UNNotificationContentExtension {
    private let model = NoteCardModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        model.openInApp = { [weak self] in self?.extensionContext?.performNotificationDefaultAction() }
        model.setActions = { [weak self] actions in self?.extensionContext?.notificationActions = actions }
        #if DEBUG
        model.probe = { label in FrameProbe.shared.watch(label) }
        #endif
        // The card measures itself and the notification follows, so nothing is cut off as it opens.
        model.reportHeight = { [weak self] height in
            guard let self else { return }
            let target = CGSize(width: self.view.bounds.width, height: min(height.rounded(.up), 720))
            if abs(target.height - self.preferredContentSize.height) > 1 { self.preferredContentSize = target }
        }
        let host = UIHostingController(rootView: NoteCardView(model: model))
        host.view.backgroundColor = .clear
        addChild(host)
        view.addSubview(host.view)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        host.didMove(toParent: self)
    }

    func didReceive(_ notification: UNNotification) {
        model.load(notification)
    }

    func didReceive(_ response: UNNotificationResponse,
                    completionHandler completion: @escaping (UNNotificationContentExtensionResponseOption) -> Void) {
        switch response.actionIdentifier {
        case KiriyaNotificationActions.openHere:
            model.openEnvelope()
            completion(.doNotDismiss)
        case KiriyaNotificationActions.pull:
            model.pull()
            completion(.doNotDismiss)
        case KiriyaNotificationActions.heart:
            model.sendHeart(notificationId: response.notification.request.identifier)
            completion(.doNotDismiss)
        default:
            // "Open in app" (and anything else): the app's own delegate takes it from here.
            completion(.dismissAndForwardAction)
        }
    }
}

/// The action ids (they must match ios/App/App/KiriyaNotifications.swift).
enum KiriyaNotificationActions {
    static let openHere = "OPEN_HERE"
    static let pull = "PULL"
    static let heart = "HEART"
    static let openApp = "OPEN_APP"
}

#if DEBUG
/// Debug builds only: how smooth an opening (or the first-opening warm-up) really was on the phone.
/// For a few seconds it times every frame, then appends one line to `notecard-frames.log` in the
/// App Group: the frames over budget and when they fell. Read it from the Mac with
/// `xcrun devicectl device copy from --domain-type appGroupDataContainer
///  --domain-identifier group.love.kiriya.app --source notecard-frames.log`.
@MainActor
final class FrameProbe: NSObject {
    static let shared = FrameProbe()

    private var link: CADisplayLink?
    private var label = ""
    private var started: CFTimeInterval = 0
    private var last: CFTimeInterval = 0
    private var frames = 0
    private var slow: [(at: Int, ms: Int)] = []
    private var watched = 0

    func watch(_ label: String, seconds: Double = 4) {
        finish()
        self.label = label
        watched += 1
        frames = 0
        slow = []
        started = CACurrentMediaTime()
        last = started
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link.add(to: .main, forMode: .common)
        self.link = link
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { [weak self] in
            guard let self, self.link === link else { return }
            self.finish()
        }
    }

    @objc private func tick(_ link: CADisplayLink) {
        let now = link.timestamp
        let gap = now - last
        last = now
        frames += 1
        // One frame at 60 Hz is 16.7 ms; anything past 25 ms dropped at least one.
        if gap > 0.025 { slow.append((at: Int((now - started) * 1000), ms: Int(gap * 1000))) }
    }

    private func finish() {
        guard let link else { return }
        link.invalidate()
        self.link = nil
        let worst = slow.map(\.ms).max() ?? 0
        let detail = slow.prefix(12).map { "\($0.ms)ms@\($0.at)" }.joined(separator: " ")
        let stamp = ISO8601DateFormatter().string(from: Date())
        let line = "\(stamp) \(label) #\(watched) frames=\(frames) slow=\(slow.count) worst=\(worst)ms \(detail)\n"
        guard let folder = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: KiriyaGroup.id) else { return }
        let url = folder.appendingPathComponent("notecard-frames.log")
        if let handle = try? FileHandle(forWritingTo: url) {
            handle.seekToEndOfFile()
            handle.write(Data(line.utf8))
            try? handle.close()
        } else {
            try? Data(line.utf8).write(to: url)
        }
    }
}
#endif
