import Foundation
import WidgetKit

// The little-note widget's own corner of the App Group (group.love.kiriya.app).
//
// This one file is built into more than one target, so it only needs Foundation and WidgetKit:
// - KiriyaWidgets (the widget reads it),
// - KiriyaNotificationService (a NOTE push drops the note in here and wakes the widget, so the
//   note is on her Home Screen the moment the notification lands, with no network fetch),
// - KiriyaNotificationContent and the App, if they want to mark a note opened right away.
//
// Keys (all prefixed, so they never meet the other widgets' keys):
//   notesWidget.latest     JSON of the newest note a push carried (NotesWidgetMailbox.Pushed)
//   notesWidget.previous   the one before it (so the widget can pass the new note in over the old)
//   notesWidget.opened     ids of notes opened on this phone (peeled on the widget, or opened in
//                          the notification), newest last, at most 40
//   notesWidget.pushToken  hex WidgetKit push token (iOS 26), for the server

enum NotesWidgetMailbox {
    /// The widget's kind. Kept from the first version of the widget, so a widget she already
    /// placed carries on as the new one.
    static let kind = "LittleNoteWidget"
    static let groupID = "group.love.kiriya.app"

    static let latestKey = "notesWidget.latest"
    static let previousKey = "notesWidget.previous"
    static let openedKey = "notesWidget.opened"
    static let pushTokenKey = "notesWidget.pushToken"

    static var defaults: UserDefaults? { UserDefaults(suiteName: groupID) }

    /// A note as its push carried it (server/push/apns.js notePayload), plus when it landed.
    struct Pushed: Codable, Equatable {
        /// "note", or "letter" for a letter's announcement.
        var kind: String
        var id: String?
        var title: String?
        var text: String
        var from: String?
        var truncated: Bool?
        /// Where tapping goes: the push's `navigate` path ("/world/notes?open=…").
        var navigate: String?
        /// A letter's own title, for its announcement.
        var letterTitle: String?
        var receivedAt: Double
    }

    // MARK: the notification service extension

    /// Call from `didReceive(_:withContentHandler:)` with the request's userInfo, before handing the
    /// content back. A NOTE push saves its note and reloads the widget; a LETTER push saves its
    /// announcement and reloads it too. Anything else is left alone. Takes a few milliseconds.
    @discardableResult
    static func receive(_ userInfo: [AnyHashable: Any], at date: Date = Date()) -> Bool {
        guard let kind = userInfo["kind"] as? String, kind == "note" || kind == "letter" else { return false }
        let navigate = userInfo["navigate"] as? String
        var pushed: Pushed?
        if kind == "note", let note = userInfo["note"] as? [String: Any],
           let text = (note["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
            pushed = Pushed(kind: "note", id: note["id"] as? String, title: clean(note["title"] as? String),
                            text: text, from: clean(note["from"] as? String), truncated: note["truncated"] as? Bool,
                            navigate: navigate, letterTitle: nil, receivedAt: date.timeIntervalSince1970)
        } else if kind == "letter" {
            // The announcement's own words are the alert ("a new letter for you ✉" / "“…” is waiting …").
            let alert = (userInfo["aps"] as? [String: Any])?["alert"] as? [String: Any]
            let letter = userInfo["letter"] as? [String: Any]
            let body = (alert?["body"] as? String) ?? ""
            pushed = Pushed(kind: "letter", id: nil, title: clean(alert?["title"] as? String) ?? "a new letter for you ✉",
                            text: body, from: clean(letter?["from"] as? String), truncated: false,
                            navigate: navigate, letterTitle: clean(letter?["title"] as? String),
                            receivedAt: date.timeIntervalSince1970)
        }
        if let pushed, let data = try? JSONEncoder().encode(pushed), let json = String(data: data, encoding: .utf8) {
            if let old = defaults?.string(forKey: latestKey) { defaults?.set(old, forKey: previousKey) } else { defaults?.removeObject(forKey: previousKey) }
            defaults?.set(json, forKey: latestKey)
        }
        WidgetCenter.shared.reloadTimelines(ofKind: Self.kind)
        return true
    }

    // MARK: reading and marking

    static func latest() -> Pushed? {
        guard let json = defaults?.string(forKey: latestKey), let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(Pushed.self, from: data)
    }

    static func previous() -> Pushed? {
        guard let json = defaults?.string(forKey: previousKey), let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(Pushed.self, from: data)
    }

    static func openedIDs() -> Set<String> {
        Set((defaults?.stringArray(forKey: openedKey) ?? []).map { $0.lowercased() })
    }

    static func isOpened(_ id: String?) -> Bool {
        guard let id else { return false }
        return openedIDs().contains(id.lowercased())
    }

    /// The note was read on this phone (peeled on the widget, or opened inside its notification).
    /// The widget shows it open straight away, whatever the server has heard so far.
    static func markOpened(_ id: String, reload: Bool = true) {
        let id = id.lowercased()
        var ids = defaults?.stringArray(forKey: openedKey) ?? []
        guard !ids.contains(id) else { return }
        ids.append(id)
        defaults?.set(Array(ids.suffix(40)), forKey: openedKey)
        if reload { WidgetCenter.shared.reloadTimelines(ofKind: kind) }
    }

    private static func clean(_ text: String?) -> String? {
        guard let text = text?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
        return text
    }
}
