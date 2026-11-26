import CoreText
import SwiftUI

// The little-note widget's lettering: the site's handwriting (Gaegu) and script (Parisienne),
// bundled as renamed copies (Fonts/NotesWidget-*.ttf, SIL OFL) so another copy of the same face in
// this process can never change them. Registered for the process on first use; a missing file falls
// back to SF Rounded, so the widget never shows a blank.
//
// Words are laid out with CoreText on a fixed ruled grid (the paper's rules are drawn first, then
// every line of words sits on one, emoji or not), then drawn as one SwiftUI Text per line.

enum NotesWidgetFonts {
    enum Face: String, CaseIterable {
        case hand = "NotesWidgetHand-Regular"
        case handBold = "NotesWidgetHand-Bold"
        case script = "NotesWidgetScript-Regular"

        var file: String {
            switch self {
            case .hand: return "NotesWidget-Hand-Regular"
            case .handBold: return "NotesWidget-Hand-Bold"
            case .script: return "NotesWidget-Script-Regular"
            }
        }
    }

    /// Extra folders to look in (the render lab points this at the source folder).
    nonisolated(unsafe) static var searchDirectories: [URL] = []

    private static let lock = NSLock()
    nonisolated(unsafe) private static var registered = false
    nonisolated(unsafe) private static var available: Set<Face> = []

    static func registerIfNeeded() {
        lock.lock(); defer { lock.unlock() }
        guard !registered else { return }
        registered = true
        for face in Face.allCases {
            var urls: [URL] = []
            for bundle in [Bundle.main, Bundle(for: NotesWidgetFontsToken.self)] {
                if let url = bundle.url(forResource: face.file, withExtension: "ttf") { urls.append(url) }
                if let url = bundle.url(forResource: face.file, withExtension: "ttf", subdirectory: "Fonts") { urls.append(url) }
            }
            urls += searchDirectories.map { $0.appendingPathComponent("\(face.file).ttf") }
            for url in urls where FileManager.default.fileExists(atPath: url.path) {
                // "Already registered" (a second widget in the same process got there first) is fine.
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
                let probe = CTFontCreateWithName(face.rawValue as CFString, 12, nil)
                if (CTFontCopyPostScriptName(probe) as String) == face.rawValue {
                    available.insert(face)
                    break
                }
            }
        }
    }

    static func isBundled(_ face: Face) -> Bool {
        registerIfNeeded()
        lock.lock(); defer { lock.unlock() }
        return available.contains(face)
    }

    /// The CoreText font that lays a line out; `font(_:size:)` draws it with the same face.
    static func ct(_ face: Face, size: CGFloat) -> CTFont {
        if isBundled(face) { return CTFontCreateWithName(face.rawValue as CFString, size, nil) }
        return fallback(face, size: size)
    }

    static func font(_ face: Face, size: CGFloat) -> Font {
        if isBundled(face) { return .custom(face.rawValue, fixedSize: size) }
        return Font(fallback(face, size: size))
    }

    /// Gaegu's x-height is small (0.34 em), so the system face stands in a size smaller.
    private static func fallback(_ face: Face, size: CGFloat) -> CTFont {
        CTFontCreateUIFontForLanguage(face == .handBold ? .emphasizedSystem : .system, size * 0.78, nil)
            ?? CTFontCreateWithName("Helvetica" as CFString, size * 0.78, nil)
    }
}

private final class NotesWidgetFontsToken {}

// MARK: - Measuring and wrapping

enum NotesWidgetWrap {
    static func width(_ text: String, _ face: NotesWidgetFonts.Face, _ size: CGFloat) -> CGFloat {
        width(text, font: NotesWidgetFonts.ct(face, size: size))
    }

    static func width(_ text: String, font: CTFont) -> CGFloat {
        guard !text.isEmpty else { return 0 }
        let string = NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
        let line = CTLineCreateWithAttributedString(string)
        return CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
    }

    /// The text broken into lines no wider than `width`, paragraph breaks kept (blank lines dropped).
    /// A line never ends on a lone one-letter word ("… and I") when the next line can take it.
    static func lines(_ text: String, _ face: NotesWidgetFonts.Face, _ size: CGFloat, width: CGFloat, joinParagraphs: Bool) -> [String] {
        let font = NotesWidgetFonts.ct(face, size: size)
        let cleaned = text.replacingOccurrences(of: "\r\n", with: "\n")
        var paragraphs = cleaned.split(separator: "\n", omittingEmptySubsequences: true)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        if joinParagraphs { paragraphs = [paragraphs.joined(separator: " ")] }
        var out: [String] = []
        for paragraph in paragraphs { out += wrap(paragraph, font: font, width: width) }
        return out
    }

    static func wrap(_ paragraph: String, font: CTFont, width: CGFloat) -> [String] {
        let attributed = NSAttributedString(string: paragraph, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
        let typesetter = CTTypesetterCreateWithAttributedString(attributed)
        let ns = paragraph as NSString
        var lines: [String] = []
        var start = 0
        while start < ns.length {
            let count = CTTypesetterSuggestLineBreak(typesetter, start, Double(width))
            guard count > 0 else { break }
            lines.append(ns.substring(with: NSRange(location: start, length: count)).trimmingCharacters(in: .whitespaces))
            start += count
        }
        // No lone one-letter word at the end of a line ("… so I" / "love you"): carry it over.
        if lines.count > 1 {
            for index in 0..<(lines.count - 1) {
                let words = lines[index].split(separator: " ")
                guard words.count > 2, let last = words.last, last.count == 1, last.first?.isLetter == true else { continue }
                let carried = "\(last) \(lines[index + 1])"
                if Self.width(carried, font: font) <= width {
                    lines[index] = words.dropLast().joined(separator: " ")
                    lines[index + 1] = carried
                }
            }
        }
        // No lone short word on a paragraph's last line ("… water for / me"): it takes a friend along.
        if lines.count > 1 {
            let tail = lines[lines.count - 1].split(separator: " ")
            var previous = lines[lines.count - 2].split(separator: " ").map(String.init)
            if tail.count == 1, tail[0].count <= 5, previous.count >= 3, let moved = previous.popLast() {
                let joined = "\(moved) \(lines[lines.count - 1])"
                if Self.width(joined, font: font) <= width {
                    lines[lines.count - 2] = previous.joined(separator: " ")
                    lines[lines.count - 1] = joined
                }
            }
        }
        return lines.filter { !$0.isEmpty }
    }

    /// A heading in two lines of about the same length ("for after / your exam", never
    /// "for after your / exam"); a heading too long for two is cut short on the second.
    static func balanced(_ text: String, _ face: NotesWidgetFonts.Face, _ size: CGFloat, width: CGFloat) -> [String] {
        let font = NotesWidgetFonts.ct(face, size: size)
        let words = text.split(separator: " ").map(String.init)
        guard words.count > 1 else { return [ellipsize(text, face, size, width: width)] }
        var best: (Int, CGFloat)?
        for split in 1..<words.count {
            let a = Self.width(words[..<split].joined(separator: " "), font: font)
            let b = Self.width(words[split...].joined(separator: " "), font: font)
            guard a <= width else { break }
            let worst = max(a, b)
            if best == nil || worst < best!.1 { best = (split, worst) }
        }
        guard let (split, _) = best else { return [ellipsize(text, face, size, width: width)] }
        let first = words[..<split].joined(separator: " ")
        var second = words[split...].joined(separator: " ")
        if Self.width(second, font: font) > width { second = ellipsize(second, face, size, width: width) }
        return [first, second]
    }

    /// The line shortened at a word with "..." (Gaegu has no "…") so it fits.
    static func ellipsize(_ line: String, _ face: NotesWidgetFonts.Face, _ size: CGFloat, width: CGFloat) -> String {
        let font = NotesWidgetFonts.ct(face, size: size)
        let mark = isGaegu(face) ? "..." : "…"
        var words = line.split(separator: " ").map(String.init)
        while !words.isEmpty {
            let candidate = words.joined(separator: " ").trimmingCharacters(in: CharacterSet(charactersIn: ",.;:!?-—–… ")) + mark
            if Self.width(candidate, font: font) <= width { return candidate }
            words.removeLast()
        }
        // One long unbreakable word: cut it by characters.
        var chars = Array(line)
        while !chars.isEmpty, Self.width(String(chars) + mark, font: font) > width { chars.removeLast() }
        return String(chars) + mark
    }

    private static func isGaegu(_ face: NotesWidgetFonts.Face) -> Bool { face != .script && NotesWidgetFonts.isBundled(face) }

    /// The ascent of a face at a size, to put a line's baseline exactly on a rule.
    static func ascent(_ face: NotesWidgetFonts.Face, _ size: CGFloat) -> CGFloat {
        CTFontGetAscent(NotesWidgetFonts.ct(face, size: size))
    }
}
