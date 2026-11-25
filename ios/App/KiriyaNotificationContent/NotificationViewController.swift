import SwiftUI
import UIKit
import UserNotifications
import UserNotificationsUI
import WidgetKit

/// kiriya.love's notification content extension: what a little note or the note jar shows when its
/// notification is pressed and held (docs/refactor/MAC-BUILD.md).
///
/// - A little note arrives sealed in its envelope. "Open ✉" (or a tap on the envelope) opens it right
///   here and the whole note slides out; it counts as opened, as in the app. The server sends the
///   note's full text in the push (server/push/apns.js notePayload).
/// - The jar's morning push and the evening reminder get "Pull one": a note comes out of the jar
///   right here, the same draw as in the app (on Josh's phone, a preview that changes nothing).
/// - "send one back" sends a ♡ without opening anything; "Open in app" opens the page.
/// Target membership: KiriyaNotificationContent, plus ../KiriyaShared/KiriyaShared.swift.
final class NotificationViewController: UIViewController, UNNotificationContentExtension {
    private let model = NoteCardModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        model.openInApp = { [weak self] in self?.extensionContext?.performNotificationDefaultAction() }
        model.setActions = { [weak self] actions in self?.extensionContext?.notificationActions = actions }
        let host = UIHostingController(rootView: NoteCardView(model: model))
        host.sizingOptions = .preferredContentSize
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

    /// The card grows when the envelope opens; the notification follows its height.
    override func preferredContentSizeDidChange(forChildContentContainer container: UIContentContainer) {
        super.preferredContentSizeDidChange(forChildContentContainer: container)
        preferredContentSize = CGSize(width: view.bounds.width, height: min(container.preferredContentSize.height, 620))
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
