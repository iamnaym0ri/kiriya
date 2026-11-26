import CoreText
import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

// The letter card's colours and type: the site's stationery (src/styles/tokens.css, the notes paper in
// src/world/notes/NotesPage.css) and the envelope art in KiriyaNotificationService/envelope.png.

enum LetterPalette {
    static func rgb(_ hex: UInt32, _ alpha: Double = 1) -> Color {
        Color(.sRGB,
              red: Double((hex >> 16) & 0xff) / 255,
              green: Double((hex >> 8) & 0xff) / 255,
              blue: Double(hex & 0xff) / 255,
              opacity: alpha)
    }

    // The site's paper and lilacs.
    static let paper = rgb(0xfff9fd)
    static let paperShade = rgb(0xfdf0f7)
    static let paperBack = rgb(0xf9eef6)
    static let paperEdge = rgb(0xe4d3ea)
    static let rule = rgb(0xe9dcf2)
    static let lilac = rgb(0xefe5f6)
    static let lilacDeep = rgb(0xd9c6ec)
    static let lid = rgb(0xb48ad0)
    static let plum = rgb(0x4e2f63)
    static let ink = rgb(0x553868)        // body text: 9.4:1 on the paper
    static let soft = rgb(0x8a6aa3)
    static let softInk = rgb(0x7a5b93)    // small secondary text: 5.6:1 on the paper
    static let heart = rgb(0xe2445c)
    static let seal = rgb(0xcc2945)
    static let sealDeep = rgb(0xa81c36)
    static let sealLight = rgb(0xe8506a)

    // The envelope: cream paper and plum ink like envelope.png, with a lilac lining.
    static let cream = rgb(0xfff6e8)
    static let creamShade = rgb(0xfaecdb)
    static let creamDeep = rgb(0xf1dcc6)
    static let foldLine = rgb(0xa58bb4)
    static let lining = rgb(0xf1e2f5)
    static let liningDot = rgb(0xffffff, 0.85)
    static let liningHeart = rgb(0xe9a7c4)

    // Satin ribbon, lace and sparkles.
    static let ribbon = rgb(0xf7a8c7)
    static let ribbonLight = rgb(0xfccfe0)
    static let ribbonDeep = rgb(0xe0739e)
    static let ribbonShadow = rgb(0xc85a86)
    static let lace = Color.white
    static let laceLine = rgb(0xccb8e0)
    static let sparkle = rgb(0xb48ad0)
    static let sparkleLight = rgb(0xd4b8ec)

    /// The card's own background (it never follows the system's dark mode).
    static var background: some View {
        ZStack {
            LinearGradient(colors: [rgb(0xfdf6fb), rgb(0xf4eaf8), rgb(0xebdff4)],
                           startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [Color.white.opacity(0.55), Color.white.opacity(0)],
                           center: UnitPoint(x: 0.5, y: 0.22), startRadius: 0, endRadius: 260)
        }
    }
}

/// The bundled faces (SIL OFL, see Fonts/): Gaegu, the site's handwriting, and Parisienne, its
/// script. Registered for this process on first use; if a file is missing the card falls back to
/// system faces of a similar feel, so it never shows a blank.
enum LetterFonts {
    enum Face { case hand, handBold, script }

    /// Extra folders to look in (the render lab points this at the source folder).
    static var searchDirectories: [URL] = []

    private static let lock = NSLock()
    private static var registered = false
    /// Each bundled face, read from its own file (so another card registering a font with the same
    /// name can never change this card's lettering).
    private static var descriptors: [String: CTFontDescriptor] = [:]

    private static func postScriptName(_ face: Face) -> String {
        switch face {
        case .hand: return "Gaegu-Regular"
        case .handBold: return "Gaegu-Bold"
        case .script: return "Parisienne-Regular"
        }
    }

    static func registerIfNeeded() {
        lock.lock(); defer { lock.unlock() }
        guard !registered else { return }
        registered = true
        for name in ["Gaegu-Regular", "Gaegu-Bold", "Parisienne-Regular"] {
            var urls: [URL] = []
            for bundle in [Bundle.main, Bundle(for: LetterFontsBundleToken.self)] {
                if let url = bundle.url(forResource: name, withExtension: "ttf") { urls.append(url) }
                if let url = bundle.url(forResource: name, withExtension: "ttf", subdirectory: "Fonts") { urls.append(url) }
            }
            urls += searchDirectories.map { $0.appendingPathComponent("\(name).ttf") }
            for url in urls where FileManager.default.fileExists(atPath: url.path) {
                guard let found = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor],
                      let descriptor = found.first else { continue }
                descriptors[name] = descriptor
                // Registered too, for anything that looks the face up by name; "already registered"
                // (by another card in this process) is fine.
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
                break
            }
        }
    }

    static func isBundled(_ face: Face) -> Bool {
        registerIfNeeded()
        lock.lock(); defer { lock.unlock() }
        return descriptors[postScriptName(face)] != nil
    }

    /// The CoreText font used both to lay out and (via `Font(_:)`) to draw, so the two always agree.
    static func ct(_ face: Face, size: CGFloat) -> CTFont {
        registerIfNeeded()
        lock.lock()
        let descriptor = descriptors[postScriptName(face)]
        lock.unlock()
        if let descriptor {
            return CTFontCreateWithFontDescriptor(descriptor, size, nil)
        }
        switch face {
        case .script:
            let font = CTFontCreateWithName("SnellRoundhand" as CFString, size * 0.92, nil)
            if (CTFontCopyPostScriptName(font) as String) == "SnellRoundhand" { return font }
            return rounded(size: size * 0.8, bold: false)
        case .hand:
            return rounded(size: size * 0.8, bold: false)
        case .handBold:
            return rounded(size: size * 0.8, bold: true)
        }
    }

    static func font(_ face: Face, size: CGFloat) -> Font {
        Font(ct(face, size: size))
    }

    private static func rounded(size: CGFloat, bold: Bool) -> CTFont {
        #if canImport(UIKit)
        let base = UIFont.systemFont(ofSize: size, weight: bold ? .bold : .medium)
        let descriptor = base.fontDescriptor.withDesign(.rounded) ?? base.fontDescriptor
        return UIFont(descriptor: descriptor, size: size) as CTFont
        #else
        let base = NSFont.systemFont(ofSize: size, weight: bold ? .bold : .medium)
        let descriptor = base.fontDescriptor.withDesign(.rounded) ?? base.fontDescriptor
        return (NSFont(descriptor: descriptor, size: size) ?? base) as CTFont
        #endif
    }
}

private final class LetterFontsBundleToken {}
