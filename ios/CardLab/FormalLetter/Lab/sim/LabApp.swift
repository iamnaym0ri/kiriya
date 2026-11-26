import SwiftUI
import UIKit

// The lab's iOS app (simulator only): the real FormalLetterCard, live, hosted the way the
// notification hosts a card (top-anchored, the container following the card's reported height
// with an animated resize, on a dark notification backdrop, the action rows under it), plus an
// iOS ImageRenderer pass for comparing with the macOS frames.
//
// Launch arguments (xcrun simctl launch … -letter medium -width 343 -autoOpen 2.5):
//   -letter <name>   -width <pt>   -autoOpen <s>   -springFlip 1   -scrollable 0|1
//   -autoScroll <s>  (scrolls the open letter's body to the end and back, to watch it live)
//   -retap <s>       (taps the card again, e.g. a locked one)   -render <dir>

private func argument(_ name: String) -> String? {
    let args = ProcessInfo.processInfo.arguments
    guard let index = args.firstIndex(of: "-\(name)"), index + 1 < args.count else { return nil }
    return args[index + 1]
}

@main
struct FormalLabApp: App {
    init() {
        if let dir = argument("render") {
            DispatchQueue.main.async { LabIOSRender.run(dir: dir) }
        }
    }

    var body: some Scene {
        WindowGroup { LabHost() }
    }
}

struct LabHost: View {
    @State private var isOpen = false
    @State private var cardHeight: CGFloat = 320
    @State private var taps = 0
    @State private var reports = 0
    @State private var heights: [Int] = []
    private let content = LabFixtures.named(argument("letter") ?? "medium")
    private let width = CGFloat(Double(argument("width") ?? "") ?? 0)
    private let scrollable = argument("scrollable") != "0"

    var body: some View {
        GeometryReader { proxy in
            let cardWidth = width > 0 ? width : proxy.size.width - 16
            ZStack(alignment: .top) {
                Color(white: 0.08).ignoresSafeArea()
                VStack(spacing: 8) {
                    // The notification's expanded content area: it grows to what the card reports.
                    FormalLetterCard(content: content, isOpen: isOpen, onTapSealed: {
                        taps += 1
                        flip()
                    }, scrollable: scrollable, maxHeight: 700)
                    .fixedSize(horizontal: false, vertical: true)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                        reports += 1
                        heights.append(Int(height))
                        withAnimation(.easeInOut(duration: 0.35)) { cardHeight = min(720, height) }
                    }
                    .frame(width: cardWidth, height: cardHeight, alignment: .top)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

                    VStack(spacing: 0) {
                        ForEach(isOpen ? ["Send one back ❤️", "Open in app"] : ["Open letter 💌", "Send one back ❤️", "Open in app"], id: \.self) { title in
                            Text(title).font(.system(size: 16)).foregroundStyle(.white)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 16).padding(.vertical, 10)
                                .contentShape(Rectangle())
                                .onTapGesture { if title.hasPrefix("Open letter") { flip() } }
                            Divider().background(Color.white.opacity(0.15))
                        }
                    }
                    .frame(width: cardWidth)
                    .background(Color(white: 0.18), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    Text("taps \(taps) · open \(isOpen ? "yes" : "no") · height \(Int(cardHeight)) · reports \(reports) \(heights.map(String.init).joined(separator: ","))")
                        .font(.system(size: 10, design: .monospaced)).foregroundStyle(.gray)
                    TimelineView(.animation) { context in
                        Text(String(format: "clock %.2f", context.date.timeIntervalSince(LabFrameLog.launch)))
                            .font(.system(size: 14, weight: .bold, design: .monospaced)).foregroundStyle(.yellow)
                    }
                }
                .padding(.top, 50)
            }
        }
        .onAppear {
            LabFrameLog.shared.start()
            if let delay = Double(argument("autoOpen") ?? "") {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    print(String(format: "  flip at t=%5.3f", CACurrentMediaTime() - LabFrameLog.shared.originTime))
                    flip()
                    // -snap "3.1,3.6" -snapDir <dir>: window snapshots at those seconds after the flip.
                    for spec in (argument("snap") ?? "").split(separator: ",") {
                        guard let at = Double(spec) else { continue }
                        DispatchQueue.main.asyncAfter(deadline: .now() + at) { LabTouch.snapshot(name: "snap-\(spec)") }
                    }
                }
            }
            if let delay = Double(argument("retap") ?? "") {
                // A tap on the card itself (what a locked letter answers with its "not yet").
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { LabTouch.tapCard() }
            }
            if let delay = Double(argument("autoScroll") ?? "") {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { LabTouch.scrollLetter() }
            }
        }
    }

    private func flip() {
        // -springFlip 1: flip it the way NoteCardModel.openEnvelope does (inside withAnimation(.spring)).
        if argument("springFlip") == "1" {
            withAnimation(.spring(response: 0.55, dampingFraction: 0.78)) { isOpen = true }
        } else {
            isOpen = true
        }
    }
}

/// Lab-only helpers that reach into UIKit to drive the card like a finger would.
@MainActor
enum LabTouch {
    static func scrollViews(_ view: UIView) -> [UIScrollView] {
        var found: [UIScrollView] = []
        if let scroll = view as? UIScrollView { found.append(scroll) }
        for sub in view.subviews { found += scrollViews(sub) }
        return found
    }

    static var window: UIWindow? {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.windows.first }.first
    }

    /// Scrolls the letter's body to its end over ~2.4 s, holds, and back to the top.
    static func scrollLetter() {
        guard let window, let scroll = scrollViews(window).first(where: { $0.contentSize.height > $0.bounds.height + 1 }) else {
            print("autoScroll: no scrolling body found")
            return
        }
        let end = scroll.contentSize.height - scroll.bounds.height + scroll.adjustedContentInset.bottom
        print("autoScroll: content \(scroll.contentSize.height) window \(scroll.bounds.height) → \(end) inset \(scroll.contentInset) adjusted \(scroll.adjustedContentInset) subviews \(scroll.subviews.map { "\(type(of: $0)) \($0.frame)" })")
        let steps = 180
        for step in 0...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(step) / 60) {
                let u = Double(step) / Double(steps)
                let eased = u * u * (3 - 2 * u)
                scroll.setContentOffset(CGPoint(x: 0, y: CGFloat(eased) * end), animated: false)
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { scroll.setContentOffset(.zero, animated: true) }
    }

    static func snapshot(name: String) {
        guard let window, let dir = argument("snapDir") else { return }
        let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in
            window.drawHierarchy(in: window.bounds, afterScreenUpdates: false)
        }
        do {
            try image.pngData()?.write(to: URL(fileURLWithPath: "\(dir)/\(name).png"))
            print("snapshot \(name) \(image.size)")
        } catch {
            print("snapshot \(name) failed: \(error)")
        }
    }

    static func tapCard() {
        // There's no public way to synthesise a touch; the lab re-sends the tap through the card's
        // accessibility action, which runs the same code as a tap.
        guard let window else { return }
        func find(_ view: UIView) -> NSObject? {
            for element in (view.accessibilityElements ?? []) {
                if let object = element as? NSObject, (object.accessibilityLabel ?? "").contains("letter") { return object }
            }
            for sub in view.subviews { if let hit = find(sub) { return hit } }
            return nil
        }
        if let element = find(window) {
            print("retap: \(element.accessibilityLabel ?? "")")
            _ = element.accessibilityActivate()
        } else {
            print("retap: card element not found")
        }
    }
}

@MainActor
enum LabIOSRender {
    static func run(dir: String) {
        try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        let started = Date()
        for name in ["short", "medium", "locked", "maomao"] {
            let content = LabFixtures.named(name)
            let locked = LabFixtures.isLocked(name)
            for width in [343.0, 393.0] {
                for (label, time) in [("sealed", nil), ("rest", FormalLetterGeometry.duration)] as [(String, Double?)] {
                    if locked && label == "rest" { continue }
                    if let image = LabRender.image(LabRender.scene(content, width: width, time: time, idle: 0, locked: locked), scale: 3) {
                        LabRender.writePNG(image, to: "\(dir)/ios-\(name)-\(Int(width))-\(label).png")
                    }
                }
            }
        }
        let content = LabFixtures.medium
        let g = LabRender.geometry(content, width: 343, locked: false)
        var frames: [(String, CGImage)] = []
        for t in stride(from: 0.0, through: 3.2, by: 0.2) {
            if let image = LabRender.image(LabRender.scene(content, width: 343, time: t, idle: 0, height: g.openHeight), scale: 1) {
                frames.append((String(format: "t=%.1f", t), image))
            }
        }
        if let sheet = LabRender.sheet(frames, columns: 9) { LabRender.writePNG(sheet, to: "\(dir)/ios-sheet-medium-343.png") }
        // How long one frame's pose takes (the per-frame cost while animating), and a whole-letter layout.
        let probeStart = Date()
        var sink = 0.0
        for f in 0..<600 {
            let pose = g.pose(time: Double(f) / 600 * 3.2, idle: 1)
            sink += Double(pose.paperCenter.y)
        }
        let poseMicros = Date().timeIntervalSince(probeStart) / 600 * 1_000_000
        let layoutStart = Date()
        let huge = FormalLetterGeometry.make(content: LabFixtures.huge, width: 343)
        let layoutMillis = Date().timeIntervalSince(layoutStart) * 1000
        let report = "rendered in \(String(format: "%.1f", Date().timeIntervalSince(started)))s; pose() \(String(format: "%.1f", poseMicros))µs/frame (\(Int(sink) % 7)); 20k-char layout \(String(format: "%.0f", layoutMillis))ms (\(huge.paper.lines.count) lines, content \(huge.paper.scrollContentHeight)pt); fonts bundled: \(FormalLetterFonts.isBundled(.text)) \(FormalLetterFonts.isBundled(.script))\n"
        try? report.write(toFile: "\(dir)/ios-report.txt", atomically: true, encoding: .utf8)
        print(report)
        exit(0)
    }
}

/// Logs the longest gap between displayed frames, every half second (to spot stalls).
final class LabFrameLog: NSObject {
    static let shared = LabFrameLog()
    static let launch = Date()
    private var link: CADisplayLink?
    private var last: CFTimeInterval = 0
    private var worst: CFTimeInterval = 0
    private var frames = 0
    private var windowStart: CFTimeInterval = 0
    private let origin = CACurrentMediaTime()
    var originTime: CFTimeInterval { origin }

    func start() {
        guard link == nil else { return }
        link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link?.add(to: .main, forMode: .common)
    }

    @objc private func tick(_ link: CADisplayLink) {
        let now = link.timestamp
        if last > 0 { worst = max(worst, now - last) }
        if last > 0, now - last > 0.025 {
            print(String(format: "  gap %5.1fms ending at t=%5.3f", (now - last) * 1000, now - origin))
        }
        last = now
        frames += 1
        if windowStart == 0 { windowStart = now }
        if now - windowStart >= 0.5 {
            print(String(format: "t=%5.2f frames=%3d worst gap=%6.1fms", now - origin, frames, worst * 1000))
            frames = 0; worst = 0; windowStart = now
        }
    }
}
