import CoreText
import SwiftUI
import WidgetKit

// The lab's own widget extension (simulator only, bundle love.kiriya.signalslab.widget). It is the real
// SignalsWidget, built from ios/App/KiriyaWidgets/Signals with SIGNALS_LAB, plus:
//   - a stubbed network: every press "sends" after 0.9 s, except 💧 water, which fails as if offline,
//     so both outcomes can be seen on the Home Screen. Nothing ever reaches kiriya.love;
//   - a fake device key, so the widget counts as set up;
//   - colour emoji from the simulator runtime's own font file (the iOS 26 simulator ships without the
//     usual one), lab only;
//   - "Signals demo": the same face on a scripted timeline (idle → sent → idle …), for recording the
//     sent transition exactly as WidgetKit animates it, without anyone tapping.

enum SignalsLab {
    static func prepare() {
        SignalsWidgetSender.isLab = true
        SignalsWidgetSender.transport = { signal, _ in
            try await Task.sleep(nanoseconds: 900_000_000)
            if signal == .water { throw SignalsWidgetSendError.problem(.offline, nil) }
            return .init(test: false)
        }
        KiriyaGroup.defaults?.set("kw_signals_lab_not_a_real_key", forKey: KiriyaGroup.widgetKey)
        SignalsWidgetFonts.loadIfNeeded()
        registerEmoji()
    }

    nonisolated(unsafe) private static var emojiDescriptor: CTFontDescriptor?

    private static func registerEmoji() {
        let candidates = [
            Bundle.main.bundlePath + "/LabEmoji.ttc",
            "/Library/Developer/CoreSimulator/Volumes/iOS_23D8133/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 26.3.simruntime/Contents/Resources/RuntimeRoot/System/Library/Fonts/CoreAddition/AppleColorEmoji-160px.ttc",
        ]
        for path in candidates where FileManager.default.isReadableFile(atPath: path) {
            if let found = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: path) as CFURL) as? [CTFontDescriptor], let first = found.first {
                emojiDescriptor = first
                // A font made from a file descriptor doesn't survive WidgetKit's archiving, so the lab
                // draws each emoji into a picture instead.
                SignalsWidgetFonts.labEmojiImage = { text, size in drawEmoji(text, size: size, descriptor: first) }
                return
            }
        }
    }

    private static func drawEmoji(_ text: String, size: CGFloat, descriptor: CTFontDescriptor) -> CGImage? {
        let scale: CGFloat = 3
        let font = CTFontCreateWithFontDescriptor(descriptor, size * scale, nil)
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font]))
        var ascent: CGFloat = 0, descent: CGFloat = 0
        let width = CTLineGetTypographicBounds(line, &ascent, &descent, nil)
        let w = Int(ceil(width)), h = Int(ceil(ascent + descent))
        guard w > 0, h > 0, let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                                                 space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                                 bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        ctx.textPosition = CGPoint(x: 0, y: descent)
        CTLineDraw(line, ctx)
        return ctx.makeImage()
    }
}

@main
struct SignalsLabWidgets: WidgetBundle {
    init() { SignalsLab.prepare() }

    var body: some Widget {
        SignalsWidget()
        SignalsLabDemoWidget()
    }
}

// MARK: - A scripted timeline for recording the transition

struct SignalsLabDemoProvider: TimelineProvider {
    func placeholder(in context: Context) -> SignalsWidgetEntry { .sample() }
    func getSnapshot(in context: Context, completion: @escaping (SignalsWidgetEntry) -> Void) { completion(.sample()) }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SignalsWidgetEntry>) -> Void) {
        let now = Date()
        let start = now.addingTimeInterval(4)
        let hero: SignalsWidgetSignal = .hug
        var entries = [SignalsWidgetEntry.sample(now)]
        // Every 12 s: a send, held for 7 s, then back to idle.
        for cycle in 0..<20 {
            let t = start.addingTimeInterval(Double(cycle) * 12)
            let signal = cycle.isMultiple(of: 2) ? hero : (context.family == .systemLarge ? .morning : .kiss)
            entries.append(.sample(t, moment: SignalsWidgetMoment(signal: signal, at: t, outcome: .sent)))
            entries.append(.sample(t.addingTimeInterval(7)))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct SignalsLabDemoWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SignalsLabDemo", provider: SignalsLabDemoProvider()) { entry in
            SignalsWidgetView(entry: entry)
        }
        .configurationDisplayName("Signals demo")
        .description("Lab: the sent moment on a loop.")
        .contentMarginsDisabled()
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

