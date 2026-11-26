import SwiftUI
import WidgetKit

// The con widget's lab app (built with swiftc by ../sim.sh, no Xcode project).
//   -render <dir> [-only a,b]   run the model checks, render every scenario (boards, optional tiles) and quit
//   -checks                     just the model checks (ConLabChecks)
//   -reload                     ask WidgetKit for fresh timelines and quit (tools/demo.sh)
//   (no arguments)              a live page: the demo ticket counting down to a midnight staged
//                               25 s after launch, so the switch to "today!!" can be recorded.

@main
struct ConLabApp: App {
    init() {
        ConWidgetFonts.searchDirectories = [Bundle.main.bundleURL]
        let args = ProcessInfo.processInfo.arguments
        if let index = args.firstIndex(of: "-render"), index + 1 < args.count {
            let out = URL(fileURLWithPath: args[index + 1])
            var only: Set<String>?
            if let o = args.firstIndex(of: "-only"), o + 1 < args.count { only = Set(args[o + 1].split(separator: ",").map(String.init)) }
            DispatchQueue.main.async {
                MainActor.assumeIsolated {
                    ConLabChecks.run()
                    ConLabRenderer.renderAll(to: out, only: only, tiles: args.contains("-tiles"))
                    if args.contains("-overview") { ConLabOverview.render(to: out) }
                    print("done")
                    exit(0)
                }
            }
        } else if let index = args.firstIndex(of: "-overview"), index + 1 < args.count {
            let out = URL(fileURLWithPath: args[index + 1])
            DispatchQueue.main.async {
                MainActor.assumeIsolated {
                    ConLabOverview.render(to: out)
                    print("done")
                    exit(0)
                }
            }
        } else if args.contains("-checks") {
            ConLabChecks.run()
            exit(ConLabChecks.failures == 0 ? 0 : 1)
        } else if args.contains("-reload") {
            // Asks WidgetKit for fresh timelines (tools/demo.sh), then gets out of the way.
            WidgetCenter.shared.reloadAllTimelines()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { exit(0) }
        } else {
            ConLabDemo.stage(secondsToMidnight: Double(args.firstIndex(of: "-in").flatMap { Double(args[$0 + 1]) } ?? 25))
        }
    }

    var body: some Scene {
        WindowGroup { ConLabLive() }
    }
}

/// The live page: entries switch at their dates like WidgetKit does (TimelineView with explicit dates).
struct ConLabLive: View {
    var body: some View {
        let feed = ConLabDemo.feed()
        let start = Date()
        let dates = ConWidgetTimeline.dates(for: feed, from: start, ringHours: false)
        TimelineView(.explicit(dates)) { context in
            let entry = ConWidgetEntry(date: dates.last(where: { $0 <= context.date }) ?? start, feed: feed, state: .ready)
            let moment = ConWidgetMoment(events: feed.events, at: entry.date)
            ScrollView {
                VStack(spacing: 18) {
                    HStack(spacing: 18) {
                        tile(.systemSmall, entry, moment, CGSize(width: 169, height: 169))
                        tile(.systemSmall, entry, moment, CGSize(width: 169, height: 169), dark: true)
                    }
                    tile(.systemMedium, entry, moment, CGSize(width: 360, height: 169))
                    tile(.systemLarge, entry, moment, CGSize(width: 360, height: 376))
                }
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity)
            }
            .background(ConLabWall())
            .animation(.smooth(duration: 0.6), value: entry.date)
        }
    }

    private func tile(_ family: WidgetFamily, _ entry: ConWidgetEntry, _ moment: ConWidgetMoment, _ size: CGSize, dark: Bool = false) -> some View {
        let look = ConWidgetLook(mode: dark ? .dark : .light)
        return ZStack {
            ConWidgetBackdrop(family: family, look: look)
            ConWidgetFace(family: family, entry: entry, moment: moment, look: look)
        }
        .frame(width: size.width, height: size.height)
        .clipShape(RoundedRectangle(cornerRadius: 21.67, style: .continuous))
        .environment(\.colorScheme, dark ? .dark : .light)
    }
}
