import CoreText
import SwiftUI

// The widget's colours and type: the notification cards' lilac paper and plum ink (KiriyaNotificationContent
// Letter/LetterStyle.swift), a pastel per signal, and the site's handwriting (Gaegu) and script (Parisienne).

enum SignalsWidgetPalette {
    static func rgb(_ hex: UInt32, _ alpha: Double = 1) -> Color {
        Color(.sRGB,
              red: Double((hex >> 16) & 0xff) / 255,
              green: Double((hex >> 8) & 0xff) / 255,
              blue: Double(hex & 0xff) / 255,
              opacity: alpha)
    }

    static let plum = rgb(0x4e2f63)
    static let ink = rgb(0x553868)
    static let softInk = rgb(0x7a5b93)
    static let soft = rgb(0x8a6aa3)
    static let heart = rgb(0xe2445c)
    static let heartDeep = rgb(0xb8243f)
    static let heartLight = rgb(0xff7d8f)
    static let cream = rgb(0xfff6e8)

    // Night: the Maomao envelope's plum, for dark mode.
    static let night = rgb(0x2a1c38)
    static let nightDeep = rgb(0x1b1226)
    static let nightTile = rgb(0x36264a)
    static let nightText = rgb(0xfbeefa)
}

/// How the system is going to draw the widget, gathered from the environment once at the top.
struct SignalsWidgetLook: Hashable {
    enum Ink: Hashable {
        /// Full colour (Home Screen light/dark, StandBy by day).
        case color
        /// Tinted / clear Home Screen (iOS 18+): every pixel becomes white, only alpha survives.
        case accented
        /// Lock Screen and StandBy at night: a desaturated, vibrant monochrome.
        case vibrant
    }

    var ink: Ink = .color
    var dark = false
    /// False in StandBy (and on the Lock Screen): the system takes our background away.
    var showsBackground = true
    /// Always-On: dimmer, and no animation (the system wouldn't run it anyway).
    var dimmed = false

    var isMono: Bool { ink != .color }
}

extension SignalsWidgetLook {
    // Text
    var label: Color {
        switch ink {
        case .color: return dark ? SignalsWidgetPalette.nightText : SignalsWidgetPalette.plum
        case .accented, .vibrant: return .white
        }
    }

    func kaomoji(_ tint: SignalsWidgetTint) -> Color {
        switch ink {
        // By night each kaomoji glows in its signal's pastel.
        case .color: return dark ? tint.baseColor : SignalsWidgetPalette.softInk
        case .accented, .vibrant: return .white.opacity(0.78)
        }
    }

    var quiet: Color {
        switch ink {
        case .color: return dark ? SignalsWidgetPalette.rgb(0xbca6d2) : SignalsWidgetPalette.soft
        case .accented, .vibrant: return .white.opacity(0.7)
        }
    }

    var heartText: Color {
        switch ink {
        case .color: return dark ? SignalsWidgetPalette.heartLight : SignalsWidgetPalette.heart
        case .accented, .vibrant: return .white
        }
    }

    // A signal's button
    func tileTop(_ tint: SignalsWidgetTint) -> Color {
        switch ink {
        case .color: return dark ? SignalsWidgetPalette.rgb(tint.nightTop) : tint.lightColor
        case .accented: return .white.opacity(0.16)
        case .vibrant: return .white.opacity(0.14)
        }
    }

    func tileBottom(_ tint: SignalsWidgetTint) -> Color {
        switch ink {
        case .color: return dark ? SignalsWidgetPalette.rgb(tint.nightBottom) : tint.baseColor
        case .accented: return .white.opacity(0.10)
        case .vibrant: return .white.opacity(0.10)
        }
    }

    func tileEdge(_ tint: SignalsWidgetTint) -> Color {
        switch ink {
        case .color: return dark ? SignalsWidgetPalette.rgb(tint.nightEdge) : tint.edgeColor
        case .accented, .vibrant: return .white.opacity(0.22)
        }
    }

    func stitch(_ tint: SignalsWidgetTint) -> Color {
        switch ink {
        case .color: return dark ? tint.baseColor.opacity(0.38) : .white.opacity(0.95)
        case .accented, .vibrant: return .white.opacity(0.32)
        }
    }

    func doodle(_ tint: SignalsWidgetTint) -> Color {
        switch ink {
        case .color: return dark ? tint.baseColor.opacity(0.5) : tint.inkColor.opacity(0.42)
        case .accented, .vibrant: return .white.opacity(0.4)
        }
    }

    /// Under each button, so it sits on the paper like a sticker.
    var tileShadow: Color {
        switch ink {
        case .color: return dark ? .black.opacity(0.35) : SignalsWidgetPalette.rgb(0x632bb5, 0.13)
        case .accented, .vibrant: return .clear
        }
    }

    /// The paper behind everything (full colour only; the system draws its own otherwise).
    @ViewBuilder
    var background: some View {
        if dark {
            ZStack {
                LinearGradient(colors: [SignalsWidgetPalette.night, SignalsWidgetPalette.nightDeep],
                               startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [SignalsWidgetPalette.rgb(0x5b3f78, 0.55), SignalsWidgetPalette.rgb(0x5b3f78, 0)],
                               center: UnitPoint(x: 0.5, y: 0.0), startRadius: 0, endRadius: 260)
            }
        } else {
            ZStack {
                LinearGradient(colors: [SignalsWidgetPalette.rgb(0xfdf6fb), SignalsWidgetPalette.rgb(0xefe3f6)],
                               startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [Color.white.opacity(0.75), Color.white.opacity(0)],
                               center: UnitPoint(x: 0.5, y: 0.08), startRadius: 0, endRadius: 240)
            }
        }
    }
}

// MARK: - Type

/// The bundled faces (SIL OFL, in Fonts/ beside this file): Gaegu Bold, the site's handwriting, for
/// every label; Parisienne, its script, for the large widget's title.
///
/// WidgetKit draws a widget in another process from an archive of its views, and that process has to
/// find each font again. The dependable way is the extension's Info.plist `UIAppFonts` (see the
/// integration notes) plus `Font.custom(postScriptName)`; fonts only registered at run time can fail to
/// decode there ("could not decode view … invalidFont", seen in the lab right after a reinstall moved
/// the bundle). So: faces are looked up by name; they're also registered for this process from our own
/// files (harmless if UIAppFonts already did), and if neither works the rounded system face stands in.
enum SignalsWidgetFonts {
    enum Face: String, CaseIterable {
        case hand = "SignalsWidget-Gaegu-Bold"
        case script = "SignalsWidget-Parisienne-Regular"
    }

    /// Extra folders to look in (the render lab points this at the source folder).
    nonisolated(unsafe) static var searchDirectories: [URL] = []

    private static let lock = NSLock()
    nonisolated(unsafe) private static var loaded = false
    nonisolated(unsafe) private static var descriptors: [Face: CTFontDescriptor] = [:]
    /// The PostScript name each face answers to in this process ("Gaegu-Bold", "Parisienne-Regular").
    nonisolated(unsafe) private static var names: [Face: String] = [:]

    static func loadIfNeeded() {
        lock.lock(); defer { lock.unlock() }
        guard !loaded else { return }
        loaded = true
        for face in Face.allCases {
            var urls: [URL] = []
            for bundle in [Bundle.main, Bundle(for: SignalsWidgetFontsToken.self)] {
                if let url = bundle.url(forResource: face.rawValue, withExtension: "ttf") { urls.append(url) }
                if let url = bundle.url(forResource: face.rawValue, withExtension: "ttf", subdirectory: "Fonts") { urls.append(url) }
            }
            urls += searchDirectories.map { $0.appendingPathComponent("\(face.rawValue).ttf") }
            for url in urls where FileManager.default.fileExists(atPath: url.path) {
                guard let found = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor],
                      let descriptor = found.first,
                      let name = CTFontDescriptorCopyAttribute(descriptor, kCTFontNameAttribute) as? String else { continue }
                descriptors[face] = descriptor
                // "Already registered" (by UIAppFonts) is fine.
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
                // Use the name only if it really resolves to this face here.
                if (CTFontCopyPostScriptName(CTFontCreateWithName(name as CFString, 12, nil)) as String) == name {
                    names[face] = name
                }
                break
            }
        }
    }

    static func font(_ face: Face, size: CGFloat) -> Font {
        loadIfNeeded()
        lock.lock()
        let name = names[face]
        let descriptor = descriptors[face]
        lock.unlock()
        if let name { return .custom(name, fixedSize: size) }
        if let descriptor { return Font(CTFontCreateWithFontDescriptor(descriptor, size, nil)) }
        switch face {
        case .hand: return .system(size: size * 0.78, weight: .semibold, design: .rounded)
        case .script: return .system(size: size * 0.72, weight: .medium, design: .serif).italic()
        }
    }

    /// Kaomoji: Hiragino Maru Gothic, on every iPhone (and Mac), with the system's own fallback.
    static func kaomoji(size: CGFloat) -> Font {
        .custom("HiraMaruProN-W4", size: size)
    }

    /// Colour emoji. The lab can swap in a face for simulators that ship without one.
    static func emoji(size: CGFloat) -> Font {
        #if SIGNALS_LAB
        if let lab = labEmoji { return lab(size) }
        #endif
        return .system(size: size)
    }

    /// Words in Gaegu. Gaegu has no ♡ ✓ ✦ · or …, and its ’ is nearly an em wide, so those are swapped
    /// for its own "..." and ' or set in Hiragino Maru Gothic, slightly smaller, so they sit in the line.
    static func hand(_ string: String, size: CGFloat) -> Text {
        var text = Text("")
        for run in handRuns(string) {
            text = text + Text(run.text).font(run.isSymbol ? .custom("HiraMaruProN-W4", size: size * 0.78) : font(.hand, size: size))
        }
        return text
    }

    private static let symbols: Set<Character> = ["♡", "✓", "✦", "·"]

    /// The string split into Gaegu runs and symbol runs; a ♡ never wraps onto a line of its own.
    static func handRuns(_ string: String) -> [(text: String, isSymbol: Bool)] {
        let cleaned = string.replacingOccurrences(of: "’", with: "'")
            .replacingOccurrences(of: "…", with: "...")
            .replacingOccurrences(of: " ♡", with: "\u{00A0}♡")
        var runs: [(text: String, isSymbol: Bool)] = []
        for character in cleaned {
            let isSymbol = symbols.contains(character)
            if let last = runs.last, last.isSymbol == isSymbol {
                runs[runs.count - 1].text.append(character)
            } else {
                runs.append((String(character), isSymbol))
            }
        }
        return runs
    }

    /// How wide `string` sets in one line of Gaegu at `size` (with `tracking`), measured with CoreText.
    static func handWidth(_ string: String, size: CGFloat, tracking: CGFloat = 0) -> CGFloat {
        loadIfNeeded()
        lock.lock()
        let descriptor = descriptors[.hand]
        lock.unlock()
        let gaegu = descriptor.map { CTFontCreateWithFontDescriptor($0, size, nil) } ?? CTFontCreateWithName("HelveticaNeue-Bold" as CFString, size * 0.78, nil)
        let symbol = CTFontCreateWithName("HiraMaruProN-W4" as CFString, size * 0.78, nil)
        let text = NSMutableAttributedString()
        for run in handRuns(string) {
            text.append(NSAttributedString(string: run.text, attributes: [
                NSAttributedString.Key(kCTFontAttributeName as String): run.isSymbol ? symbol : gaegu,
                NSAttributedString.Key(kCTKernAttributeName as String): tracking,
            ]))
        }
        let line = CTLineCreateWithAttributedString(text)
        return CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
    }

    /// The largest size from `range` at which `string` fits `width` in `lines` lines (by words).
    static func handFit(_ string: String, width: CGFloat, lines: Int, range: ClosedRange<CGFloat>, tracking: CGFloat = 0) -> CGFloat {
        let probe = range.upperBound
        let whole = handWidth(string, size: probe, tracking: tracking)
        var needed = whole
        if lines > 1 {
            let longestWord = string.split(separator: " ").map { handWidth(String($0), size: probe, tracking: tracking) }.max() ?? whole
            needed = max(longestWord, whole / CGFloat(lines) * 1.18)
        }
        guard needed > width, needed > 0 else { return probe }
        return max(range.lowerBound, (probe * width / needed * 0.98).rounded(.down))
    }

    #if SIGNALS_LAB
    nonisolated(unsafe) static var labEmoji: ((CGFloat) -> Font)?
    nonisolated(unsafe) static var labEmojiImage: ((String, CGFloat) -> CGImage?)?
    #endif
}

private final class SignalsWidgetFontsToken {}
