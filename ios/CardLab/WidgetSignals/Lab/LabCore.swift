import SwiftUI
import WidgetKit
#if canImport(AppKit)
import AppKit
#endif
#if canImport(UIKit)
import UIKit
#endif

// The Signals widget's render lab: draws SignalsWidgetFace exactly as the widget does, at real widget
// sizes, in each appearance the system can give it, then composes contact sheets. Shared by the macOS
// renderer (colour emoji) and the simulator app (iOS parity + live transitions).
//
// Appearances the system applies after we draw (approximated here so we can judge them):
//   accented  every pixel turned white, alpha kept, over tinted glass   (iOS 18+ tinted / clear Home Screen)
//   vibrant   a white monochrome over the wallpaper                      (Lock Screen, StandBy at night in red)

struct LabDevice {
    var name: String
    var scale: CGFloat
    var small: CGSize
    var medium: CGSize
    var large: CGSize
    var circular: CGSize
    var rectangular: CGSize
    var radius: CGFloat

    static let iPhone11 = LabDevice(name: "iphone11", scale: 2, small: CGSize(width: 169, height: 169), medium: CGSize(width: 360, height: 169),
                                    large: CGSize(width: 360, height: 376), circular: CGSize(width: 72, height: 72),
                                    rectangular: CGSize(width: 160, height: 72), radius: 21.7)
    static let pro67 = LabDevice(name: "67in", scale: 3, small: CGSize(width: 170, height: 170), medium: CGSize(width: 364, height: 170),
                                 large: CGSize(width: 364, height: 382), circular: CGSize(width: 76, height: 76),
                                 rectangular: CGSize(width: 172, height: 76), radius: 23)

    func size(_ family: SignalsWidgetFamily) -> CGSize {
        switch family {
        case .small: return small
        case .medium: return medium
        case .large: return large
        case .circular: return circular
        case .rectangular: return rectangular
        }
    }
}

enum LabAppearance: String, CaseIterable {
    case light, dark, tinted, standby, standbyNight = "standby-night", lock

    var look: SignalsWidgetLook {
        switch self {
        case .light: return SignalsWidgetLook()
        case .dark: return SignalsWidgetLook(ink: .color, dark: true)
        case .tinted: return SignalsWidgetLook(ink: .accented, dark: true, showsBackground: false)
        case .standby: return SignalsWidgetLook(ink: .color, dark: true, showsBackground: false)
        case .standbyNight: return SignalsWidgetLook(ink: .vibrant, dark: true, showsBackground: false)
        case .lock: return SignalsWidgetLook(ink: .vibrant, dark: true, showsBackground: false)
        }
    }
}

struct LabScene: Identifiable {
    var id: String
    var family: SignalsWidgetFamily
    var entry: SignalsWidgetEntry
    var appearance: LabAppearance = .light
    var sending: SignalsWidgetSignal? = nil
}

enum LabMoments {
    static let now = Date(timeIntervalSince1970: 1_795_000_000)
    static func sent(_ signal: SignalsWidgetSignal, test: Bool = false) -> SignalsWidgetMoment {
        SignalsWidgetMoment(signal: signal, at: now, outcome: test ? .test : .sent)
    }
    static func failed(_ signal: SignalsWidgetSignal, _ problem: SignalsWidgetMoment.Problem, _ message: String? = nil) -> SignalsWidgetMoment {
        SignalsWidgetMoment(signal: signal, at: now, outcome: .failed, problem: problem, message: message)
    }
}

// MARK: - Drawing one widget

/// The widget as the Home Screen shows it: our background (unless the system takes it away), our face,
/// clipped to the widget's rounded shape.
struct LabWidget: View {
    var scene: LabScene
    var size: CGSize
    var radius: CGFloat

    var body: some View {
        let look = scene.appearance.look
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        ZStack {
            if look.ink == .color && look.showsBackground { look.background }
            SignalsWidgetFace(entry: scene.entry, family: scene.family, look: look, labSending: scene.sending)
        }
        .frame(width: size.width, height: size.height)
        .clipShape(scene.family == .circular || scene.family == .rectangular ? AnyShape(Rectangle()) : AnyShape(shape))
        .environment(\.colorScheme, look.dark ? .dark : .light)
    }
}

@MainActor
enum LabRender {
    /// Renders a view to a CGImage at `scale`.
    static func image<V: View>(_ view: V, size: CGSize, scale: CGFloat) -> CGImage? {
        let renderer = ImageRenderer(content: view.frame(width: size.width, height: size.height))
        renderer.scale = scale
        renderer.isOpaque = false
        return renderer.cgImage
    }

    /// Every pixel white (or `tint`), alpha kept: what the system does in accented / vibrant modes.
    static func monochrome(_ image: CGImage, tint: (CGFloat, CGFloat, CGFloat) = (1, 1, 1), alpha: CGFloat = 1) -> CGImage? {
        let w = image.width, h = image.height
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        guard let data = ctx.data?.assumingMemoryBound(to: UInt8.self) else { return nil }
        for i in stride(from: 0, to: w * h * 4, by: 4) {
            let a = CGFloat(data[i + 3]) / 255 * alpha
            data[i] = UInt8(min(255, tint.0 * a * 255))
            data[i + 1] = UInt8(min(255, tint.1 * a * 255))
            data[i + 2] = UInt8(min(255, tint.2 * a * 255))
            data[i + 3] = UInt8(min(255, a * 255))
        }
        return ctx.makeImage()
    }

    /// One widget in its context (wallpaper / glass / black StandBy / Lock Screen), as an image.
    static func widget(_ scene: LabScene, device: LabDevice, scale: CGFloat? = nil) -> CGImage? {
        let scale = scale ?? device.scale
        var size = device.size(scene.family)
        let radius = device.radius
        let look = scene.appearance.look
        let standby = scene.appearance == .standby || scene.appearance == .standbyNight
        // StandBy shows the small widget scaled up (laid out at its own size, drawn bigger).
        let zoom: CGFloat = standby ? 1.6 : 1
        guard let face = image(LabWidget(scene: scene, size: size, radius: radius), size: size, scale: scale * zoom) else { return nil }
        if standby { size = CGSize(width: size.width * zoom, height: size.height * zoom) }
        let pad: CGFloat = scene.family == .circular || scene.family == .rectangular ? 10 : 14
        let canvas = CGSize(width: size.width + pad * 2, height: size.height + pad * 2)

        switch look.ink {
        case .color:
            let backdrop: AnyView = standby ? AnyView(Color.black) : AnyView(LabWallpaper(dark: look.dark))
            return image(ZStack {
                backdrop
                Image(decorative: face, scale: scale).frame(width: size.width, height: size.height)
            }, size: canvas, scale: scale)
        case .accented:
            guard let mono = monochrome(face) else { return nil }
            return image(ZStack {
                LabWallpaper(dark: true)
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(LinearGradient(colors: [Color(red: 0.36, green: 0.25, blue: 0.52).opacity(0.9), Color(red: 0.22, green: 0.15, blue: 0.36).opacity(0.92)],
                                         startPoint: .top, endPoint: .bottom))
                    .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(Color.white.opacity(0.18), lineWidth: 1))
                    .frame(width: size.width, height: size.height)
                Image(decorative: mono, scale: scale).frame(width: size.width, height: size.height)
            }, size: canvas, scale: scale)
        case .vibrant:
            let night = scene.appearance == .standbyNight
            guard let mono = monochrome(face, tint: night ? (1, 0.23, 0.2) : (1, 1, 1), alpha: night ? 0.85 : 0.92) else { return nil }
            return image(ZStack {
                if standby { Color.black } else { LabWallpaper(dark: true) }
                Image(decorative: mono, scale: scale).frame(width: size.width, height: size.height)
            }, size: canvas, scale: scale)
        }
    }
}

/// A soft wallpaper so widgets are judged in place, not on white.
struct LabWallpaper: View {
    var dark: Bool
    var body: some View {
        ZStack {
            if dark {
                LinearGradient(colors: [Color(red: 0.16, green: 0.14, blue: 0.27), Color(red: 0.07, green: 0.06, blue: 0.12)], startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [Color(red: 0.42, green: 0.27, blue: 0.5).opacity(0.6), .clear], center: UnitPoint(x: 0.2, y: 0.1), startRadius: 0, endRadius: 500)
            } else {
                LinearGradient(colors: [Color(red: 0.78, green: 0.84, blue: 0.95), Color(red: 0.93, green: 0.82, blue: 0.9)], startPoint: .topLeading, endPoint: .bottomTrailing)
                RadialGradient(colors: [Color.white.opacity(0.55), .clear], center: UnitPoint(x: 0.8, y: 0.15), startRadius: 0, endRadius: 400)
            }
        }
    }
}

// MARK: - Scenes

enum LabScenes {
    static func entry(_ style: SignalsWidgetSmallStyle = .four, _ signals: [SignalsWidgetSignal] = SignalsWidgetSignal.defaults,
                      moment: SignalsWidgetMoment? = nil, setUp: Bool = true) -> SignalsWidgetEntry {
        .sample(LabMoments.now, smallStyle: style, signals: signals, moment: moment, isSetUp: setUp)
    }

    /// Every family × state in one appearance.
    static func states(_ appearance: LabAppearance) -> [LabScene] {
        var out: [LabScene] = []
        let families: [(String, SignalsWidgetFamily, SignalsWidgetSmallStyle, [SignalsWidgetSignal])] = [
            ("small4", .small, .four, SignalsWidgetSignal.defaults),
            ("small2", .small, .two, [.hug, .kiss]),
            ("small1", .small, .one, [.hug]),
            ("medium", .medium, .four, SignalsWidgetSignal.defaults),
            ("large", .large, .four, SignalsWidgetSignal.defaults),
        ]
        for (name, family, style, signals) in families {
            let hero = signals[family == .large ? 1 : 0]
            out.append(LabScene(id: "\(name)-idle", family: family, entry: entry(style, signals), appearance: appearance))
            out.append(LabScene(id: "\(name)-sending", family: family, entry: entry(style, signals), appearance: appearance, sending: hero))
            out.append(LabScene(id: "\(name)-sent", family: family, entry: entry(style, signals, moment: LabMoments.sent(hero)), appearance: appearance))
            out.append(LabScene(id: "\(name)-failed", family: family, entry: entry(style, signals, moment: LabMoments.failed(hero, .offline)), appearance: appearance))
        }
        return out
    }

    static let lockScreen: [LabScene] = [
        LabScene(id: "circular-idle", family: .circular, entry: entry(), appearance: .lock),
        LabScene(id: "circular-hug", family: .circular, entry: entry(.four, [.hug]), appearance: .lock),
        LabScene(id: "circular-sent", family: .circular, entry: entry(moment: LabMoments.sent(.thinking)), appearance: .lock),
        LabScene(id: "rect-idle", family: .rectangular, entry: entry(), appearance: .lock),
        LabScene(id: "rect-sent", family: .rectangular, entry: entry(moment: LabMoments.sent(.hug)), appearance: .lock),
        LabScene(id: "rect-failed", family: .rectangular, entry: entry(moment: LabMoments.failed(.thinking, .offline)), appearance: .lock),
    ]

    static let extras: [LabScene] = [
        LabScene(id: "small4-notsetup", family: .small, entry: entry(setUp: false)),
        LabScene(id: "small1-notsetup", family: .small, entry: entry(.one, [.thinking], setUp: false)),
        LabScene(id: "medium-notsetup", family: .medium, entry: entry(setUp: false)),
        LabScene(id: "medium-test", family: .medium, entry: entry(moment: LabMoments.sent(.hug, test: true))),
        LabScene(id: "medium-slowdown", family: .medium, entry: entry(moment: LabMoments.failed(.kiss, .slowDown, "That's a lot of love for one hour ♡ try again in a bit."))),
        LabScene(id: "medium-locked", family: .medium, entry: entry(moment: LabMoments.failed(.kiss, .locked))),
        LabScene(id: "small4-morning", family: .small, entry: entry(.four, [.morning, .night, .water, .miss])),
        LabScene(id: "medium-daily", family: .medium, entry: entry(.four, [.morning, .night, .water, .miss])),
        LabScene(id: "small1-thinking", family: .small, entry: entry(.one, [.thinking])),
        LabScene(id: "small1-night", family: .small, entry: entry(.one, [.night])),
        LabScene(id: "small1-water", family: .small, entry: entry(.one, [.water])),
        LabScene(id: "small2-morning", family: .small, entry: entry(.two, [.morning, .night])),
        LabScene(id: "large-sent-water", family: .large, entry: entry(moment: LabMoments.sent(.water))),
        // On Josh's own phone the other person is Kiriya (and his sends are test sends while test mode is on).
        LabScene(id: "large-joshphone-test", family: .large,
                 entry: .sample(LabMoments.now, moment: LabMoments.sent(.kiss, test: true), otherName: "Kiriya")),
        LabScene(id: "small1-joshphone", family: .small, entry: .sample(LabMoments.now, smallStyle: .one, signals: [.miss], otherName: "Kiriya")),
        LabScene(id: "rect-joshphone", family: .rectangular, entry: .sample(LabMoments.now, otherName: "Kiriya"), appearance: .lock),
    ]
}

// MARK: - Contact sheets

struct LabSheet: View {
    var title: String
    var items: [(String, CGImage, CGFloat)]
    var columns: Int
    var dark = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title).font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(dark ? Color.white : Color(red: 0.3, green: 0.18, blue: 0.39))
            let rows = stride(from: 0, to: items.count, by: columns).map { Array(items[$0..<min($0 + columns, items.count)]) }
            VStack(alignment: .leading, spacing: 16) {
                ForEach(rows.indices, id: \.self) { r in
                    HStack(alignment: .top, spacing: 16) {
                        ForEach(rows[r].indices, id: \.self) { i in
                            let item = rows[r][i]
                            VStack(alignment: .leading, spacing: 4) {
                                Image(decorative: item.1, scale: item.2)
                                Text(item.0).font(.system(size: 11, weight: .medium, design: .monospaced))
                                    .foregroundStyle(dark ? Color.white.opacity(0.7) : Color.gray)
                            }
                        }
                    }
                }
            }
        }
        .padding(22)
        .background(dark ? Color(red: 0.1, green: 0.09, blue: 0.13) : Color(red: 0.98, green: 0.97, blue: 0.99))
        .fixedSize()
    }
}

// MARK: - The overview poster (one picture to show Josh)

struct LabOverview: View {
    struct Item { var caption: String; var image: CGImage; var scale: CGFloat }
    var rows: [(String, [Item])]
    var subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Thinking of you").font(SignalsWidgetFonts.font(.script, size: 46))
                    .foregroundStyle(SignalsWidgetPalette.plum)
                Text(subtitle).font(SignalsWidgetFonts.font(.hand, size: 19)).foregroundStyle(SignalsWidgetPalette.softInk)
            }
            ForEach(rows.indices, id: \.self) { r in
                VStack(alignment: .leading, spacing: 10) {
                    Text(rows[r].0).font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundStyle(SignalsWidgetPalette.soft)
                    HStack(alignment: .top, spacing: 18) {
                        ForEach(rows[r].1.indices, id: \.self) { i in
                            let item = rows[r].1[i]
                            VStack(alignment: .leading, spacing: 6) {
                                Image(decorative: item.image, scale: item.scale)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                Text(item.caption).font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundStyle(SignalsWidgetPalette.softInk)
                            }
                        }
                    }
                }
            }
        }
        .padding(34)
        .background(LinearGradient(colors: [SignalsWidgetPalette.rgb(0xfdf8fc), SignalsWidgetPalette.rgb(0xf3eaf8)], startPoint: .top, endPoint: .bottom))
        .fixedSize()
    }
}
