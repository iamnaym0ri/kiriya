import Foundation
import WidgetKit

// The little note's timeline. Its own provider (the other widgets keep KiriyaProvider), because:
// - a note that came by push (NotesWidgetMailbox) shows at once, before any network fetch;
// - it fetches a fresh snapshot when the cached one is more than a few seconds old, so a note she
//   has just opened in the app never shows sealed again (the shared 60 s cache could);
// - one entry per change of "just now / a few minutes ago / this morning…", so the words stay true
//   without spending reloads;
// - a sealed note asks the Smart Stack to come to the front (relevance).

struct NotesWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> NotesWidgetEntry {
        NotesWidgetSamples.entry(.open, date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (NotesWidgetEntry) -> Void) {
        if context.isPreview {
            // The widget gallery: a sweet example, never her real note.
            completion(NotesWidgetSamples.entry(.open, date: Date()))
            return
        }
        completion(Self.entry(at: Date(), input: Self.localInput()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NotesWidgetEntry>) -> Void) {
        Task {
            // A note a push just handed over is shown at once: no network first (it carries every
            // word). The server's view of it (opened yet?) is merged a minute and a half later.
            let justPushed = Self.pushNewerThanSnapshot()
            let input = justPushed ? Self.localInput() : await Self.freshInput()
            let now = Date()
            let first = Self.entry(at: now, input: input)

            // While Josh waits for her to open his note, look a little more often.
            let waiting: Bool = { if case .sent(let note) = first.scene { return !note.opened } else { return false } }()
            let refresh = now.addingTimeInterval(justPushed ? 90 : waiting ? 20 * 60 : 40 * 60)
            let horizon = now.addingTimeInterval(24 * 3600)
            var entries = [first]
            if justPushed {
                // Two steps: first exactly what was on her Home Screen, then, a moment later, the new
                // note. A change between two entries of one timeline is what WidgetKit animates with
                // the widget's own transitions (a reload on its own may just cross-fade), so this is
                // what lets the note be passed in.
                var before = input
                before.pushed = NotesWidgetMailbox.previous()
                let shown = Self.entry(at: now, input: before)
                if shown.scene.paperKey != first.scene.paperKey {
                    entries = [shown, Self.entry(at: now.addingTimeInterval(Self.passDelay), input: input)]
                }
            }
            let from = entries.last?.date ?? now
            for date in NotesWidgetDates.changes(for: [first.scene.note?.at], from: from, until: horizon) {
                entries.append(Self.entry(at: date, input: input))
            }
            completion(Timeline(entries: entries, policy: .after(refresh)))
            // After the widget has its timeline, so a slow network never holds it back.
            if !justPushed { await Self.catchUpOpened(first.scene) }
        }
    }

    // MARK: building

    /// How long after a push's reload the new note is passed in (see getTimeline).
    static let passDelay: TimeInterval = 1.2

    static func entry(at date: Date, input: NotesWidgetResolver.Input) -> NotesWidgetEntry {
        let resolved = NotesWidgetResolver.resolve(input)
        return NotesWidgetEntry(date: date, scene: resolved.scene, me: resolved.me, other: resolved.other,
                                relevance: relevance(resolved.scene, now: date))
    }

    static func relevance(_ scene: NotesWidgetScene, now: Date) -> TimelineEntryRelevance {
        switch scene {
        case .sealed: return TimelineEntryRelevance(score: 100, duration: 8 * 3600)
        case .letter: return TimelineEntryRelevance(score: 90, duration: 8 * 3600)
        case .open(let note):
            let fresh = now.timeIntervalSince(note.at ?? .distantPast) < 3 * 3600
            return TimelineEntryRelevance(score: fresh ? 40 : 5)
        case .sent(let note):
            let recent = now.timeIntervalSince(note.openedAt ?? .distantPast) < 2 * 3600
            return TimelineEntryRelevance(score: recent ? 50 : 5)
        case .empty, .notSetUp: return TimelineEntryRelevance(score: 0)
        }
    }

    // MARK: data

    /// What's on the phone right now (no network).
    static func localInput() -> NotesWidgetResolver.Input {
        NotesWidgetResolver.Input(
            isSetUp: KiriyaAPI.isSetUp,
            role: KiriyaGroup.defaults?.string(forKey: KiriyaGroup.role),
            snapshot: NotesWidgetSnapshot.cached(),
            pushed: NotesWidgetMailbox.latest(),
            openedHere: NotesWidgetMailbox.openedIDs())
    }

    /// The same, after a fresh snapshot (unless one landed in the last 3 seconds: the four
    /// widgets reload together and can share it). A slow network gets 4 seconds, then the cached
    /// one stands (as it does offline).
    static func freshInput() async -> NotesWidgetResolver.Input {
        if KiriyaAPI.isSetUp {
            await withTaskGroup(of: Void.self) { group in
                group.addTask { _ = await KiriyaAPI.freshSnapshot(maxAge: 3) }
                group.addTask { try? await Task.sleep(nanoseconds: 4_000_000_000) }
                _ = await group.next()
                group.cancelAll()
            }
        }
        return localInput()
    }

    /// A push handed over a note in the last 75 seconds that the cached snapshot (fetched before
    /// it landed) can't know about yet.
    static func pushNewerThanSnapshot(now: Date = Date()) -> Bool {
        guard let pushed = NotesWidgetMailbox.latest() else { return false }
        let fetched = KiriyaGroup.defaults?.object(forKey: KiriyaGroup.snapshotFetchedAt) as? Double ?? 0
        return pushed.receivedAt > fetched && now.timeIntervalSince1970 - pushed.receivedAt < 75
    }

    /// A note peeled on the widget while the server couldn't be reached: tell it now.
    static func catchUpOpened(_ scene: NotesWidgetScene) async {
        guard case .open(let note) = scene, let id = note.id, KiriyaAPI.isSetUp,
              NotesWidgetMailbox.isOpened(id), NotesWidgetSnapshot.cached()?.latestNote?.id?.lowercased() == id.lowercased(),
              NotesWidgetSnapshot.cached()?.latestNote?.opened == false else { return }
        await withTaskGroup(of: Void.self) { group in
            group.addTask { try? await KiriyaAPI.openNote(id) }
            group.addTask { try? await Task.sleep(nanoseconds: 3_000_000_000) }
            _ = await group.next()
            group.cancelAll()
        }
    }
}

// MARK: - Sample notes (the widget gallery, placeholders, previews and the render lab)

enum NotesWidgetSamples {
    enum Kind { case sealed, open, long, title, letter, sentOpened, sentWaiting, sentLoved, empty, notSetUp, short, emptyAdmin }

    static let shortText = "good morning, beautiful ☀️ drink some water for me"
    static let mediumText = "I know today felt long, but I'm so proud of how hard you worked. Go get bubble tea, put your feet up and don't think about revision for one whole evening. I'll call you at nine 💜"
    static let longText = """
    I keep thinking about Saturday, the way you laughed so hard at the cat in the window that the lady at the next table started laughing too. You make ordinary places feel like somewhere I want to remember.

    I know this week is a lot, so here's your reminder: eat something warm, sleep before midnight, and don't let anyone make you feel small. You are so loved, more than this little note can hold, and I'll be right here when you get home.
    """

    static func note(_ kind: Kind, date: Date) -> NotesWidgetNote {
        let id = "6f1c2a3e-4b5d-4c6e-8f70-9a1b2c3d4e5f"
        switch kind {
        case .long:
            return NotesWidgetNote(id: id, title: "for after your exam", text: longText, from: "Josh", at: date.addingTimeInterval(-3 * 3600), opened: true)
        case .title:
            return NotesWidgetNote(id: id, title: "for after your exam", text: mediumText, from: "Josh", at: date.addingTimeInterval(-40), opened: true)
        case .short:
            return NotesWidgetNote(id: id, title: nil, text: "love you, sleepyhead ♡", from: "Josh", at: date.addingTimeInterval(-6 * 60), opened: true)
        case .letter:
            return NotesWidgetNote(id: id, kind: .letter, title: "a new letter for you ✉", text: "“three months” is waiting in your letters ♡",
                                   from: "Josh", at: date.addingTimeInterval(-60), opened: false, letterTitle: "three months")
        case .sentOpened, .sentWaiting, .sentLoved:
            return NotesWidgetNote(id: id, title: nil, text: shortText, from: "Josh", at: date.addingTimeInterval(-2.5 * 3600),
                                   opened: kind != .sentWaiting, openedAt: date.addingTimeInterval(-50 * 60),
                                   reaction: kind == .sentLoved ? "heart" : nil)
        default:
            return NotesWidgetNote(id: id, title: nil, text: shortText, from: "Josh", at: date.addingTimeInterval(-30), opened: kind != .sealed)
        }
    }

    static func entry(_ kind: Kind, date: Date) -> NotesWidgetEntry {
        let admin = [.sentOpened, .sentWaiting, .sentLoved, .emptyAdmin].contains(kind)
        let scene: NotesWidgetScene
        switch kind {
        case .sealed: scene = .sealed(note(.sealed, date: date))
        case .letter: scene = .letter(note(.letter, date: date))
        case .sentOpened, .sentWaiting, .sentLoved: scene = .sent(note(kind, date: date))
        case .empty, .emptyAdmin: scene = .empty
        case .notSetUp: scene = .notSetUp
        default: scene = .open(note(kind, date: date))
        }
        return NotesWidgetEntry(date: date, scene: scene, me: admin ? "Josh" : "Kiriya", other: admin ? "Kiriya" : "Josh")
    }
}
