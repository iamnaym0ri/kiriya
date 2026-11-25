import Foundation

// What the app, its Home Screen widgets and Siri share (docs/refactor/MAC-BUILD.md).
// Target membership: App and KiriyaWidgets.
//
// The web side writes these strings into the App Group's UserDefaults through
// capacitor-widget-bridge (`WidgetBridgePlugin.setItem({ group, key, value })`, which stores them
// with `UserDefaults(suiteName:).set(String, forKey:)`):
//   widgetKey  a revocable `kw_…` device key for /api/widget/* (Authorization: Bearer)
//   apiBase    "https://kiriya.love"
//   role       "kiriya" | "admin"
//   snapshot   the JSON of GET /api/widget/app
// Native code adds `snapshotFetchedAt`, `lastTapSentAt` and `lastTapKind`.

enum KiriyaGroup {
    static let id = "group.love.kiriya.app"

    static let widgetKey = "widgetKey"
    static let apiBase = "apiBase"
    static let role = "role"
    static let snapshot = "snapshot"
    static let snapshotFetchedAt = "snapshotFetchedAt"
    static let lastTapSentAt = "lastTapSentAt"
    static let lastTapKind = "lastTapKind"

    static var defaults: UserDefaults? { UserDefaults(suiteName: id) }
}

// MARK: - The widget snapshot (GET /api/widget/app). Every field is optional, so a server that
// adds or drops a field never breaks the widgets.

struct KiriyaSnapshot: Codable {
    struct Unread: Codable { var notes: Int?; var chat: Int?; var jar: Int?; var total: Int? }
    struct Note: Codable { var title: String?; var preview: String?; var at: String?; var opened: Bool? }
    struct Jar: Codable { var fresh: Int? }
    struct ChatLast: Codable { var from: String?; var preview: String?; var at: String?; var mine: Bool? }
    struct Chat: Codable { var last: ChatLast? }
    struct Event: Codable { var title: String?; var startsOn: String?; var daysAway: Int?; var venue: String? }
    struct Tap: Codable { var key: String; var emoji: String?; var label: String? }
    struct Links: Codable { var world: String?; var chat: String?; var notes: String?; var jar: String?; var events: String? }

    var role: String?
    var me: String?
    var other: String?
    var unread: Unread?
    var latestNote: Note?
    var jar: Jar?
    var chat: Chat?
    var nextEvent: Event?
    var taps: [Tap]?
    var links: Links?
    var updatedAt: String?

    /// Shown in the widget gallery and while nothing has loaded yet.
    static let sample = KiriyaSnapshot(
        role: "kiriya", me: "Kiriya", other: "Josh",
        unread: Unread(notes: 1, chat: 2, jar: 2, total: 5),
        latestNote: Note(title: "a little note", preview: "thinking of you today, as always ♡", at: nil, opened: false),
        jar: Jar(fresh: 2),
        chat: Chat(last: ChatLast(from: "Josh", preview: "good morning baby ♡", at: nil, mine: false)),
        nextEvent: Event(title: "the next con", startsOn: nil, daysAway: 12, venue: "Singapore"),
        taps: nil, links: nil, updatedAt: nil)

    /// The person on the other end ("Josh" on her phone).
    var otherName: String { (other?.isEmpty == false ? other : nil) ?? (role == "admin" ? "Kiriya" : "Josh") }
}

// MARK: - Deep links: kiriyalove://open/<path> opens the app at /<path>.

enum KiriyaLink {
    static func url(_ link: String?, fallback path: String) -> URL {
        if let link, let url = URL(string: link), url.scheme == "kiriyalove" { return url }
        return URL(string: "kiriyalove://open\(path)") ?? URL(string: "kiriyalove://open/world")!
    }
}

// MARK: - Small shared state

enum KiriyaStore {
    static func markTapSent(_ kind: String, at date: Date = Date()) {
        KiriyaGroup.defaults?.set(date.timeIntervalSince1970, forKey: KiriyaGroup.lastTapSentAt)
        KiriyaGroup.defaults?.set(kind, forKey: KiriyaGroup.lastTapKind)
    }

    static func lastTapDate() -> Date? {
        guard let seconds = KiriyaGroup.defaults?.object(forKey: KiriyaGroup.lastTapSentAt) as? Double else { return nil }
        return Date(timeIntervalSince1970: seconds)
    }

    /// The emoji of a tap sent in the last minute, for the widget's little "sent" moment.
    static func recentTap(now: Date = Date()) -> String? {
        guard let sent = lastTapDate(), now.timeIntervalSince(sent) >= 0, now.timeIntervalSince(sent) < 60 else { return nil }
        let kind = KiriyaGroup.defaults?.string(forKey: KiriyaGroup.lastTapKind) ?? "thinking"
        return TapCatalog.emoji(for: kind)
    }
}

/// The seven one-tap messages (shared/taps.js). Keys are what the server expects.
enum TapCatalog {
    static let all: [(key: String, emoji: String, label: String)] = [
        ("thinking", "♡", "thinking of you"),
        ("hug", "🫂", "a hug"),
        ("kiss", "😘", "a kiss"),
        ("morning", "☀️", "good morning"),
        ("night", "🌙", "goodnight"),
        ("miss", "🥺", "miss you"),
        ("water", "💧", "drink some water"),
    ]

    static func emoji(for key: String) -> String { all.first { $0.key == key }?.emoji ?? "♡" }
}

// MARK: - The kiriya.love widget API (server/routes/widget.js), with the device key.

enum KiriyaAPIError: Error {
    case notSetUp
    case badResponse(Int)
}

enum KiriyaAPI {
    static let defaultBase = URL(string: "https://kiriya.love")!

    /// Only ever https, so the key can't be sent anywhere in the clear.
    static var base: URL {
        guard let raw = KiriyaGroup.defaults?.string(forKey: KiriyaGroup.apiBase),
              let url = URL(string: raw), url.scheme == "https", url.host != nil else { return defaultBase }
        return url
    }

    static var key: String? {
        guard let key = KiriyaGroup.defaults?.string(forKey: KiriyaGroup.widgetKey), key.hasPrefix("kw_"), key.count <= 80 else { return nil }
        return key
    }

    static var isSetUp: Bool { key != nil }

    /// A clientId the server accepts (/^[\w-]{8,80}$/) and dedupes on, so a retry can't double-send.
    static func clientId(_ prefix: String, _ raw: String, _ suffix: String) -> String {
        var cleaned = String(raw.filter { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_") }.prefix(56))
        if cleaned.count < 8 { cleaned = UUID().uuidString }
        return String("\(prefix)-\(cleaned)-\(suffix)".prefix(80))
    }

    private static func makeRequest(_ path: String, method: String) throws -> URLRequest {
        guard let key else { throw KiriyaAPIError.notSetUp }
        var urlRequest = URLRequest(url: base.appendingPathComponent(path), cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        urlRequest.httpMethod = method
        urlRequest.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        return urlRequest
    }

    @discardableResult
    private static func post(_ path: String, _ body: [String: Any]) async throws -> Data {
        var urlRequest = try makeRequest(path, method: "POST")
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw KiriyaAPIError.badResponse(status) }
        return data
    }

    /// POST /api/widget/notes/:id/open: a little note read inside its notification counts as opened.
    static func openNote(_ id: String) async throws {
        guard UUID(uuidString: id) != nil else { return }
        try await post("api/widget/notes/\(id)/open", [:])
    }

    /// A note pulled from the jar (POST /api/widget/jar/pull).
    struct PulledNote: Decodable {
        struct Note: Decodable { var text: String; var byline: String?; var label: String? }
        var note: Note
        var fresh: Bool?
        var preview: Bool?
    }

    /// "Pull one" on the jar's notification: the same draw as the jar in the app (a preview on Josh's phone).
    static func pullJar(requestId: String = UUID().uuidString) async throws -> PulledNote {
        let data = try await post("api/widget/jar/pull", ["requestId": requestId])
        return try JSONDecoder().decode(PulledNote.self, from: data)
    }

    /// POST /api/widget/tap { kind, clientId? }
    static func sendTap(_ kind: String, clientId: String? = nil) async throws {
        var body: [String: Any] = ["kind": kind]
        if let clientId { body["clientId"] = clientId }
        try await post("api/widget/tap", body)
    }

    /// POST /api/widget/reply { text, replyTo?, clientId? }
    static func reply(_ text: String, replyTo: String?, clientId: String?) async throws {
        var body: [String: Any] = ["text": String(text.prefix(2000))]
        if let replyTo, UUID(uuidString: replyTo) != nil { body["replyTo"] = replyTo }
        if let clientId { body["clientId"] = clientId }
        try await post("api/widget/reply", body)
    }

    /// GET /api/widget/app. A successful answer is cached for the widgets' next offline moment.
    static func fetchSnapshot() async throws -> KiriyaSnapshot {
        let (data, response) = try await URLSession.shared.data(for: try makeRequest("api/widget/app", method: "GET"))
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw KiriyaAPIError.badResponse(status) }
        let snapshot = try JSONDecoder().decode(KiriyaSnapshot.self, from: data)
        if let text = String(data: data, encoding: .utf8) {
            KiriyaGroup.defaults?.set(text, forKey: KiriyaGroup.snapshot)
            KiriyaGroup.defaults?.set(Date().timeIntervalSince1970, forKey: KiriyaGroup.snapshotFetchedAt)
        }
        return snapshot
    }

    /// The last snapshot the app or a widget saved, if any.
    static func cachedSnapshot() -> KiriyaSnapshot? {
        guard let text = KiriyaGroup.defaults?.string(forKey: KiriyaGroup.snapshot), let data = text.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(KiriyaSnapshot.self, from: data)
    }

    /// Four widgets reload together; one network fetch a minute is plenty for all of them.
    static func freshSnapshot(maxAge: TimeInterval = 60) async -> KiriyaSnapshot? {
        if let fetched = KiriyaGroup.defaults?.object(forKey: KiriyaGroup.snapshotFetchedAt) as? Double,
           Date().timeIntervalSince1970 - fetched < maxAge,
           let cached = cachedSnapshot() {
            return cached
        }
        return (try? await fetchSnapshot()) ?? cachedSnapshot()
    }
}
