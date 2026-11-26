import Foundation
import WidgetKit

// iOS 26: WidgetKit push updates. The server can wake this widget with an APNs push of type
// `widgets` (topic love.kiriya.app.push-type.widgets, payload {"aps":{"content-changed":true}}),
// which reloads its timeline like reloadTimelines does. It's an extra path on top of the
// notification service extension: it also reaches her widget when she has notifications turned
// off, for notes delivered quietly at night, and Josh's widget the moment she opens his note.
// Apple budgets these pushes like reloads, so the server sends one per real change only.
//
// WidgetKit hands the push token to this handler (never to UNUserNotificationCenter). It is kept in
// the App Group (notesWidget.pushToken) and, once the server has the route, sent to
// POST /api/widget/push-token with the widget key (`NotesWidgetPush.uploads`).
// Needs: the Push Notifications capability (aps-environment) on the KiriyaWidgets target.

enum NotesWidgetPush {
    /// Off until the server has POST /api/widget/push-token (see ios/CardLab/WidgetNotes/PROGRESS.md).
    static let uploads = false

    static func store(_ token: Data) -> String {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        NotesWidgetMailbox.defaults?.set(hex, forKey: NotesWidgetMailbox.pushTokenKey)
        return hex
    }

    static func upload(_ hex: String, kinds: [String]) async {
        guard uploads, KiriyaAPI.isSetUp, let key = KiriyaAPI.key else { return }
        var request = URLRequest(url: KiriyaAPI.base.appendingPathComponent("api/widget/push-token"),
                                 cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        request.httpMethod = "POST"
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        #if DEBUG
        let environment = "development"
        #else
        let environment = "production"
        #endif
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["token": hex, "env": environment, "kinds": kinds])
        _ = try? await URLSession.shared.data(for: request)
    }
}

@available(iOS 26.0, *)
struct NotesWidgetPushHandler: WidgetPushHandler {
    init() {}

    func pushTokenDidChange(_ pushInfo: WidgetPushInfo, widgets: [WidgetInfo]) {
        let hex = NotesWidgetPush.store(pushInfo.token)
        let kinds = Array(Set(widgets.map(\.kind)))
        Task { await NotesWidgetPush.upload(hex, kinds: kinds) }
    }
}
