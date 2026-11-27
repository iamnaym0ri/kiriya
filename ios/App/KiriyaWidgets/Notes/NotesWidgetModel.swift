import Foundation
import WidgetKit

// What the little-note widget shows, worked out from three places:
// - the snapshot GET /api/widget/app (cached in the App Group by KiriyaAPI), decoded here with the
//   note fields this widget needs (its own Decodable, so the shared KiriyaSnapshot stays as it is);
// - the newest note a push carried (NotesWidgetMailbox, written by the notification service
//   extension the moment the notification lands);
// - the notes opened on this phone (NotesWidgetMailbox.openedIDs).

/// One little note, however it reached the widget.
struct NotesWidgetNote: Equatable {
    enum Kind: Equatable { case note, letter }

    var id: String?
    var kind: Kind = .note
    var title: String?
    var text: String
    var from: String
    var at: Date?
    var opened: Bool
    var openedAt: Date?
    /// Her reaction ("heart" or one emoji), on Josh's copy of a note he sent.
    var reaction: String?
    var link: URL?
    /// The push only carried the start of it; the rest is in the app.
    var truncated: Bool = false
    /// A letter's announcement: the letter's own title.
    var letterTitle: String?

    static func opened(_ note: NotesWidgetNote) -> NotesWidgetNote {
        var copy = note
        copy.opened = true
        return copy
    }

    /// Identifies the note for SwiftUI transitions (a new note → a new paper slides in).
    var key: String { id?.lowercased() ?? "\(kind)-\(Int(at?.timeIntervalSince1970 ?? 0))-\(text.prefix(24))" }

    /// What "peel the tape" marks opened on this phone: the note's id, or for a note without one
    /// (Josh's test notes from admin, which are never saved) its kind and arrival time, so a test opens just like a
    /// real note does. Only real ids are ever sent to the server (KiriyaAPI.openNote checks).
    /// No spaces in it, so nothing on the way (the intent trims its parameter) can change it.
    var openID: String {
        if let id { return id.lowercased() }
        return "local-\(kind)-\(Int(at?.timeIntervalSince1970 ?? 0))"
    }
}

/// What the widget draws.
enum NotesWidgetScene: Equatable {
    /// The app hasn't handed the widgets their key yet (and no note has come by push either).
    case notSetUp
    /// Nothing yet: a blank note waiting.
    case empty
    /// A new note, folded and taped shut: "open me ♡".
    case sealed(NotesWidgetNote)
    /// The note, unfolded and taped down.
    case open(NotesWidgetNote)
    /// A letter came: its announcement, folded, to be opened in the app.
    case letter(NotesWidgetNote)
    /// Josh's phone: the last note he sent her, with "she opened it ♡" once she has.
    case sent(NotesWidgetNote)

    var note: NotesWidgetNote? {
        switch self {
        case .notSetUp, .empty: return nil
        case .sealed(let note), .open(let note), .letter(let note), .sent(let note): return note
        }
    }

    /// Changes whenever a different piece of paper should be passed in (not when the same note
    /// opens, which has its own peel).
    var paperKey: String {
        switch self {
        case .notSetUp: return "setup"
        case .empty: return "empty"
        case .sealed(let note), .open(let note): return "note-\(note.key)"
        case .letter(let note): return "letter-\(note.key)"
        case .sent(let note): return "sent-\(note.key)"
        }
    }

    var isSealed: Bool {
        if case .sealed = self { return true }
        if case .letter = self { return true }
        return false
    }
}

struct NotesWidgetEntry: TimelineEntry {
    let date: Date
    let scene: NotesWidgetScene
    /// Her name on her phone ("Kiriya"); the other person's name ("Josh").
    let me: String
    let other: String
    var relevance: TimelineEntryRelevance? = nil
}

// MARK: - The snapshot's note fields (server/routes/widget.js appSnapshot)

struct NotesWidgetSnapshot: Decodable {
    struct Note: Decodable {
        var id: String?
        var kind: String?
        var title: String?
        var preview: String?
        /// The whole note (new field; older servers send only `preview`).
        var text: String?
        var at: String?
        var opened: Bool?
        var openedAt: String?
        var reaction: String?
        var from: String?
        /// kiriyalove://open/… for this note (or the letter / doodle it announces).
        var link: String?
        /// The note announces a letter.
        var letter: Bool?
        var letterTitle: String?
    }
    struct Links: Decodable { var notes: String? }

    var role: String?
    var me: String?
    var other: String?
    var latestNote: Note?
    /// Josh's phone only: his newest note that has reached her.
    var sentNote: Note?
    var links: Links?

    /// The cached snapshot string KiriyaAPI keeps in the App Group (key "snapshot").
    static func cached(_ defaults: UserDefaults? = NotesWidgetMailbox.defaults) -> NotesWidgetSnapshot? {
        guard let text = defaults?.string(forKey: "snapshot"), let data = text.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(NotesWidgetSnapshot.self, from: data)
    }
}

// MARK: - Working out the scene

enum NotesWidgetResolver {
    struct Input {
        var isSetUp: Bool
        var role: String?
        var snapshot: NotesWidgetSnapshot?
        var pushed: NotesWidgetMailbox.Pushed?
        var openedHere: Set<String>
    }

    static func resolve(_ input: Input) -> (scene: NotesWidgetScene, me: String, other: String) {
        let role = input.snapshot?.role ?? input.role ?? "kiriya"
        let admin = role == "admin"
        let other = nonEmpty(input.snapshot?.other) ?? (admin ? "Kiriya" : "Josh")
        let me = nonEmpty(input.snapshot?.me) ?? (admin ? "Josh" : "Kiriya")
        // Notes to this phone are always from Josh ("from" in the push and the snapshot is his
        // signature name); on his own phone they're his test notes, so they read the same.
        let signer = admin ? me : other

        let fromServer = input.snapshot?.latestNote.map { note(from: $0, signer: signer, notesLink: input.snapshot?.links?.notes) }
        let fromPush = input.pushed.map { note(from: $0, signer: signer) }
        var received = newest(fromServer, fromPush)
        if var note = received, input.openedHere.contains(note.openID) {
            note.opened = true
            received = note
        }

        if admin, let sent = input.snapshot?.sentNote.map({ note(from: $0, signer: me, notesLink: nil) }) {
            // His test notes (sent to himself) show as she'd see them, when they're newer.
            let receivedAt = received?.at ?? .distantPast
            if received == nil || (sent.at ?? .distantPast) > receivedAt {
                return (.sent(sent), me, other)
            }
        }
        if let note = received {
            if note.kind == .letter { return (note.opened ? .open(note) : .letter(note), me, other) }
            return (note.opened ? .open(note) : .sealed(note), me, other)
        }
        if !input.isSetUp { return (.notSetUp, me, other) }
        return (.empty, me, other)
    }

    /// The server's copy and the push's copy of the newest note: the same note merges (the push has
    /// every word at once, the server knows whether it was opened); otherwise the newer one wins.
    static func newest(_ server: NotesWidgetNote?, _ push: NotesWidgetNote?) -> NotesWidgetNote? {
        guard let push else { return server }
        guard let server else { return push }
        let same: Bool
        if let a = server.id?.lowercased(), let b = push.id?.lowercased() {
            same = a == b
        } else {
            // An announcement (no id in its push) or an older server (no id in the snapshot):
            // the same note if it's the same kind and arrived within a few minutes of each other.
            let gap = abs((server.at ?? .distantPast).timeIntervalSince(push.at ?? .distantPast))
            same = server.kind == push.kind && gap < 10 * 60
        }
        if same {
            var merged = server
            if push.text.count > server.text.count, !server.truncated || push.truncated { merged.text = push.text }
            merged.truncated = server.truncated && push.truncated
            merged.letterTitle = server.letterTitle ?? push.letterTitle
            merged.link = server.link ?? push.link
            merged.at = server.at ?? push.at
            return merged
        }
        return (push.at ?? .distantPast) > (server.at ?? .distantPast) ? push : server
    }

    static func note(from note: NotesWidgetSnapshot.Note, signer: String, notesLink: String?) -> NotesWidgetNote {
        let full = nonEmpty(note.text)
        let preview = nonEmpty(note.preview) ?? ""
        let letter = note.letter ?? (note.kind == "update" && (note.link ?? "").contains("/world/letters"))
        return NotesWidgetNote(
            id: note.id,
            kind: letter ? .letter : .note,
            title: nonEmpty(note.title),
            text: full ?? preview,
            from: nonEmpty(note.from) ?? signer,
            at: NotesWidgetDates.parse(note.at),
            opened: note.opened ?? false,
            openedAt: NotesWidgetDates.parse(note.openedAt),
            reaction: nonEmpty(note.reaction),
            link: link(note.link, id: note.id, fallback: notesLink),
            // Only the preview came (an older server): it may stop short.
            truncated: full == nil && preview.hasSuffix("…"),
            letterTitle: nonEmpty(note.letterTitle) ?? (letter ? quoted(in: preview) : nil))
    }

    static func note(from pushed: NotesWidgetMailbox.Pushed, signer: String) -> NotesWidgetNote {
        let letter = pushed.kind == "letter"
        return NotesWidgetNote(
            id: pushed.id,
            kind: letter ? .letter : .note,
            title: pushed.title,
            text: pushed.text,
            from: pushed.from ?? signer,
            at: Date(timeIntervalSince1970: pushed.receivedAt),
            opened: false,
            link: link(pushed.navigate.map { "kiriyalove://open\($0)" }, id: pushed.id, fallback: nil),
            truncated: pushed.truncated ?? false,
            letterTitle: pushed.letterTitle ?? (letter ? quoted(in: pushed.text) : nil))
    }

    /// kiriyalove://open/world/notes?open=<id>, unless the note goes somewhere of its own.
    static func link(_ raw: String?, id: String?, fallback: String?) -> URL? {
        if let raw, let url = URL(string: raw), url.scheme == "kiriyalove" { return url }
        if let id, UUID(uuidString: id) != nil { return URL(string: "kiriyalove://open/world/notes?open=\(id.lowercased())") }
        if let fallback, let url = URL(string: fallback), url.scheme == "kiriyalove" { return url }
        return URL(string: "kiriyalove://open/world/notes")
    }

    /// “three months” is waiting in your letters ♡ → three months
    static func quoted(in text: String) -> String? {
        guard let start = text.firstIndex(of: "“"), let end = text[text.index(after: start)...].firstIndex(of: "”") else { return nil }
        return nonEmpty(String(text[text.index(after: start)..<end]))
    }

    static func nonEmpty(_ text: String?) -> String? {
        guard let text = text?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
        return text
    }
}

// MARK: - "just now", "this morning", "last night"…

enum NotesWidgetDates {
    static func parse(_ text: String?) -> Date? {
        guard let text else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: text) { return date }
        return ISO8601DateFormatter().date(from: text)
    }

    /// How long ago, the way you'd write it on a note. Her phone's own time zone.
    static func phrase(_ date: Date?, now: Date, calendar: Calendar = .current) -> String? {
        guard let date else { return nil }
        let seconds = now.timeIntervalSince(date)
        if seconds < 2 * 60 { return "just now" }
        if seconds < 15 * 60 { return "a few minutes ago" }
        if seconds < 60 * 60 { return "a little while ago" }
        let hour = calendar.component(.hour, from: date)
        if calendar.isDate(date, inSameDayAs: now) {
            switch hour {
            case ..<4: return "last night"
            case ..<12: return "this morning"
            case ..<17: return "this afternoon"
            case ..<21: return "this evening"
            default: return "tonight"
            }
        }
        if calendar.isDate(date, inSameDayAs: calendar.date(byAdding: .day, value: -1, to: now) ?? now) {
            return hour >= 20 && calendar.component(.hour, from: now) < 12 ? "last night" : "yesterday"
        }
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: now)).day ?? 99
        let format = DateFormatter()
        format.locale = Locale(identifier: "en_GB")
        format.timeZone = calendar.timeZone
        format.dateFormat = days < 7 ? "'on' EEEE" : "'on' d MMM"
        return format.string(from: date)
    }

    /// "9:41 pm"
    static func clock(_ date: Date?, calendar: Calendar = .current) -> String? {
        guard let date else { return nil }
        let format = DateFormatter()
        format.locale = Locale(identifier: "en_US_POSIX")
        format.timeZone = calendar.timeZone
        format.dateFormat = "h:mm a"
        format.amSymbol = "am"
        format.pmSymbol = "pm"
        return format.string(from: date)
    }

    /// The moments in [from, until] where any of these phrases changes, so the timeline can hold
    /// one entry per change instead of reloading.
    static func changes(for dates: [Date?], from start: Date, until end: Date, limit: Int = 24) -> [Date] {
        let dates = dates.compactMap { $0 }
        guard !dates.isEmpty else { return [] }
        var candidates: [Date] = []
        for date in dates {
            for offset in [2.0, 15, 60].map({ $0 * 60 }) { candidates.append(date.addingTimeInterval(offset + 1)) }
        }
        var probe = start
        while probe < end {
            candidates.append(probe)
            probe = probe.addingTimeInterval(15 * 60)
        }
        let calendar = Calendar.current
        var hourMarks = calendar.dateInterval(of: .hour, for: start)?.end ?? start
        while hourMarks < end {
            candidates.append(hourMarks.addingTimeInterval(1))
            hourMarks = hourMarks.addingTimeInterval(3600)
        }
        var result: [Date] = []
        var last = dates.map { phrase($0, now: start) }
        for candidate in candidates.filter({ $0 > start && $0 <= end }).sorted() {
            let now = dates.map { phrase($0, now: candidate) }
            if now != last {
                result.append(candidate)
                last = now
                if result.count >= limit { break }
            }
        }
        return result
    }
}
