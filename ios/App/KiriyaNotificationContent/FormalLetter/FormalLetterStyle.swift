import CoreText
import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

// The formal letter's colours and type. Same lilac world as the site (src/styles/tokens.css,
// the widgets' WidgetTheme) and the little note, dressed up as fine stationery: a blush envelope
// like the site's letter envelopes (#ecd0df), a plum liner, champagne gilt, claret wax, ivory
// cotton paper and plum ink.

enum FormalLetterPalette {
    static func rgb(_ hex: UInt32, _ alpha: Double = 1) -> Color {
        Color(.sRGB,
              red: Double((hex >> 16) & 0xff) / 255,
              green: Double((hex >> 8) & 0xff) / 255,
              blue: Double(hex & 0xff) / 255,
              opacity: alpha)
    }

    // Ink (on the ivory paper: ink 10.6:1, soft 5.9:1, faint 4.6:1).
    static let ink = rgb(0x47295a)
    static let plum = rgb(0x4e2f63)
    static let soft = rgb(0x765891)
    static let faint = rgb(0x8a6f9f)
    static let rose = rgb(0xc4587f)
    static let heart = rgb(0xe2445c)

    // Paper: ivory cotton with a gilded deckle.
    static let paper = rgb(0xfffbf6)
    static let paperShade = rgb(0xfbf3ea)
    static let paperBack = rgb(0xf8efe5)
    static let paperBackShade = rgb(0xf3e7da)
    static let paperFiber = rgb(0xe9dccb)
    static let crease = rgb(0x8e6f80)

    // Champagne gilt.
    static let gold = rgb(0xc5a15a)
    static let goldLight = rgb(0xf0e0b2)
    static let goldDeep = rgb(0x9c7a37)

    // Claret sealing wax.
    static let wax = rgb(0xa8243f)
    static let waxLight = rgb(0xd04866)
    static let waxDeep = rgb(0x6e1027)
    static let waxShadow = rgb(0x4a0a1b)

    // The envelope's plum liner.
    static let liner = rgb(0x4d2e62)
    static let linerDeep = rgb(0x3b2150)
    static let linerHeart = rgb(0xe6a2c0)
    static let linerGold = rgb(0xd9bb78)

    /// The envelope's paper. Josh's letters come in the site's blush; Maomao's in its night plum.
    struct Tone: Equatable {
        let top: Color
        let bottom: Color
        let seam: Color
        let seamLight: Color
        let edge: Color
        let ink: Color
        let inkSoft: Color
        /// How much light plays across the paper (less on the dark one).
        let sheen: Double

        static let blush = Tone(top: rgb(0xf4dde8), bottom: rgb(0xebcadb), seam: rgb(0xb98aa6),
                                seamLight: rgb(0xfff4f8), edge: rgb(0xd5aec4), ink: rgb(0x55305f), inkSoft: rgb(0x7f5a8a), sheen: 1)
        static let night = Tone(top: rgb(0x5f4869), bottom: rgb(0x4b3655), seam: rgb(0x2f1f38),
                                seamLight: rgb(0x7a6383), edge: rgb(0x3c2a45), ink: rgb(0xf3e6c4), inkSoft: rgb(0xd9c7e6), sheen: 0.25)
    }

    /// The card's own background (it never follows the system's dark mode): the lilac world, with
    /// a soft light from above.
    static var background: some View {
        ZStack {
            // Two stops only: CoreGraphics can leave a faint seam at a gradient's inner stops.
            LinearGradient(colors: [rgb(0xfaf3fc), rgb(0xe8daf2)], startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [Color.white.opacity(0.6), Color.white.opacity(0)],
                           center: UnitPoint(x: 0.5, y: 0.18), startRadius: 0, endRadius: 280)
        }
    }
}

/// The bundled faces (SIL OFL, see Fonts/): Cormorant (Christian Thalmann) for the letter itself,
/// in static Medium and Medium Italic instances, and Allura, the site's own script, for the
/// signature and the address. Each is read from its own file, so no other card's fonts can ever
/// change this one's lettering; if a file is missing it falls back to similar system faces.
enum FormalLetterFonts {
    enum Face: CaseIterable {
        case text, italic, titleItalic, script

        var file: String {
            switch self {
            case .text: return "FormalLetter-Cormorant-Medium"
            case .italic: return "FormalLetter-Cormorant-MediumItalic"
            case .titleItalic: return "FormalLetter-Cormorant-SemiBoldItalic"
            case .script: return "FormalLetter-Allura-Regular"
            }
        }
    }

    /// Extra folders to look in (the render lab points this at the source folder).
    nonisolated(unsafe) static var searchDirectories: [URL] = []

    private static let lock = NSLock()
    nonisolated(unsafe) private static var loaded = false  // guarded by `lock`
    nonisolated(unsafe) private static var descriptors: [Face: CTFontDescriptor] = [:]
    nonisolated(unsafe) private static var cache: [String: CTFont] = [:]

    static func loadIfNeeded() {
        lock.lock(); defer { lock.unlock() }
        guard !loaded else { return }
        loaded = true
        for face in Face.allCases {
            var urls: [URL] = []
            for bundle in [Bundle.main, Bundle(for: FormalLetterFontsBundleToken.self)] {
                if let url = bundle.url(forResource: face.file, withExtension: "ttf") { urls.append(url) }
                if let url = bundle.url(forResource: face.file, withExtension: "ttf", subdirectory: "Fonts") { urls.append(url) }
            }
            urls += searchDirectories.map { $0.appendingPathComponent("\(face.file).ttf") }
            for url in urls where FileManager.default.fileExists(atPath: url.path) {
                guard let found = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor],
                      let descriptor = found.first else { continue }
                descriptors[face] = descriptor
                // Registered too, so a name lookup anywhere finds the same face (names are unique to this card).
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
                break
            }
        }
    }

    static func isBundled(_ face: Face) -> Bool {
        loadIfNeeded()
        lock.lock(); defer { lock.unlock() }
        return descriptors[face] != nil
    }

    /// The CoreText font used both to lay out and (via `Font(_:)`) to draw, so the two always agree.
    /// `smallCaps` turns lowercase into true small capitals (Cormorant's own `smcp`).
    static func ct(_ face: Face, size: CGFloat, smallCaps: Bool = false) -> CTFont {
        loadIfNeeded()
        let key = "\(face)|\(size)|\(smallCaps)"
        lock.lock()
        if let hit = cache[key] { lock.unlock(); return hit }
        let base = descriptors[face]
        lock.unlock()
        var font: CTFont
        if var descriptor = base {
            if smallCaps {
                let features: [[String: Any]] = [[kCTFontOpenTypeFeatureTag as String: "smcp", kCTFontOpenTypeFeatureValue as String: 1]]
                descriptor = CTFontDescriptorCreateCopyWithAttributes(descriptor, [kCTFontFeatureSettingsAttribute: features] as CFDictionary)
            }
            font = CTFontCreateWithFontDescriptor(descriptor, size, nil)
        } else {
            font = fallback(face, size: size)
        }
        lock.lock()
        if cache.count > 64 { cache.removeAll() }
        cache[key] = font
        lock.unlock()
        return font
    }

    static func font(_ face: Face, size: CGFloat, smallCaps: Bool = false) -> Font {
        Font(ct(face, size: size, smallCaps: smallCaps))
    }

    private static func fallback(_ face: Face, size: CGFloat) -> CTFont {
        switch face {
        case .script:
            let font = CTFontCreateWithName("SnellRoundhand" as CFString, size * 0.8, nil)
            if (CTFontCopyPostScriptName(font) as String) == "SnellRoundhand" { return font }
            return serif(size: size * 0.8, italic: true)
        case .text: return serif(size: size * 0.86, italic: false)
        case .italic, .titleItalic: return serif(size: size * 0.86, italic: true)
        }
    }

    private static func serif(size: CGFloat, italic: Bool) -> CTFont {
        #if canImport(UIKit)
        let base = UIFont.systemFont(ofSize: size, weight: .regular)
        var descriptor = base.fontDescriptor.withDesign(.serif) ?? base.fontDescriptor
        if italic { descriptor = descriptor.withSymbolicTraits(.traitItalic) ?? descriptor }
        return UIFont(descriptor: descriptor, size: size) as CTFont
        #else
        let base = NSFont.systemFont(ofSize: size, weight: .regular)
        var descriptor = base.fontDescriptor.withDesign(.serif) ?? base.fontDescriptor
        if italic { descriptor = descriptor.withSymbolicTraits(.italic) }
        return (NSFont(descriptor: descriptor, size: size) ?? base) as CTFont
        #endif
    }
}

private final class FormalLetterFontsBundleToken {}
