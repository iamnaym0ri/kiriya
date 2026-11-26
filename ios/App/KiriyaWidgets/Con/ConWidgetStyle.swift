import CoreText
import SwiftUI
import WidgetKit

// The con ticket's colours and type. The same world as the note cards (LetterPalette,
// FormalLetterPalette) and the site (src/styles/tokens.css): cream paper with a plum outline,
// lilac sky with sparkles, a pink satin accent and a red heart seal. Dark mode turns the ticket to
// night plum (like Maomao's envelope); tinted, clear and StandBy-night rendering get a quiet
// outline-and-glass ticket the system can colour.

struct ConWidgetLook: Equatable {
    enum Mode: Equatable { case light, dark, mono }
    let mode: Mode

    static func rgb(_ hex: UInt32, _ alpha: Double = 1) -> Color {
        Color(.sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255,
              blue: Double(hex & 0xff) / 255, opacity: alpha)
    }

    static func resolve(scheme: ColorScheme, rendering: WidgetRenderingMode) -> ConWidgetLook {
        if rendering == .accented || rendering == .vibrant { return ConWidgetLook(mode: .mono) }
        return ConWidgetLook(mode: scheme == .dark ? .dark : .light)
    }

    var isMono: Bool { mode == .mono }

    // MARK: Sky (the widget's background)
    var skyTop: Color { mode == .dark ? Self.rgb(0x2d1b3b) : Self.rgb(0xf8eefb) }
    var skyBottom: Color { mode == .dark ? Self.rgb(0x1b0f26) : Self.rgb(0xe2d0f0) }
    var skyGlow: Color { mode == .dark ? Self.rgb(0x5a3a73, 0.55) : Color.white.opacity(0.7) }
    var sparkle: Color { mode == .dark ? Self.rgb(0x8e70ab, 0.75) : Self.rgb(0xc4a6e2) }
    var sparkleWarm: Color { mode == .dark ? Self.rgb(0xd98fb4, 0.6) : Self.rgb(0xf4a6c6) }
    var confettiGold: Color { mode == .dark ? Self.rgb(0xd9bb78, 0.55) : Self.rgb(0xe6c98a) }

    // MARK: The ticket
    var paperTop: Color {
        switch mode {
        case .light: return Self.rgb(0xfffaf2)
        case .dark: return Self.rgb(0x46324f)
        case .mono: return Color.white.opacity(0.13)
        }
    }
    var paperBottom: Color {
        switch mode {
        case .light: return Self.rgb(0xfff1e2)
        case .dark: return Self.rgb(0x3a2843)
        case .mono: return Color.white.opacity(0.10)
        }
    }
    /// The stub's tint (the part you'd tear off).
    var stub: Color {
        switch mode {
        case .light: return Self.rgb(0xf3e6f7)
        case .dark: return Self.rgb(0x523b5e)
        case .mono: return Color.white.opacity(0.08)
        }
    }
    var outline: Color {
        switch mode {
        case .light: return Self.rgb(0x4e2f63)
        case .dark: return Self.rgb(0xb48ad0, 0.75)
        case .mono: return Color.white.opacity(0.5)
        }
    }
    var outlineWidth: CGFloat { mode == .light ? 2 : 1.5 }
    var perforation: Color {
        switch mode {
        case .light: return Self.rgb(0x8a6aa3, 0.75)
        case .dark: return Self.rgb(0xc9addf, 0.55)
        case .mono: return Color.white.opacity(0.45)
        }
    }
    var shadow: Color {
        switch mode {
        case .light: return Self.rgb(0x4e2f63, 0.16)
        case .dark: return Color.black.opacity(0.45)
        case .mono: return .clear
        }
    }

    // MARK: Ink
    /// Titles and the big numbers: 10:1 on the cream paper, 9:1 on the night ticket.
    var ink: Color {
        switch mode {
        case .light: return Self.rgb(0x4e2f63)
        case .dark: return Self.rgb(0xfbf0ff)
        case .mono: return .white
        }
    }
    /// Dates and venues: 5.6:1 on the cream paper.
    var soft: Color {
        switch mode {
        case .light: return Self.rgb(0x765891)
        case .dark: return Self.rgb(0xd5c0e6)
        case .mono: return Color.white.opacity(0.78)
        }
    }
    /// Micro labels ("NEXT CON · SINGAPORE").
    var faint: Color {
        switch mode {
        case .light: return Self.rgb(0x8a6aa3)
        case .dark: return Self.rgb(0xbfa6d6)
        case .mono: return Color.white.opacity(0.7)
        }
    }
    /// The heart red (the site's #e2445c), for "today!!", "tomorrow" and her picks.
    var heart: Color {
        switch mode {
        case .light: return Self.rgb(0xd93a55)
        case .dark: return Self.rgb(0xff7d93)
        case .mono: return .white
        }
    }
    /// The pink print shadow behind the big numbers (a poster's misregistered second colour).
    var print: Color {
        switch mode {
        case .light: return Self.rgb(0xf7a8c7)
        case .dark: return Self.rgb(0xc2477a)
        case .mono: return .clear
        }
    }
    var chipFill: Color {
        switch mode {
        case .light: return Self.rgb(0xefe5f6)
        case .dark: return Color.white.opacity(0.09)
        case .mono: return Color.white.opacity(0.14)
        }
    }
    var chipInk: Color {
        switch mode {
        case .light: return Self.rgb(0x6b4d86)
        case .dark: return Self.rgb(0xe3d2f0)
        case .mono: return Color.white.opacity(0.85)
        }
    }
    var barcode: Color {
        switch mode {
        case .light: return Self.rgb(0x4e2f63, 0.82)
        case .dark: return Self.rgb(0xe9d9f5, 0.75)
        case .mono: return Color.white.opacity(0.6)
        }
    }
    /// Day dots for a con on now: past days, today, days to come.
    var dotDone: Color { mode == .light ? Self.rgb(0xb48ad0) : mode == .dark ? Self.rgb(0xb48ad0) : Color.white.opacity(0.55) }
    var dotToday: Color { heart }
    var dotAhead: Color { mode == .light ? Self.rgb(0xd9c6ec) : mode == .dark ? Color.white.opacity(0.2) : Color.white.opacity(0.22) }

    // MARK: The heart seal (her picks)
    var wax: Color { Self.rgb(0xcc2945) }
    var waxDeep: Color { Self.rgb(0xa81c36) }
    var waxLight: Color { Self.rgb(0xe8506a) }
    var waxHeart: Color { Self.rgb(0xfff4f6) }
}

// MARK: - Type

/// Gaegu Bold (the site's handwriting, SIL OFL, renamed "ConWidget Gaegu" so nothing can collide) for
/// the handwritten words; SF Rounded for names, dates and every number (the live timers are drawn
/// by the system, so they stay in a system face).
enum ConWidgetFonts {
    static let handBoldName = "ConWidgetGaegu-Bold"

    /// Extra folders to look in (the lab points this at the source folder).
    nonisolated(unsafe) static var searchDirectories: [URL] = []

    private static let lock = NSLock()
    nonisolated(unsafe) private static var registered = false  // guarded by `lock`
    nonisolated(unsafe) private static var available = false
    nonisolated(unsafe) private static var widthCache: [String: CGFloat] = [:]

    static func registerIfNeeded() {
        lock.lock(); defer { lock.unlock() }
        guard !registered else { return }
        registered = true
        for file in ["ConWidget-Gaegu-Bold"] {
            var urls: [URL] = []
            for bundle in [Bundle.main, Bundle(for: ConWidgetFontsBundleToken.self)] {
                if let url = bundle.url(forResource: file, withExtension: "ttf") { urls.append(url) }
                if let url = bundle.url(forResource: file, withExtension: "ttf", subdirectory: "Fonts") { urls.append(url) }
            }
            urls += searchDirectories.map { $0.appendingPathComponent("\(file).ttf") }
            for url in urls where FileManager.default.fileExists(atPath: url.path) {
                // "Already registered" (a second widget in the same process) is fine.
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
                break
            }
        }
        let probe = CTFontCreateWithName(handBoldName as CFString, 12, nil)
        available = (CTFontCopyPostScriptName(probe) as String) == handBoldName
    }

    static var hasHand: Bool {
        registerIfNeeded()
        lock.lock(); defer { lock.unlock() }
        return available
    }

    /// Gaegu Bold, else SF Rounded at a similar visual size.
    static func hand(_ size: CGFloat) -> Font {
        if hasHand { return .custom(handBoldName, fixedSize: size) }
        return .system(size: size * 0.8, weight: .bold, design: .rounded)
    }

    static func rounded(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }

    /// Micro labels: small caps-ish, tracked out ("NEXT CON · SINGAPORE").
    static func micro(_ size: CGFloat = 9) -> Font { .system(size: size, weight: .heavy, design: .rounded) }

    /// The width a line of handwriting needs, to choose layouts before drawing.
    static func handWidth(_ text: String, size: CGFloat) -> CGFloat {
        let key = "\(size)|\(text)"
        lock.lock()
        if let cached = widthCache[key] { lock.unlock(); return cached }
        lock.unlock()
        let font: CTFont
        if hasHand {
            font = CTFontCreateWithName(handBoldName as CFString, size, nil)
        } else {
            font = CTFontCreateUIFontForLanguage(.system, size * 0.8, nil) ?? CTFontCreateWithName("Helvetica" as CFString, size, nil)
        }
        let attributed = NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
        let width = CGFloat(CTLineGetTypographicBounds(CTLineCreateWithAttributedString(attributed), nil, nil, nil))
        lock.lock(); widthCache[key] = width; lock.unlock()
        return width
    }
}

private final class ConWidgetFontsBundleToken {}

#if canImport(UIKit)
import UIKit

extension ConWidgetFonts {
    /// The width a line of SF Rounded needs (names are measured to choose one or two lines).
    static func roundedWidth(_ text: String, size: CGFloat, weight: UIFont.Weight) -> CGFloat {
        let base = UIFont.systemFont(ofSize: size, weight: weight)
        let font = base.fontDescriptor.withDesign(.rounded).map { UIFont(descriptor: $0, size: size) } ?? base
        return ceil((text as NSString).size(withAttributes: [.font: font]).width)
    }
}
#endif

extension ConWidgetFonts {
    /// The biggest size (down to 60 % of `size`) at which a handwritten word fits `width`.
    static func handFit(_ text: String, size: CGFloat, width: CGFloat) -> CGFloat {
        var s = size
        while s > size * 0.6 && handWidth(text, size: s) * (1 - handTracking) > width { s -= 1 }
        return s
    }

    /// Gaegu's Latin letters are widely spaced; set a little tighter.
    static let handTracking: CGFloat = 0.035
}

extension Text {
    /// Handwriting (Gaegu Bold), set a touch tighter than the font's own spacing.
    func hand(_ size: CGFloat) -> Text {
        font(ConWidgetFonts.hand(size)).tracking(ConWidgetFonts.hasHand ? -size * ConWidgetFonts.handTracking : 0)
    }
}

// MARK: - Frozen clocks (the render lab)

private struct ConWidgetFrozenClockKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// True only in the render lab: live timers then show their value at the entry's date
    /// (`pauseTime`), so a still picture shows what the Home Screen would show at that moment.
    var conWidgetFrozenClock: Bool {
        get { self[ConWidgetFrozenClockKey.self] }
        set { self[ConWidgetFrozenClockKey.self] = newValue }
    }
}

/// A live countdown text to `until` ("9:41:12"); paused at `from` when the lab freezes clocks.
func conWidgetTimerText(from: Date, until: Date, frozen: Bool) -> Text {
    guard frozen else { return Text(timerInterval: from...max(from, until), countsDown: true) }
    // The lab's still pictures: the system's own format ("9:41:12", "41:12"), worked out by hand,
    // because ImageRenderer runs timers on the real clock.
    let left = max(0, Int(until.timeIntervalSince(from)))
    let h = left / 3600, m = (left % 3600) / 60, s = left % 60
    return Text(verbatim: h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s))
}
