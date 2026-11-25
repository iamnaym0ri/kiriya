import Capacitor
import UIKit
import UserNotifications
import WidgetKit

// How kiriya.love's notifications behave on the phone (docs/refactor/MAC-BUILD.md).
//
// The server sends each kind with its own category (server/push/apns.js). Here those categories get
// their buttons, and the two buttons that work without opening the app, "♡ back" and "Reply", are
// handled natively: @capacitor/push-notifications would only pass them to the web page, which may
// be suspended before its request finishes. Everything else (a plain tap, "Open") still goes to
// Capacitor's router, so the page hears `pushNotificationActionPerformed` and opens `navigate`.

enum KiriyaNotificationCategories {
    static let heart = "HEART"
    static let reply = "REPLY"
    static let open = "OPEN"
    // Handled inside the notification by the content extension (ios/App/KiriyaNotificationContent).
    static let openHere = "OPEN_HERE"
    static let pull = "PULL"
    static let openApp = "OPEN_APP"

    /// At launch, before any notification can be answered.
    static func register() {
        let heart = UNNotificationAction(identifier: Self.heart, title: "send one back", options: [],
                                         icon: UNNotificationActionIcon(systemImageName: "heart.fill"))
        // A little note opens right inside its notification, and the jar gives one up there too.
        let openHere = UNNotificationAction(identifier: Self.openHere, title: "Open ✉", options: [],
                                            icon: UNNotificationActionIcon(systemImageName: "envelope.open"))
        let pull = UNNotificationAction(identifier: Self.pull, title: "Pull one", options: [],
                                        icon: UNNotificationActionIcon(systemImageName: "sparkles"))
        let openApp = UNNotificationAction(identifier: Self.openApp, title: "Open in app", options: [.foreground],
                                           icon: UNNotificationActionIcon(systemImageName: "arrow.up.forward.app"))
        let open = UNNotificationAction(identifier: Self.open, title: "Open", options: [.foreground],
                                        icon: UNNotificationActionIcon(systemImageName: "envelope.open"))
        // A reply sends as her, so it asks for Face ID / the passcode first when the phone is locked.
        let reply = UNTextInputNotificationAction(identifier: Self.reply, title: "Reply", options: [.authenticationRequired],
                                                  icon: UNNotificationActionIcon(systemImageName: "arrowshape.turn.up.left"),
                                                  textInputButtonTitle: "Send", textInputPlaceholder: "say something sweet")

        func category(_ id: String, _ actions: [UNNotificationAction], hidden: String) -> UNNotificationCategory {
            UNNotificationCategory(identifier: id, actions: actions, intentIdentifiers: [],
                                   hiddenPreviewsBodyPlaceholder: hidden, options: [])
        }

        UNUserNotificationCenter.current().setNotificationCategories([
            category("CHAT", [reply, heart], hidden: "a new message ♡"),
            category("TAP", [heart], hidden: "a little tap ♡"),
            category("LETTER", [open, heart], hidden: "a letter for you ✉︎"),
            category("NOTE", [openHere, heart, openApp], hidden: "a little note for you ✉︎"),
            category("JAR", [pull, openApp], hidden: "new notes in your jar ♡"),
            category("EVENT", [open], hidden: "news about an event"),
            category("REMINDER", [pull, openApp], hidden: "a little reminder ♡"),
        ])
    }
}

/// Keeps the app alive in the background while a notification button's request finishes.
private final class BackgroundWork: @unchecked Sendable {  // only touched on the main thread
    private var id: UIBackgroundTaskIdentifier = .invalid

    init(_ name: String) {
        id = UIApplication.shared.beginBackgroundTask(withName: name) { [weak self] in self?.end() }
    }

    func end() {
        guard id != .invalid else { return }
        UIApplication.shared.endBackgroundTask(id)
        id = .invalid
    }
}

/// The notification centre's delegate. Installed at launch (so a button pressed while the app
/// wasn't running is still heard), and again once Capacitor's bridge exists, because the bridge
/// makes its own router the delegate while it starts (MainViewController.capacitorDidLoad).
final class KiriyaNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = KiriyaNotificationDelegate()

    private weak var router: NotificationRouter?
    /// Taps that arrived before the bridge was ready; handed over as soon as it is. Main thread only.
    private var waiting: [UNNotificationResponse] = []

    func install() {
        UNUserNotificationCenter.current().delegate = self
    }

    func attach(_ router: NotificationRouter) {
        onMain {
            self.router = router
            self.install()
            let pending = self.waiting
            self.waiting.removeAll()
            for response in pending {
                router.userNotificationCenter(UNUserNotificationCenter.current(), didReceive: response, withCompletionHandler: {})
            }
        }
    }

    // MARK: UNUserNotificationCenterDelegate

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // New things change what the widgets show.
        WidgetCenter.shared.reloadAllTimelines()
        if let router {
            router.userNotificationCenter(center, willPresent: notification, withCompletionHandler: completionHandler)
        } else {
            completionHandler([.banner, .list, .sound, .badge])
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let request = response.notification.request
        let info = request.content.userInfo

        switch response.actionIdentifier {
        case KiriyaNotificationCategories.heart:
            let clientId = KiriyaAPI.clientId("n", request.identifier, "heart")
            runInBackground(completionHandler, failure: "your ♡ didn’t send. open the chat to try again?") {
                try await KiriyaAPI.sendTap("thinking", clientId: clientId)
                KiriyaStore.markTapSent("thinking")
            }

        case KiriyaNotificationCategories.reply:
            let text = (response as? UNTextInputNotificationResponse)?.userText.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !text.isEmpty else { return completionHandler() }
            let clientId = KiriyaAPI.clientId("n", request.identifier, "reply")
            let replyTo = info["messageId"] as? String
            runInBackground(completionHandler, failure: "your reply didn’t send. open the chat to try again?") {
                try await KiriyaAPI.reply(text, replyTo: replyTo, clientId: clientId)
                // Like Messages: answering clears the conversation's other banners.
                await Self.clearDelivered(thread: "chat")
            }

        case KiriyaNotificationCategories.openHere, KiriyaNotificationCategories.pull:
            // Only meaningful inside the notification (the content extension handles them there).
            completionHandler()

        default:
            onMain {
                let fromPush = request.trigger is UNPushNotificationTrigger
                // Our own "didn't send" notices are local: open the page they point at.
                if !fromPush, let path = info["navigate"] as? String, path.hasPrefix("/"),
                   let url = URL(string: "kiriyalove://open\(path)") {
                    UIApplication.shared.open(url)
                    completionHandler()
                } else if let router = self.router {
                    router.userNotificationCenter(center, didReceive: response, withCompletionHandler: completionHandler)
                } else {
                    self.waiting.append(response)
                    completionHandler()
                }
            }
        }
    }

    // MARK: helpers

    private func runInBackground(_ completion: @escaping () -> Void, failure: String, work: @escaping () async throws -> Void) {
        onMain {
            let background = BackgroundWork("kiriya-notification-action")
            Task {
                do {
                    try await work()
                } catch {
                    await Self.tellFailure(failure)
                }
                DispatchQueue.main.async {
                    WidgetCenter.shared.reloadAllTimelines()
                    completion()
                    background.end()
                }
            }
        }
    }

    private static func tellFailure(_ body: String) async {
        let content = UNMutableNotificationContent()
        content.title = "kiriya.love"
        content.body = body
        content.threadIdentifier = "chat"
        content.userInfo = ["navigate": "/world/chat", "kind": "chat"]
        let request = UNNotificationRequest(identifier: "kiriya-action-failed-\(UUID().uuidString)", content: content, trigger: nil)
        try? await UNUserNotificationCenter.current().add(request)
    }

    private static func clearDelivered(thread: String) async {
        let center = UNUserNotificationCenter.current()
        let delivered = await center.deliveredNotifications()
        let ids = delivered.filter { $0.request.content.threadIdentifier == thread }.map { $0.request.identifier }
        if !ids.isEmpty { center.removeDeliveredNotifications(withIdentifiers: ids) }
    }

    private func onMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread { work() } else { DispatchQueue.main.async(execute: work) }
    }
}
