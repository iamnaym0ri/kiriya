import SwiftUI
import UIKit

// The lab's iOS app (simulator): the real LetterCard, live, hosted like the notification hosts it
// (top-anchored, the container following the card's reported height with an animated resize, on a
// dark notification backdrop), plus an iOS ImageRenderer pass for comparing with the macOS frames.
//
// Launch arguments (xcrun simctl launch … -note medium -width 343 -autoOpen 2.5):
//   -note short|medium|long|nobyline   -width <pt>   -autoOpen <seconds>   -render <dir>

private func argument(_ name: String) -> String? {
    let args = ProcessInfo.processInfo.arguments
    guard let index = args.firstIndex(of: "-\(name)"), index + 1 < args.count else { return nil }
    return args[index + 1]
}

@main
struct LetterLabApp: App {
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
    @State private var cardHeight: CGFloat = 274
    @State private var taps = 0
    @State private var reports = 0
    private let content = LabFixtures.named(argument("note") ?? "medium")
    private let width = CGFloat(Double(argument("width") ?? "") ?? 0)

    var body: some View {
        GeometryReader { proxy in
            let cardWidth = width > 0 ? width : proxy.size.width - 32
            ZStack(alignment: .top) {
                Color(white: 0.08).ignoresSafeArea()
                VStack(spacing: 10) {
                    // The notification's expanded content area: it grows to what the card reports.
                    LetterCard(content: content, isOpen: isOpen, onTapSealed: {
                        taps += 1
                        isOpen = true
                    })
                    .fixedSize(horizontal: false, vertical: true)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                        reports += 1
                        withAnimation(.easeInOut(duration: 0.35)) { cardHeight = min(720, height) }
                    }
                    .frame(width: cardWidth, height: cardHeight, alignment: .top)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

                    VStack(spacing: 0) {
                        ForEach(isOpen ? ["Send one back ❤️", "Open in app"] : ["Open note 💌", "Send one back ❤️", "Open in app"], id: \.self) { title in
                            Text(title).font(.system(size: 17)).foregroundStyle(.white)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 16).padding(.vertical, 12)
                                .contentShape(Rectangle())
                                .onTapGesture { if title.hasPrefix("Open note") { isOpen = true } }
                            Divider().background(Color.white.opacity(0.15))
                        }
                    }
                    .frame(width: cardWidth)
                    .background(Color(white: 0.18), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    Text("taps \(taps) · open \(isOpen ? "yes" : "no") · height \(Int(cardHeight)) · reports \(reports)")
                        .font(.system(size: 11, design: .monospaced)).foregroundStyle(.gray)
                    // An independent clock: if this keeps ticking while the card freezes, the card's
                    // own timeline stopped; if both freeze, the simulator's renderer fell behind.
                    TimelineView(.animation) { context in
                        Text(String(format: "clock %.2f", context.date.timeIntervalSince(LabFrameLog.launch)))
                            .font(.system(size: 22, weight: .bold, design: .monospaced)).foregroundStyle(.yellow)
                    }
                }
                .padding(.top, 54)
            }
        }
        .onAppear {
            LabFrameLog.shared.start()
            if let delay = Double(argument("autoOpen") ?? "") {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    // -springFlip 1: flip it the way NoteCardModel.openEnvelope does today.
                    if argument("springFlip") == "1" {
                        withAnimation(.spring(response: 0.55, dampingFraction: 0.78)) { isOpen = true }
                    } else {
                        isOpen = true
                    }
                }
            }
        }
    }
}

@MainActor
enum LabIOSRender {
    static func run(dir: String) {
        try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        let started = Date()
        for (name, content) in LabFixtures.all {
            for width in [343.0, 393.0] {
                for (label, time) in [("sealed", nil), ("rest", LetterGeometry.duration)] as [(String, Double?)] {
                    if let image = LabRender.image(LabRender.scene(content, width: width, time: time, idle: 0), scale: 3) {
                        LabRender.writePNG(image, to: "\(dir)/ios-\(name)-\(Int(width))-\(label).png")
                    }
                }
            }
        }
        let content = LabFixtures.medium
        let g = LetterGeometry.make(content: content, width: 343)
        var frames: [(String, CGImage)] = []
        for t in stride(from: 0.0, through: 2.8, by: 0.2) {
            if let image = LabRender.image(LabRender.scene(content, width: 343, time: t, idle: 0, height: g.openHeight), scale: 1) {
                frames.append((String(format: "t=%.1f", t), image))
            }
        }
        if let sheet = LabRender.sheet(frames, columns: 8) { LabRender.writePNG(sheet, to: "\(dir)/ios-sheet-medium-343.png") }
        // How long one frame's pose + view takes to build (the per-frame cost while animating).
        let probeStart = Date()
        var sink = 0.0
        for f in 0..<600 {
            let pose = g.pose(time: Double(f) / 600 * 2.8, idle: 1)
            sink += Double(pose.paperCenter.y)
        }
        let poseMicros = Date().timeIntervalSince(probeStart) / 600 * 1_000_000
        let report = "rendered in \(String(format: "%.1f", Date().timeIntervalSince(started)))s; pose() \(String(format: "%.1f", poseMicros))µs/frame (\(Int(sink) % 7)); fonts bundled: \(LetterFonts.isBundled(.hand)) \(LetterFonts.isBundled(.script))\n"
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

    func start() {
        guard link == nil else { return }
        link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link?.add(to: .main, forMode: .common)
    }

    @objc private func tick(_ link: CADisplayLink) {
        let now = link.timestamp
        if last > 0 { worst = max(worst, now - last) }
        last = now
        frames += 1
        if windowStart == 0 { windowStart = now }
        if now - windowStart >= 0.5 {
            print(String(format: "t=%5.2f frames=%3d worst gap=%6.1fms", now - origin, frames, worst * 1000))
            frames = 0; worst = 0; windowStart = now
        }
    }
}
