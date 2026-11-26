import CoreText
import ImageIO
import SwiftUI
import UniformTypeIdentifiers

// The jar card's lab. Launched with `-render <dir> [-only a,b]` it renders every scenario's frames
// (ImageRenderer, 3x) into <dir> and quits; otherwise it hosts the live JarCard the way the content
// extension does (natural height → an animated "platter" height, the action buttons below), and
// `-autoplay` walks through pull → pull another → a failure on its own for screen recording.

@main
struct JarLabApp: App {
    init() {
        // Lab only: this simulator runtime ships Apple Color Emoji only as CoreAddition/AppleColorEmoji-160px.ttc
        // (iOS looks for Core/AppleColorEmoji.ttc), so emoji in notes would draw as boxes. Devices are fine.
        let emoji = URL(fileURLWithPath: "/System/Library/Fonts/CoreAddition/AppleColorEmoji-160px.ttc")
        if FileManager.default.fileExists(atPath: emoji.path) {
            CTFontManagerRegisterFontsForURL(emoji as CFURL, .process, nil)
        }
        let args = ProcessInfo.processInfo.arguments
        if let index = args.firstIndex(of: "-render"), index + 1 < args.count {
            let out = args[index + 1]
            let only = args.firstIndex(of: "-only").flatMap { $0 + 1 < args.count ? Set(args[$0 + 1].split(separator: ",").map(String.init)) : nil }
            DispatchQueue.main.async {
                LabRenderer.run(out: URL(fileURLWithPath: out), only: only)
                exit(0)
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            LabHost(autoplay: ProcessInfo.processInfo.arguments.contains("-autoplay"),
                    width: ProcessInfo.processInfo.arguments.firstIndex(of: "-width").flatMap { Double(ProcessInfo.processInfo.arguments[$0 + 1]) } ?? 0)
        }
    }
}

// MARK: - Rendering frames

@MainActor
enum LabRenderer {
    static let widths: [CGFloat] = [343, 393]
    static let actionsHeight: CGFloat = 2 * 46

    static func run(out: URL, only: Set<String>?) {
        let files = FileManager.default
        try? files.createDirectory(at: out, withIntermediateDirectories: true)
        var report = "# Jar lab report\n\nGaegu loaded: \(JarFonts.hasHand)\n\n"
        let started = Date()

        if only == nil || only!.contains("rests") {
            report += "## Resting notes (card height, paper height, message type)\n\n"
            let dir = out.appendingPathComponent("rests")
            try? files.createDirectory(at: dir, withIntermediateDirectories: true)
            for width in widths {
                for (name, note, count) in LabScenarios.rests {
                    let script = LabScript(name: name, heading: LabScenarios.morning, newCount: count, initial: .pulled(note), events: [], range: 0...0, fps: 1)
                    let layout = JarLayout(width: width, heading: script.heading, fresh: true)
                    let paper = layout.paper(for: note)
                    let height = layout.restHeight(paper)
                    report += "- \(name) @\(Int(width)): card \(Int(height)) pt, paper \(Int(paper.size.height)) pt, \(paper.panels) panels, \(paper.messageFont), \(paper.message.lines.count) lines\n"
                    render(script, width: width, time: 9, canvasHeight: canvas(for: height), to: dir.appendingPathComponent("rest-\(name)-w\(Int(width)).png"))
                }
                for script in [LabScript(name: "waiting", heading: LabScenarios.morning, newCount: 2, initial: .waiting, events: [], range: 0...0, fps: 1),
                               LabScript(name: "waiting-reminder", heading: LabScenarios.reminder, newCount: 1, initial: .waiting, events: [], range: 0...0, fps: 1),
                               LabScript(name: "waiting-nil", heading: "a little love is waiting in your jar ❤️", newCount: nil, initial: .waiting, events: [], range: 0...0, fps: 1),
                               LabScript(name: "failed", heading: LabScenarios.morning, newCount: 2, initial: .failed("open kiriya.love once, then the jar opens from here ❤️"), events: [], range: 0...0, fps: 1)] {
                    let height = JarTimeline.height(input(script, width: width, t: 1.3))
                    report += "- \(script.name) @\(Int(width)): card \(Int(height)) pt\n"
                    render(script, width: width, time: 1.3, canvasHeight: canvas(for: height), to: dir.appendingPathComponent("\(script.name)-w\(Int(width)).png"))
                }
            }
            report += "\n"
        }

        for script in LabScenarios.all() where only == nil || only!.contains(script.name) {
            for width in widths {
                let dir = out.appendingPathComponent(script.name).appendingPathComponent("w\(Int(width))")
                try? files.removeItem(at: dir)
                try? files.createDirectory(at: dir, withIntermediateDirectories: true)
                let times = script.times
                var heights: [CGFloat] = []
                for t in times { heights.append(JarTimeline.height(input(script, width: width, t: t))) }
                let canvasHeight = canvas(for: heights.max() ?? 400)
                for (index, t) in times.enumerated() {
                    render(script, width: width, time: t, canvasHeight: canvasHeight, to: dir.appendingPathComponent(String(format: "f%04d.png", index)))
                }
                try? "\(script.fps)".write(to: dir.appendingPathComponent("fps.txt"), atomically: true, encoding: .utf8)
                let changes = zip(times, heights).reduce(into: [(Double, CGFloat)]()) { list, item in
                    if list.last?.1 != item.1 { list.append(item) }
                }
                report += "- \(script.name) @\(Int(width)): \(times.count) frames; card heights " + changes.map { String(format: "%.2fs→%.0f", $0.0, $0.1) }.joined(separator: ", ") + "\n"
            }
        }
        report += String(format: "\nrendered in %.0f s\n", Date().timeIntervalSince(started))
        try? report.write(to: out.appendingPathComponent("report.md"), atomically: true, encoding: .utf8)
        print(report)
    }

    static func canvas(for cardHeight: CGFloat) -> CGFloat { 12 + cardHeight + 10 + actionsHeight + 14 }

    static func input(_ script: LabScript, width: CGFloat, t: Double) -> JarTimeline.Input {
        JarTimeline.Input(heading: script.heading, newCount: script.newCount, story: script.story(at: t), now: LabScript.epoch + t,
                          reduceMotion: script.reduceMotion, width: width)
    }

    static func render(_ script: LabScript, width: CGFloat, time t: Double, canvasHeight: CGFloat, to url: URL) {
        let story = script.story(at: t)
        let pulledBefore: Bool = {
            if case .pulled = story.step.phase { return true }
            return story.step.note != nil
        }()
        let view = LabNotification(width: width, canvasHeight: canvasHeight, pullTitle: pulledBefore ? "Pull another ✨" : "Pull one ✨") {
            JarCardMoment(heading: script.heading, newCount: script.newCount, story: story, time: LabScript.epoch + t, reduceMotion: script.reduceMotion)
        }
        let renderer = ImageRenderer(content: view)
        renderer.scale = 3
        guard let image = renderer.cgImage,
              let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { return }
        CGImageDestinationAddImage(destination, image, nil)
        CGImageDestinationFinalize(destination)
    }
}

/// The expanded notification around the card: the dark system UI, the card's platter, the action buttons.
struct LabNotification<Card: View>: View {
    let width: CGFloat
    let canvasHeight: CGFloat
    let pullTitle: String
    @ViewBuilder let card: () -> Card

    var body: some View {
        ZStack(alignment: .top) {
            Color(red: 0.07, green: 0.07, blue: 0.09)
            VStack(spacing: 10) {
                card()
                    .frame(width: width)
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                LabActions(pullTitle: pullTitle, width: width)
            }
            .padding(.top, 12)
        }
        .frame(width: width + 24, height: canvasHeight)
        .environment(\.colorScheme, .dark)
    }
}

struct LabActions: View {
    let pullTitle: String
    let width: CGFloat
    var onPull: () -> Void = {}

    var body: some View {
        VStack(spacing: 0) {
            row(pullTitle, "sparkles", action: onPull)
            Rectangle().fill(Color.white.opacity(0.12)).frame(height: 0.5)
            row("Open in app", "arrow.up.forward.app", action: {})
        }
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(white: 0.17)))
        .frame(width: width)
    }

    private func row(_ title: String, _ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title).font(.system(size: 17)).foregroundStyle(.white)
                Spacer()
                Image(systemName: symbol).font(.system(size: 17)).foregroundStyle(.white)
            }
            .padding(.horizontal, 16)
            .frame(height: 46)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - The live card, hosted like the extension hosts it

struct LabHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

struct LabHost: View {
    let autoplay: Bool
    let width: Double
    @State private var state: JarCardState = .waiting
    @State private var platter: CGFloat = 320
    @State private var pulls = 0
    @State private var failNext = false
    @State private var delay = 1.2
    @State private var log: [String] = []
    private let notes = [LabNotes.medium, LabNotes.long, LabNotes.short, LabNotes.tiny]

    var body: some View {
        GeometryReader { proxy in
            let cardWidth = width > 0 ? CGFloat(width) : proxy.size.width - 16
            ZStack(alignment: .top) {
                Color(red: 0.07, green: 0.07, blue: 0.09).ignoresSafeArea()
                VStack(spacing: 10) {
                    JarCard(heading: LabScenarios.morning, newCount: 2, state: state, onPull: pull)
                        .fixedSize(horizontal: false, vertical: true)
                        .background(GeometryReader { card in Color.clear.preference(key: LabHeightKey.self, value: card.size.height) })
                        .frame(width: cardWidth, height: platter, alignment: .top)
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        .onPreferenceChange(LabHeightKey.self) { height in
                            let target = min(height.rounded(.up), 720)
                            if abs(target - platter) > 1 { withAnimation(.easeInOut(duration: 0.32)) { platter = target } }
                        }
                    LabActions(pullTitle: pulls > 0 ? "Pull another ✨" : "Pull one ✨", width: cardWidth, onPull: pull)
                    if !autoplay {
                        HStack {
                            Button(failNext ? "next pull fails ✓" : "fail next") { failNext.toggle() }
                            Button("network \(String(format: "%.1f", delay))s") { delay = delay >= 3 ? 0.2 : delay + 0.4 }
                            Button("reset") { state = .waiting; pulls = 0 }
                        }
                        .font(.system(size: 13, weight: .medium)).foregroundStyle(.white.opacity(0.7))
                    }
                }
                .padding(.top, 8)
            }
            .frame(maxWidth: .infinity)
        }
        .preferredColorScheme(.dark)
        .task {
            guard autoplay else { return }
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            delay = 1.4; pull()
            try? await Task.sleep(nanoseconds: 7_000_000_000)
            delay = 0.6; pull()
            try? await Task.sleep(nanoseconds: 7_000_000_000)
            delay = 1.2; failNext = true; pull()
            try? await Task.sleep(nanoseconds: 3_500_000_000)
            delay = 0.3; pull()
        }
    }

    private func pull() {
        if case .pulling = state { return }
        // As NoteCardModel does it: state changes inside withAnimation (the card must ignore that).
        withAnimation(.easeInOut(duration: 0.25)) { state = .pulling }
        let fail = failNext
        failNext = false
        let next = notes[pulls % notes.count]
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            if fail {
                withAnimation { state = .failed("the jar got a little stuck. try again?") }
            } else {
                pulls += 1
                withAnimation(.spring(response: 0.55, dampingFraction: 0.78)) { state = .pulled(next) }
            }
        }
    }
}
