import UserNotifications

/// kiriya.love's Notification Service Extension (docs/refactor/MAC-BUILD.md).
///
/// Letters and little notes arrive with a drawn envelope, and new jar notes with the jar, so they
/// look special next to an ordinary chat message. The pictures ship inside this extension, so
/// nothing is downloaded. The server marks those pushes `mutable-content` (server/push/apns.js);
/// every other push never reaches this code. On any trouble the notification shows as sent.
final class NotificationService: UNNotificationServiceExtension {
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var best: UNNotificationContent?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        best = request.content
        // A little note (or a letter's announcement) goes straight onto the Home Screen widget, with
        // no network fetch (KiriyaWidgets/Notes/NotesWidgetMailbox.swift).
        NotesWidgetMailbox.receive(request.content.userInfo)

        guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
            return deliver(request.content)
        }

        let kind = content.userInfo["kind"] as? String
        let picture: String?
        switch kind {
        case "letter", "note": picture = "envelope"
        case "jar": picture = "jar"
        default: picture = nil
        }

        if let picture, let attachment = Self.attachment(named: picture) {
            content.attachments = [attachment]
        }
        // Letters and notes rise to the top of a notification summary.
        if kind == "letter" || kind == "note" {
            content.relevanceScore = 1.0
        }
        deliver(content)
    }

    override func serviceExtensionTimeWillExpire() {
        if let best { deliver(best) }
    }

    private func deliver(_ content: UNNotificationContent) {
        guard let handler = contentHandler else { return }
        contentHandler = nil
        handler(content)
    }

    /// A temporary copy of a bundled picture (the system moves attachment files into its own store,
    /// and an extension's bundle is read-only).
    private static func attachment(named name: String) -> UNNotificationAttachment? {
        guard let source = Bundle.main.url(forResource: name, withExtension: "png") else { return nil }
        let copy = FileManager.default.temporaryDirectory.appendingPathComponent("\(name)-\(UUID().uuidString).png")
        do {
            try FileManager.default.copyItem(at: source, to: copy)
            return try UNNotificationAttachment(identifier: name, url: copy,
                                                options: [UNNotificationAttachmentOptionsTypeHintKey: "public.png"])
        } catch {
            return nil
        }
    }
}
