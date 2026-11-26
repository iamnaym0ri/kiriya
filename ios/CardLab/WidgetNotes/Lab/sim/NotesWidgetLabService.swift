import UserNotifications

// The lab's notification service extension: the same one line the real
// KiriyaNotificationService gets (NotesWidgetMailbox.receive), so `simctl push` of a NOTE payload
// exercises the exact path a real push takes to the widget.
final class NotificationService: UNNotificationServiceExtension {
    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        NotesWidgetMailbox.receive(request.content.userInfo)
        contentHandler(request.content)
    }
}
