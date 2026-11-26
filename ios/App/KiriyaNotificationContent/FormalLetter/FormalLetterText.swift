import CoreText
import SwiftUI

// The words of the formal letter: what goes where (salutation, date, closing, the envelope's
// address), laid out with CoreText up front so the paper's height is known before anything is
// drawn. Lines are then drawn as SwiftUI text at exactly the baselines worked out here, both on the
// animated paper and in the scrolling body, so the two always match to the pixel.

// MARK: - What the letter says

extension FormalLetterContent {
    var isFromMaomao: Bool { from.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().hasPrefix("maomao") }

    /// "open when you miss me" (nil when there's no open-when line).
    var openWhenLine: String? {
        guard var phrase = openWhen?.trimmingCharacters(in: .whitespacesAndNewlines), !phrase.isEmpty else { return nil }
        let lower = phrase.lowercased()
        if lower.hasPrefix("open when") { phrase = String(phrase.dropFirst(9)).trimmingCharacters(in: .whitespaces) }
        return phrase.isEmpty ? nil : FormalLetterType.typographic("open when \(phrase)")
    }

    var cleanTitle: String? {
        let title = self.title.trimmingCharacters(in: .whitespacesAndNewlines)
        return title.isEmpty ? nil : FormalLetterType.typographic(title)
    }

    /// Locked: an "open when"/dated letter that isn't ready yet (checked against `now`).
    func isLocked(at now: Date = Date()) -> Bool {
        guard let lockedUntil else { return false }
        return lockedUntil > now
    }

    /// The closing line and the signature under it.
    var closing: String {
        if isFromMaomao { return "your apothecary \u{2014}" }
        return from.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "with all my love" : "yours, always \u{2014}"
    }

    var signature: String { from.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// The site's fan-writing label on Maomao's letters (LettersPage.jsx).
    var fanLabel: String? {
        guard isFromMaomao else { return nil }
        return kind == "birthday" ? "a maomao-inspired birthday note \u{00B7} fan writing" : "a maomao-inspired note \u{00B7} fan writing"
    }

    /// The envelope's address: a script line (the "open when", else the title) and a small-caps line.
    var envelopeLines: (primary: String, secondary: String?) {
        if let openWhen = openWhenLine {
            return (openWhen, cleanTitle ?? "for Kiriya")
        }
        if let title = cleanTitle {
            return (title, kind == "birthday" ? "a birthday letter for Kiriya" : "for Kiriya")
        }
        return ("for Kiriya", kind == "birthday" ? "a birthday letter" : nil)
    }

    /// The letter's body with its own opening line split off, if it starts with one ("Dear Kiriya,").
    /// `salutation` is what goes above the body: the letter's own, or "my dearest Kiriya," when it
    /// doesn't open with one (Maomao writes in her own voice, so hers never gets one added).
    var salutationAndBody: (salutation: String?, body: String) {
        let text = FormalLetterType.typographic(self.text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n"))
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let firstLine = trimmed.split(separator: "\n", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? ""
        let first = firstLine.trimmingCharacters(in: .whitespaces)
        let lower = first.lowercased()
        let greetings = ["dear", "my ", "my,", "to my", "to the", "hi ", "hi,", "hey", "hello", "darling", "sweetheart", "kiriya",
                         "happy birthday", "good morning", "good night", "goodnight", "love,", "baby", "babe", "honey", "hiii", "hi!"]
        let greets = greetings.contains { lower.hasPrefix($0) } || lower == "hi"
        // Its own line, short, ending like a greeting: that line is the salutation.
        // ("Dear Kiriya," / "happy birthday babyy ♡" / "To the girl with the best laugh,").
        let ownLine = trimmed.contains("\n") && first.count <= 44 && !first.isEmpty
        let addressed = first.hasSuffix(",") && first.count <= 34
        if ownLine && ((greets && !first.hasSuffix(".") && !first.hasSuffix("?")) || addressed) {
            let rest = String(trimmed.dropFirst(firstLine.count)).trimmingCharacters(in: .whitespacesAndNewlines)
            return (first, rest)
        }
        if greets || isFromMaomao { return (nil, trimmed) }
        return ("my dearest Kiriya,", trimmed)
    }

    /// Dates the way the site shows them (en-SG, Singapore time): "26 November 2026".
    static func formatted(_ date: Date, withYear: Bool) -> String {
        let format = DateFormatter()
        format.locale = Locale(identifier: "en_GB")
        format.timeZone = TimeZone(identifier: "Asia/Singapore") ?? .current
        format.dateFormat = withYear ? "d MMMM yyyy" : "d MMMM"
        return format.string(from: date)
    }

    /// "opens on 14 February" (the year only when it isn't this year).
    func lockedLine(now: Date = Date()) -> String? {
        guard let lockedUntil, lockedUntil > now else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Singapore") ?? .current
        let sameYear = calendar.component(.year, from: lockedUntil) == calendar.component(.year, from: now)
        return "opens on \(Self.formatted(lockedUntil, withYear: !sameYear))"
    }
}

// MARK: - Type

enum FormalLetterType {
    enum Style: Equatable { case fanLabel, title, openWhen, date, salutation, body, closing, signature, footer }

    static func size(_ style: Style) -> CGFloat {
        switch style {
        case .fanLabel: return 11
        case .title: return 25
        case .openWhen: return 18.5
        case .date: return 15
        case .salutation: return 21.5
        case .body: return 19.5
        case .closing: return 19.5
        case .signature: return 44
        case .footer: return 17
        }
    }

    static func face(_ style: Style) -> FormalLetterFonts.Face {
        switch style {
        case .fanLabel, .date, .body: return .text
        case .title: return .titleItalic
        case .openWhen, .salutation, .closing, .footer: return .italic
        case .signature: return .script
        }
    }

    static func smallCaps(_ style: Style) -> Bool { style == .fanLabel || style == .date }

    static func tracking(_ style: Style) -> CGFloat {
        switch style {
        case .fanLabel: return 1.1
        case .date: return 1.0
        default: return 0
        }
    }

    static func color(_ style: Style) -> Color {
        switch style {
        case .fanLabel, .date, .openWhen, .footer: return FormalLetterPalette.soft
        case .title, .signature: return FormalLetterPalette.plum
        default: return FormalLetterPalette.ink
        }
    }

    static func ct(_ style: Style) -> CTFont {
        FormalLetterFonts.ct(face(style), size: size(style), smallCaps: smallCaps(style))
    }

    /// One line of the letter as SwiftUI text (what both the paper and the scrolling body draw).
    static func text(_ string: String, _ style: Style) -> Text {
        let base = Text(string)
            .font(FormalLetterFonts.font(face(style), size: size(style), smallCaps: smallCaps(style)))
            .tracking(tracking(style))
            .foregroundColor(color(style))
        switch style {
        case .closing where !string.hasSuffix("\u{2014}"):
            return base + Text(" ") + Text("\u{2764}\u{FE0F}").font(.system(size: 13)).baselineOffset(1)
        default:
            return base
        }
    }

    static func attributed(_ string: String, _ style: Style) -> NSAttributedString {
        var attributes: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTFontAttributeName as String): ct(style)]
        let kern = tracking(style)
        if kern != 0 { attributes[NSAttributedString.Key(kCTKernAttributeName as String)] = kern }
        return NSAttributedString(string: string, attributes: attributes)
    }

    static func measure(_ string: String, _ style: Style) -> CGFloat {
        let line = CTLineCreateWithAttributedString(attributed(string, style))
        var width = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        if style == .signature { width += 26 }  // the heart beside it (FormalLetterPaperLayout.heartRect)
        if style == .closing && !string.hasSuffix("\u{2014}") { width += 22 }
        return width
    }

    /// Typesetter's punctuation: curly quotes and apostrophes, a true ellipsis.
    static func typographic(_ string: String) -> String {
        var out = ""
        out.reserveCapacity(string.count)
        let chars = Array(string.replacingOccurrences(of: "...", with: "\u{2026}"))
        for (index, c) in chars.enumerated() {
            let previous: Character? = index > 0 ? chars[index - 1] : nil
            let next: Character? = index + 1 < chars.count ? chars[index + 1] : nil
            let opensAfter = previous == nil || previous!.isWhitespace || "([{\u{2014}\u{2013}-/".contains(previous!)
            switch c {
            case "\"":
                out.append(opensAfter ? "\u{201C}" : "\u{201D}")
            case "'":
                if let previous, previous.isLetter || previous.isNumber || previous == "." || previous == "," || previous == "!" || previous == "?" {
                    out.append("\u{2019}")
                } else if opensAfter, let next, next.isLetter || next.isNumber {
                    // 'tis, '90s are apostrophes too, but an opening quote is far likelier here.
                    out.append("\u{2018}")
                } else {
                    out.append("\u{2019}")
                }
            default:
                out.append(c)
            }
        }
        return out
    }

    /// Breaks a paragraph into lines that fit `width`: never a one-letter word left at the end of
    /// a line, never a lone short word on a paragraph's last line, never a split emoji.
    static func wrap(_ string: String, _ style: Style, width: CGFloat, maxLines: Int? = nil) -> [String] {
        let attr = attributed(string, style)
        let ns = attr.string as NSString
        let typesetter = CTTypesetterCreateWithAttributedString(attr)
        var lines: [String] = []
        var start = 0
        while start < ns.length {
            var count = CTTypesetterSuggestLineBreak(typesetter, start, Double(width))
            if count <= 0 { count = 1 }
            if start + count < ns.length {
                let piece = ns.substring(with: NSRange(location: start, length: count)) as NSString
                let trimmed = piece.trimmingCharacters(in: .whitespacesAndNewlines) as NSString
                let space = trimmed.range(of: " ", options: .backwards)
                if space.location != NSNotFound, space.location > 0, trimmed.length - space.location - 1 == 1,
                   let scalar = trimmed.substring(from: space.location + 1).unicodeScalars.first,
                   CharacterSet.letters.contains(scalar) {
                    count = space.location + 1
                }
            }
            let range = ns.rangeOfComposedCharacterSequences(for: NSRange(location: start, length: min(count, ns.length - start)))
            lines.append(ns.substring(with: range).trimmingCharacters(in: .whitespacesAndNewlines))
            start = range.location + range.length
            if let maxLines, lines.count == maxLines, start < ns.length {
                lines[lines.count - 1] = ellipsize(lines[lines.count - 1] + " " + ns.substring(from: start), style, width: width)
                return lines
            }
        }
        // A widow: one short word alone on the last line (an emoji beside it doesn't count as
        // company). Bring a word down to keep it company.
        func words(_ line: String) -> Int {
            line.split(separator: " ").filter { $0.unicodeScalars.contains { CharacterSet.letters.contains($0) } }.count
        }
        if lines.count >= 2, let last = lines.last, words(last) == 1, last.count <= 16 {
            let previous = lines[lines.count - 2]
            if let space = previous.lastIndex(of: " ") {
                let kept = String(previous[..<space])
                let moved = String(previous[previous.index(after: space)...]) + " " + last
                if kept.contains(" "), measure(moved, style) <= width {
                    lines[lines.count - 2] = kept
                    lines[lines.count - 1] = moved
                }
            }
        }
        return lines.filter { !$0.isEmpty }.isEmpty ? [""] : lines
    }

    static func ellipsize(_ string: String, _ style: Style, width: CGFloat) -> String {
        var words = string.trimmingCharacters(in: .whitespacesAndNewlines)
        let dots = "\u{2026}"
        func fits(_ s: String) -> Bool { measure(s + dots, style) <= width }
        while words.hasSuffix("\u{2026}") || words.hasSuffix(".") { words.removeLast() }
        if fits(words) { return words + dots }
        while !words.isEmpty, !fits(words) {
            if let space = words.lastIndex(of: " ") {
                words = String(words[..<space]).trimmingCharacters(in: .whitespaces)
            } else {
                words.removeLast()
            }
        }
        while let last = words.last, ",;:\u{2014}\u{2013}-".contains(last) { words.removeLast() }
        return words + dots
    }
}

// MARK: - The paper's layout

enum FormalLetterPaperMetrics {
    static let topPad: CGFloat = 20
    static let crestHeight: CGFloat = 50
    static let fanLabelPitch: CGFloat = 14
    static let titleFirst: CGFloat = 42
    static let titlePitch: CGFloat = 30
    static let openWhenAfterTitle: CGFloat = 27
    static let openWhenFirst: CGFloat = 38
    static let openWhenPitch: CGFloat = 24
    static let ornamentAfterHeader: CGFloat = 21
    static let ornamentBare: CGFloat = 14
    static let dateGap: CGFloat = 32
    static let salutationAfterDate: CGFloat = 36
    static let salutationAfterOrnament: CGFloat = 38
    static let bodyAfterSalutation: CGFloat = 33
    static let bodyAfterDate: CGFloat = 38
    static let bodyAfterOrnament: CGFloat = 40
    static let pitch: CGFloat = 27
    static let paragraphGap: CGFloat = 11
    static let closingGap: CGFloat = 43
    static let signatureGap: CGFloat = 46
    static let bottomPad: CGFloat = 34
    static let dividerGap: CGFloat = 31
    static let footerGap: CGFloat = 29
    static let footerBottom: CGFloat = 25
    /// The scrolling body's soft edges.
    static let fadeTop: CGFloat = 20
    static let fadeBottom: CGFloat = 26
    /// The scrolling body's window ends this far above the paper's bottom edge.
    static let viewportBottomInset: CGFloat = 12
    static let corner: CGFloat = 2.5
    static let restNote = "the rest is waiting in the app \u{2764}\u{FE0F}"

    static func padX(_ width: CGFloat) -> CGFloat { max(24, (width * 0.084).rounded()) }
}

struct FormalLetterPaperLayout: Equatable {
    enum Align: Equatable { case leading, center, trailing, block }
    struct Line: Equatable {
        var text: String
        var style: FormalLetterType.Style
        var align: Align
        var baseline: CGFloat
    }

    let key: String
    let width: CGFloat
    /// The paper's height (when the body scrolls, the height of its frame).
    let height: CGFloat
    let lines: [Line]
    let padX: CGFloat
    let crestCenterY: CGFloat
    let ornamentY: CGFloat
    let dividerY: CGFloat?
    /// The left edge of the closing and signature, which sit together on the right.
    let closingX: CGFloat
    /// Whether the "rest is waiting in the app" footer ends the letter.
    let truncated: Bool
    /// When the body scrolls: the window it scrolls in (paper coordinates), and how tall the
    /// scrolling content is (it starts at the window's top).
    let viewport: ClosedRange<CGFloat>?
    let scrollContentHeight: CGFloat
    let seed: Double
    /// Maomao's letter (an apothecary's herb by her name rather than a kitten's paw prints).
    var maomao = false

    static func == (a: Self, b: Self) -> Bool { a.key == b.key }

    var foldedHeight: CGFloat { height / 3 }
    var scrolls: Bool { viewport != nil }

    // MARK: making one

    private static let cacheLock = NSLock()
    nonisolated(unsafe) private static var cache: [String: FormalLetterPaperLayout] = [:]  // guarded by `cacheLock`

    static func make(content: FormalLetterContent, width: CGFloat, maxHeight: CGFloat, scrollable: Bool) -> FormalLetterPaperLayout {
        let key = "\(width.rounded())|\(maxHeight.rounded())|\(scrollable)|\(content.title)|\(content.openWhen ?? "∅")|\(content.from)|\(content.kind ?? "∅")|\(content.date?.timeIntervalSince1970 ?? 0)|\(content.truncated)|\(content.text)"
        cacheLock.lock()
        if let hit = cache[key] { cacheLock.unlock(); return hit }
        cacheLock.unlock()
        var made = build(content: content, width: width, maxHeight: maxHeight, scrollable: scrollable, key: key)
        made.maomao = content.isFromMaomao
        cacheLock.lock()
        if cache.count > 24 { cache.removeAll() }
        cache[key] = made
        cacheLock.unlock()
        return made
    }

    private static func build(content: FormalLetterContent, width: CGFloat, maxHeight: CGFloat, scrollable: Bool, key: String,
                              extraGap: CGFloat = 0) -> FormalLetterPaperLayout {
        typealias M = FormalLetterPaperMetrics
        typealias T = FormalLetterType
        let padX = M.padX(width)
        // A little slack so a line drawn by SwiftUI can never be wider than the one CoreText measured.
        let textWidth = width - 2 * padX - 4
        var head: [Line] = []
        var y = M.topPad

        if let label = content.fanLabel {
            for line in T.wrap(label, .fanLabel, width: textWidth, maxLines: 2) {
                y += M.fanLabelPitch
                head.append(Line(text: line, style: .fanLabel, align: .center, baseline: y))
            }
            y += 6
        }
        let crestCenterY = y + M.crestHeight / 2
        y += M.crestHeight + extraGap

        var hasHeader = false
        if let title = content.cleanTitle {
            hasHeader = true
            for (index, line) in T.wrap(title, .title, width: textWidth - 12, maxLines: 3).enumerated() {
                y += index == 0 ? M.titleFirst : M.titlePitch
                head.append(Line(text: line, style: .title, align: .center, baseline: y))
            }
        }
        if let openWhen = content.openWhenLine {
            for (index, line) in T.wrap(openWhen, .openWhen, width: textWidth - 12, maxLines: 2).enumerated() {
                y += index > 0 ? M.openWhenPitch : (hasHeader ? M.openWhenAfterTitle : M.openWhenFirst)
                head.append(Line(text: line, style: .openWhen, align: .center, baseline: y))
            }
            hasHeader = true
        }
        y += hasHeader ? M.ornamentAfterHeader : M.ornamentBare
        let ornamentY = y

        var last: CGFloat = 0  // what came last: 0 ornament, 1 date, 2 salutation
        if let date = content.date {
            y += M.dateGap
            head.append(Line(text: FormalLetterContent.formatted(date, withYear: true), style: .date, align: .trailing, baseline: y))
            last = 1
        }
        let split = content.salutationAndBody
        if let salutation = split.salutation {
            for (index, line) in T.wrap(salutation, .salutation, width: textWidth, maxLines: 2).enumerated() {
                y += index > 0 ? M.pitch : (last == 1 ? M.salutationAfterDate : M.salutationAfterOrnament)
                head.append(Line(text: line, style: .salutation, align: .leading, baseline: y))
            }
            last = 2
        }
        let bodyStart = y + (last == 2 ? M.bodyAfterSalutation : last == 1 ? M.bodyAfterDate : M.bodyAfterOrnament)

        // The body, paragraph by paragraph (a blank line between paragraphs; a single newline is a
        // line break within one, as on the site).
        var body: [Line] = []
        var by = bodyStart - M.pitch
        var firstParagraph = true
        for paragraph in paragraphs(split.body) {
            by += firstParagraph ? 0 : M.paragraphGap
            firstParagraph = false
            for row in paragraph {
                for line in T.wrap(row, .body, width: textWidth) {
                    by += M.pitch
                    body.append(Line(text: line, style: .body, align: .leading, baseline: by))
                }
            }
        }
        if body.isEmpty { by = bodyStart - M.pitch + M.pitch * 0.4 }

        // The closing on the right: "yours, always —" and the signature, left-aligned together.
        let closing = content.closing
        let signature = content.signature
        let blockWidth = max(T.measure(closing, .closing), signature.isEmpty ? 0 : T.measure(signature, .signature))
        let closingX = max(padX, min(width * 0.47, width - padX - blockWidth - 4)).rounded()

        func finished(lines: [Line], truncated: Bool, lastBaseline: CGFloat) -> (lines: [Line], height: CGFloat, divider: CGFloat?) {
            var all = lines
            if truncated {
                let divider = lastBaseline + M.dividerGap
                let footerY = divider + M.footerGap
                all.append(Line(text: M.restNote, style: .footer, align: .center, baseline: footerY))
                return (all, footerY + M.footerBottom, divider)
            }
            var cy = lastBaseline + M.closingGap
            all.append(Line(text: closing, style: .closing, align: .block, baseline: cy))
            if !signature.isEmpty {
                cy += M.signatureGap
                all.append(Line(text: signature, style: .signature, align: .block, baseline: cy))
            }
            return (all, cy + M.bottomPad, nil)
        }

        let lastBody = body.last?.baseline ?? by
        let natural = finished(lines: head + body, truncated: content.truncated, lastBaseline: lastBody)
        let limit = max(maxHeight, 380)

        if thirds(natural.height) <= limit {
            return FormalLetterPaperLayout(key: key, width: width, height: thirds(natural.height), lines: natural.lines, padX: padX,
                                           crestCenterY: crestCenterY, ornamentY: ornamentY, dividerY: natural.divider, closingX: closingX,
                                           truncated: content.truncated, viewport: nil, scrollContentHeight: 0, seed: seed(key))
        }

        if scrollable {
            // The paper keeps its frame; everything under the crest scrolls inside it. At rest,
            // nothing may sit in the window's soft top edge: move the words down if they would.
            let top = (crestCenterY + M.crestHeight / 2 + 6).rounded()
            if extraGap == 0, let first = (head + body).first(where: { $0.baseline > top && $0.style != .fanLabel }) {
                let firstTop = min(first.baseline - FormalLetterType.size(first.style) * 0.78, ornamentY - 5)
                let shortfall = (top + M.fadeTop + 3) - firstTop
                if shortfall > 0 {
                    return build(content: content, width: width, maxHeight: maxHeight, scrollable: true, key: key, extraGap: shortfall.rounded(.up))
                }
            }
            let frame = (limit / 3).rounded(.down) * 3
            let bottom = frame - M.viewportBottomInset
            let contentHeight = (natural.height - top - M.bottomPad + M.fadeBottom + 14).rounded(.up)
            return FormalLetterPaperLayout(key: key, width: width, height: frame, lines: natural.lines, padX: padX,
                                           crestCenterY: crestCenterY, ornamentY: ornamentY, dividerY: natural.divider, closingX: closingX,
                                           truncated: content.truncated, viewport: top...bottom, scrollContentHeight: contentHeight, seed: seed(key))
        }

        // Stop cleanly: as many lines as fit, an ellipsis, and the footer.
        let footerRoom = M.dividerGap + M.footerGap + M.footerBottom
        var kept = body.filter { $0.baseline + footerRoom <= limit - 2 }
        if kept.isEmpty, let first = body.first { kept = [first] }
        while kept.count > 1, kept.last?.text.isEmpty == true { kept.removeLast() }
        if var lastLine = kept.last {
            lastLine.text = T.ellipsize(lastLine.text, .body, width: textWidth)
            kept[kept.count - 1] = lastLine
        }
        let cut = finished(lines: head + kept, truncated: true, lastBaseline: kept.last?.baseline ?? bodyStart)
        return FormalLetterPaperLayout(key: key, width: width, height: thirds(cut.height), lines: cut.lines, padX: padX,
                                       crestCenterY: crestCenterY, ornamentY: ornamentY, dividerY: cut.divider, closingX: closingX,
                                       truncated: true, viewport: nil, scrollContentHeight: 0, seed: seed(key))
    }

    /// A height in whole points that divides into three whole-point folds, so each fold's slice
    /// (and the scrolling body that takes over at rest) lands on whole pixels.
    private static func thirds(_ height: CGFloat) -> CGFloat { (height / 3).rounded(.up) * 3 }

    /// Paragraphs (split on blank lines), each a list of its hard lines.
    private static func paragraphs(_ text: String) -> [[String]] {
        var out: [[String]] = []
        var current: [String] = []
        for piece in text.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = piece.trimmingCharacters(in: .whitespaces)
            if line.isEmpty {
                if !current.isEmpty { out.append(current); current = [] }
            } else {
                current.append(line)
            }
        }
        if !current.isEmpty { out.append(current) }
        return out
    }

    private static func seed(_ key: String) -> Double {
        var hash: UInt64 = 1469598103934665603
        for byte in key.utf8.prefix(400) { hash = (hash ^ UInt64(byte)) &* 1099511628211 }
        return Double(hash % 1000) / 100
    }

    var signatureLine: Line? { lines.first { $0.style == .signature } }

    /// The red heart just after the signature (worked out from CoreText's width of the name, so
    /// the paper, the scrolling body and the beating heart all put it in the same place).
    func heartRect(for line: Line) -> CGRect {
        let name = FormalLetterType.measure(line.text, .signature) - 26
        let size = CGSize(width: 12, height: 11)
        return CGRect(x: (closingX + name + 9).rounded(), y: (line.baseline - 15).rounded(), width: size.width, height: size.height)
    }

    /// The crest kitten's canvas: centred on the paper's middle and the crest, on whole pixels.
    var kittenCanvas: CGSize {
        let w = Int(width.rounded())
        return CGSize(width: w % 2 == 1 ? 61 : 60, height: 60)
    }

    /// Which third of the paper a point is in.
    func fold(of y: CGFloat) -> Int { max(0, min(2, Int(y / (height / 3)))) }

    /// The heart beats on its own (as an overlay on its third of the paper) when the whole
    /// letter is on the paper, and it isn't sitting on a crease.
    var heartBeats: Bool {
        guard !scrolls, let line = signatureLine else { return false }
        let rect = heartRect(for: line)
        return fold(of: rect.minY - 2) == fold(of: rect.maxY + 2)
    }

    /// Where the touches go: the pressed flower in the corner, right of the crest.
    var cornerBinding: CGPoint { CGPoint(x: width - 30, y: crestCenterY + 9) }

    /// Where a line starts, given the width SwiftUI measured for it.
    func x(for line: Line, measured: CGFloat) -> CGFloat {
        switch line.align {
        case .leading: return padX
        case .trailing: return width - padX - measured
        case .center: return ((width - measured) / 2).rounded()
        case .block: return closingX
        }
    }
}
