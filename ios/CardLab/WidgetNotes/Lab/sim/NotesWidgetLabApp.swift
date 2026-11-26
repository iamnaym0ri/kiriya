import SwiftUI
import UIKit
import UserNotifications
import WidgetKit

// The little-note widget's lab app ("Kiriya Notes Widget Lab" simulator only). It plays the parts
// the real app and server play, with sample notes and nothing on the network:
// - writes the App Group the way KiriyaAPI does (a cached snapshot, a lab widget key, and an API
//   base that points nowhere, https://127.0.0.1:9, so no request can ever reach kiriya.love);
// - `-scene <name>` sets the widget's state; `-deliver note|letter` hands a NOTE / LETTER push's
//   userInfo to NotesWidgetMailbox.receive, as the notification service extension does;
// - `-suspend 1` goes back to the Home Screen right after, so the widget can be watched updating;
// - shows the kiriyalove:// link a widget tap opened.

@main
struct NotesWidgetLabApp: App {
    @State private var opened = "—"

    var body: some Scene {
        WindowGroup {
            VStack(spacing: 14) {
                Text("Notes widget lab").font(.title2.bold())
                Text("opened: \(opened)").font(.footnote.monospaced()).multilineTextAlignment(.center)
                ForEach(LabState.scenes, id: \.self) { name in
                    Button(name) { LabState.apply(name) }
                }
                Button("deliver a note (NSE path)") { LabState.deliver("note") }
            }
            .padding()
            .onOpenURL { url in opened = url.absoluteString }
            .task { await LabState.launch() }
        }
    }
}

enum LabState {
    static let scenes = ["clear", "empty", "sealed", "open", "title", "long", "letter", "sent-opened", "sent-waiting", "sent-loved", "admin-empty"]
    static let group = UserDefaults(suiteName: "group.love.kiriya.app")

    /// Order: set the scene, go back to the Home Screen (holding a background task), then hand the
    /// push over a moment later, so the widget is on screen when it changes, as when she's on her
    /// Home Screen and a note lands.
    @MainActor
    static func launch() async {
        let args = UserDefaults.standard
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        if let scene = args.string(forKey: "scene") { apply(scene) }
        let task = UIApplication.shared.beginBackgroundTask(withName: "deliver")
        if args.bool(forKey: "suspend") {
            try? await Task.sleep(nanoseconds: 300_000_000)
            UIControl().sendAction(#selector(URLSessionTask.suspend), to: UIApplication.shared, for: nil)
        }
        if let kind = args.string(forKey: "deliver") {
            try? await Task.sleep(nanoseconds: UInt64(max(0, args.double(forKey: "deliverAfter")) * 1_000_000_000))
            deliver(kind)
        }
        if let id = args.string(forKey: "markOpened") {
            try? await Task.sleep(nanoseconds: UInt64(max(0, args.double(forKey: "deliverAfter")) * 1_000_000_000))
            NotesWidgetMailbox.markOpened(id)
        }
        try? await Task.sleep(nanoseconds: 1_000_000_000)
        UIApplication.shared.endBackgroundTask(task)
    }

    static func iso(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: date)
    }

    static func note(_ id: String, title: String?, text: String, minutesAgo: Double, opened: Bool, reaction: String? = nil,
                     letter: Bool = false) -> [String: Any] {
        var n: [String: Any] = ["id": id, "kind": letter ? "update" : "note", "text": text, "preview": String(text.prefix(180)),
                                "at": iso(Date().addingTimeInterval(-minutesAgo * 60)), "opened": opened, "from": "Josh",
                                "link": letter ? "kiriyalove://open/world/letters?open=\(id)" : "kiriyalove://open/world/notes?open=\(id)",
                                "letter": letter]
        if let title { n["title"] = title }
        if opened { n["openedAt"] = iso(Date().addingTimeInterval(-max(0, minutesAgo - 20) * 60)) }
        if let reaction { n["reaction"] = reaction }
        return n
    }

    static let medium = "I know today felt long, but I'm so proud of how hard you worked. Go get bubble tea, put your feet up and don't think about revision for one whole evening. I'll call you at nine ♡"
    static let long = "I keep thinking about Saturday, the way you laughed so hard at the cat in the window that the lady at the next table started laughing too. You make ordinary places feel like somewhere I want to remember.\n\nI know this week is a lot, so here's your reminder: eat something warm, sleep before midnight, and don't let anyone make you feel small. You are so loved, more than this little note can hold, and I'll be right here when you get home."

    static func apply(_ scene: String) {
        guard let group else { return }
        for key in ["widgetKey", "apiBase", "role", "snapshot", "snapshotFetchedAt", "notesWidget.latest", "notesWidget.opened"] {
            group.removeObject(forKey: key)
        }
        guard scene != "clear" else { return reload() }
        let admin = scene.hasPrefix("sent") || scene == "admin-empty"
        group.set("kw_lab-simulator-only", forKey: "widgetKey")
        group.set("https://127.0.0.1:9", forKey: "apiBase")
        group.set(admin ? "admin" : "kiriya", forKey: "role")
        var snapshot: [String: Any] = ["role": admin ? "admin" : "kiriya", "me": admin ? "Josh" : "Kiriya", "other": admin ? "Kiriya" : "Josh",
                                       "links": ["notes": "kiriyalove://open/world/notes"]]
        let id = "6f1c2a3e-4b5d-4c6e-8f70-9a1b2c3d4e5f"
        switch scene {
        case "sealed": snapshot["latestNote"] = note(id, title: nil, text: "good morning, beautiful, drink some water for me ♡", minutesAgo: 1, opened: false)
        case "open": snapshot["latestNote"] = note(id, title: nil, text: "good morning, beautiful, drink some water for me ♡", minutesAgo: 6, opened: true)
        case "title": snapshot["latestNote"] = note(id, title: "for after your exam", text: medium, minutesAgo: 1, opened: true)
        case "long": snapshot["latestNote"] = note(id, title: "for after your exam", text: long, minutesAgo: 180, opened: true)
        case "letter": snapshot["latestNote"] = note(id, title: "a new letter for you ✉", text: "“three months” is waiting in your letters ♡",
                                                    minutesAgo: 2, opened: false, letter: true)
        case "sent-opened": snapshot["sentNote"] = note(id, title: nil, text: "good morning, beautiful, drink some water for me ♡", minutesAgo: 150, opened: true)
        case "sent-waiting": snapshot["sentNote"] = note(id, title: nil, text: "good morning, beautiful, drink some water for me ♡", minutesAgo: 30, opened: false)
        case "sent-loved": snapshot["sentNote"] = note(id, title: "for after your exam", text: medium, minutesAgo: 150, opened: true, reaction: "heart")
        default: break
        }
        if let data = try? JSONSerialization.data(withJSONObject: snapshot), let json = String(data: data, encoding: .utf8) {
            group.set(json, forKey: "snapshot")
            group.set(Date().timeIntervalSince1970, forKey: "snapshotFetchedAt")
        }
        reload()
    }

    /// What the notification service extension does with a NOTE / LETTER push (apns.js payloads).
    static func deliver(_ kind: String) {
        let id = UUID().uuidString.lowercased()
        let userInfo: [AnyHashable: Any]
        if kind == "letter" {
            userInfo = ["aps": ["alert": ["title": "a new letter for you ✉", "body": "“three months” is waiting in your letters ♡"], "mutable-content": 1],
                        "kind": "letter", "navigate": "/world/letters?open=\(id)",
                        "letter": ["id": id, "title": "three months", "from": "Josh"]]
        } else {
            userInfo = ["aps": ["alert": ["title": "for after your exam", "body": medium], "mutable-content": 1, "category": "NOTE"],
                        "kind": "note", "navigate": "/world/notes?open=\(id)",
                        "note": ["id": id, "title": "for after your exam", "text": medium, "from": "Josh"]]
        }
        NotesWidgetMailbox.receive(userInfo)
    }

    static func reload() { WidgetCenter.shared.reloadAllTimelines() }
}
