import SwiftUI
import WidgetKit

// One timeline for every kiriya.love widget: the latest snapshot from the server (or the last one
// saved, when the phone is offline), refreshed about every half hour. After a "thinking of you"
// button press, a second entry a minute later takes the "sent ♡" moment away again.

struct KiriyaEntry: TimelineEntry {
    let date: Date
    let snapshot: KiriyaSnapshot
    /// The emoji of a tap sent in the last minute.
    let sentTap: String?
    /// False until the app has been opened once and handed the widgets their key.
    let isSetUp: Bool
}

struct KiriyaProvider: TimelineProvider {
    func placeholder(in context: Context) -> KiriyaEntry {
        KiriyaEntry(date: Date(), snapshot: .sample, sentTap: nil, isSetUp: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (KiriyaEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
            return
        }
        let now = Date()
        completion(KiriyaEntry(date: now, snapshot: KiriyaAPI.cachedSnapshot() ?? .sample,
                               sentTap: KiriyaStore.recentTap(now: now), isSetUp: KiriyaAPI.isSetUp))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<KiriyaEntry>) -> Void) {
        Task {
            let setUp = KiriyaAPI.isSetUp
            let snapshot = setUp ? await KiriyaAPI.freshSnapshot() : nil
            let now = Date()
            var entries = [KiriyaEntry(date: now, snapshot: snapshot ?? .sample, sentTap: KiriyaStore.recentTap(now: now), isSetUp: setUp)]
            if let sent = KiriyaStore.lastTapDate(), now.timeIntervalSince(sent) < 60 {
                entries.append(KiriyaEntry(date: sent.addingTimeInterval(60), snapshot: snapshot ?? .sample, sentTap: nil, isSetUp: setUp))
            }
            completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(30 * 60))))
        }
    }
}
