import CoreText
import SwiftUI
import UIKit

// Type for the note jar card. The site writes its notes in Gaegu (--font-hand, SIL OFL), so the card
// bundles it (JarGaegu-Regular.ttf, registered at runtime, no Info.plist entry); the UI bits use the
// system's rounded face, the nearest match for the site's M PLUS Rounded 1c. Every line is laid out
// with CoreText up front, so the card knows its exact height before it draws (no measuring passes)
// and a frame rendered in the lab is exactly a frame on the phone.

private final class JarBundleToken {}

enum JarFonts {
    static let handName = "Gaegu-Regular"

    /// Registers the bundled Gaegu once per process. The Letter card ships the same face as
    /// Gaegu-Regular.ttf; whichever registers first wins and the other is a harmless no-op.
    static let hasHand: Bool = {
        if UIFont(name: handName, size: 12) != nil { return true }
        let bundles = [Bundle(for: JarBundleToken.self), Bundle.main]
        for bundle in bundles {
            for file in ["JarGaegu-Regular", "Gaegu-Regular"] {
                guard let url = bundle.url(forResource: file, withExtension: "ttf") else { continue }
                var error: Unmanaged<CFError>?
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error)
                if UIFont(name: handName, size: 12) != nil { return true }
            }
        }
        return false
    }()

    /// Gaegu at `size`, or (if it couldn't load) the rounded system face at a matching visual size.
    static func hand(_ size: CGFloat) -> CTFont {
        if hasHand, let font = UIFont(name: handName, size: size) { return font as CTFont }
        return rounded(size * 0.78, .regular)
    }

    static func rounded(_ size: CGFloat, _ weight: UIFont.Weight) -> CTFont {
        let base = UIFont.systemFont(ofSize: size, weight: weight)
        let descriptor = base.fontDescriptor.withDesign(.rounded) ?? base.fontDescriptor
        return UIFont(descriptor: descriptor, size: size) as CTFont
    }
}

/// Lines laid out by CoreText, ready to draw.
struct JarTextBlock {
    var lines: [CTLine] = []
    /// Each line's inked width (trailing spaces excluded).
    var widths: [CGFloat] = []
    var lineHeight: CGFloat = 0
    /// Distance from a line's top to its baseline.
    var baseline: CGFloat = 0
    var truncated = false
    /// A red heart drawn after the last word (the card's own heart, not the emoji): x-centre on the last line, and its height.
    var heart: (x: CGFloat, height: CGFloat, lift: CGFloat)?
    var height: CGFloat { CGFloat(lines.count) * lineHeight }
    var maxWidth: CGFloat { widths.max() ?? 0 }
    var isEmpty: Bool { lines.isEmpty }
}

enum JarText {
    private final class Cache: @unchecked Sendable {
        let lock = NSLock()
        var blocks: [String: JarTextBlock] = [:]
        var lines: [String: CTLine] = [:]
    }
    private static let cache = Cache()

    private static func attributed(_ string: String, font: CTFont, color: JarRGB, kern: CGFloat) -> NSAttributedString {
        var attributes: [NSAttributedString.Key: Any] = [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): color.cg,
        ]
        if kern != 0 { attributes[NSAttributedString.Key(kCTKernAttributeName as String)] = kern }
        return NSAttributedString(string: forFont(string, font), attributes: attributes)
    }

    /// Gaegu's curly quotes carry a huge right side bearing ("don’ t"); its straight ones sit tight.
    private static func forFont(_ string: String, _ font: CTFont) -> String {
        guard (CTFontCopyPostScriptName(font) as String) == JarFonts.handName else { return string }
        return string.replacingOccurrences(of: "\u{2019}", with: "'").replacingOccurrences(of: "\u{2018}", with: "'")
            .replacingOccurrences(of: "\u{201C}", with: "\"").replacingOccurrences(of: "\u{201D}", with: "\"")
    }

    private static func key(_ string: String, _ font: CTFont, _ color: JarRGB, _ extra: String) -> String {
        "\(CTFontCopyPostScriptName(font))|\(CTFontGetSize(font))|\(color.r),\(color.g),\(color.b),\(color.a)|\(extra)|\(string)"
    }

    /// One line, unwrapped.
    static func line(_ string: String, font: CTFont, color: JarRGB, kern: CGFloat = 0) -> CTLine {
        let key = key(string, font, color, "line\(kern)")
        cache.lock.lock(); defer { cache.lock.unlock() }
        if let line = cache.lines[key] { return line }
        let line = CTLineCreateWithAttributedString(attributed(string, font: font, color: color, kern: kern))
        if cache.lines.count > 300 { cache.lines.removeAll() }
        cache.lines[key] = line
        return line
    }

    /// Wraps `string` to `width`. Past `maxLines`, the last line ends in an ellipsis.
    static func block(_ string: String, font: CTFont, color: JarRGB, width: CGFloat, lineHeight: CGFloat,
                      kern: CGFloat = 0, maxLines: Int = .max, heart: Bool = false) -> JarTextBlock {
        let key = key(string, font, color, "block\(width)|\(lineHeight)|\(kern)|\(maxLines)|\(heart)")
        cache.lock.lock()
        if let block = cache.blocks[key] { cache.lock.unlock(); return block }
        cache.lock.unlock()

        let words = heart ? headingWithoutHearts(string) : string
        let text = NSMutableAttributedString(attributedString: attributed(words, font: font, color: color, kern: kern))
        if heart {
            // Room for the heart, glued to the last word: a no-break space and an invisible "w".
            text.append(attributed("\u{00A0}w", font: font, color: color.alpha(0), kern: kern))
        }
        let typesetter = CTTypesetterCreateWithAttributedString(text)
        var block = JarTextBlock()
        block.lineHeight = lineHeight
        // Centre the font's ascent+descent in the line box, as CSS does with line-height.
        let ascent = CTFontGetAscent(font), descent = CTFontGetDescent(font)
        block.baseline = ((lineHeight - (ascent + descent)) / 2 + ascent).rounded(.toNearestOrAwayFromZero)
        var start = 0
        let length = text.length
        while start < length {
            let count = max(1, CTTypesetterSuggestLineBreak(typesetter, start, Double(max(width, 20))))
            if block.lines.count == maxLines - 1, start + count < length {
                // The last line allowed: the rest, truncated with "…".
                let rest = CTTypesetterCreateLine(typesetter, CFRange(location: start, length: length - start))
                let ellipsis = CTLineCreateWithAttributedString(attributed("…", font: font, color: color, kern: kern))
                let line = CTLineCreateTruncatedLine(rest, Double(width), .end, ellipsis) ?? rest
                block.lines.append(line)
                block.widths.append(inkWidth(line))
                block.truncated = true
                break
            }
            let line = CTTypesetterCreateLine(typesetter, CFRange(location: start, length: count))
            block.lines.append(line)
            block.widths.append(inkWidth(line))
            start += count
        }
        if heart, let last = block.lines.last {
            let index = text.length - 1
            let x0 = CTLineGetOffsetForStringIndex(last, index, nil), x1 = CTLineGetOffsetForStringIndex(last, index + 1, nil)
            let size = CTFontGetSize(font)
            block.heart = (x: (x0 + x1) / 2, height: size * 0.6, lift: size * 0.27)
        }
        cache.lock.lock()
        if cache.blocks.count > 400 { cache.blocks.removeAll() }
        cache.blocks[key] = block
        cache.lock.unlock()
        return block
    }

    static func inkWidth(_ line: CTLine) -> CGFloat {
        CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil) - CTLineGetTrailingWhitespaceWidth(line))
    }

    /// Draws a line with its baseline's left end at `origin` (y grows downwards, as in SwiftUI).
    static func draw(_ line: CTLine, in context: GraphicsContext, at origin: CGPoint) {
        context.withCGContext { cg in
            cg.saveGState()
            cg.textMatrix = CGAffineTransform(scaleX: 1, y: -1)
            cg.textPosition = origin
            CTLineDraw(line, cg)
            cg.restoreGState()
        }
    }

    static func draw(_ line: CTLine, in context: GraphicsContext, centeredAt x: CGFloat, baseline: CGFloat) {
        draw(line, in: context, at: CGPoint(x: x - inkWidth(line) / 2, y: baseline))
    }

    /// Draws a block's lines; `align` 0 = leading, 0.5 = centred.
    static func draw(_ block: JarTextBlock, in context: GraphicsContext, origin: CGPoint, width: CGFloat, align: CGFloat = 0) {
        for (index, line) in block.lines.enumerated() {
            let x = origin.x + (width - block.widths[index]) * align
            let baseline = origin.y + CGFloat(index) * block.lineHeight + block.baseline
            draw(line, in: context, at: CGPoint(x: x, y: baseline))
            if index == block.lines.count - 1, let heart = block.heart {
                JarArtist.drawHeart(context, center: CGPoint(x: x + heart.x, y: baseline - heart.lift), height: heart.height, edge: false)
            }
        }
    }

    /// The push title without its trailing hearts (the card draws its own red heart in front, as the app's day tag does).
    static func headingWithoutHearts(_ heading: String) -> String {
        var text = heading.trimmingCharacters(in: .whitespacesAndNewlines)
        let hearts: [String] = ["❤️", "❤", "♡", "♥", "♥️", "💕", "💗", "💖", "🩷", "<3"]
        var changed = true
        while changed {
            changed = false
            for heart in hearts where text.hasSuffix(heart) {
                text = String(text.dropLast(heart.count)).trimmingCharacters(in: .whitespaces)
                changed = true
            }
        }
        return text.isEmpty ? heading : text
    }
}
