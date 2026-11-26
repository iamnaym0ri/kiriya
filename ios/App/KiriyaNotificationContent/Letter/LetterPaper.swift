import CoreText
import SwiftUI

// The note paper: ruled stationery with the note written on its lines in the site's handwriting.
// The words are laid out with CoreText on a fixed grid (so the paper's height is known before
// anything is drawn and every line sits on a rule, emoji or not), then drawn as SwiftUI text.

enum LetterPaperMetrics {
    static let bodySize: CGFloat = 22
    static let titleSize: CGFloat = 26
    static let noteSize: CGFloat = 18.5
    static let bylineSize: CGFloat = 30
    static let pitch: CGFloat = 30
    static let firstBaseline: CGFloat = 56
    static let bottomInset: CGFloat = 26
    static let insetX: CGFloat = 24
    static let ruleInset: CGFloat = 14
    static let ruleDrop: CGFloat = 3
    static let minRows = 4
    static let corner: CGFloat = 7
    static let restNote = "the rest is waiting in the app ❤️"
    /// Below the signature when the note goes on in the app: a dashed divider, then the footer line.
    static let dividerGap: CGFloat = 22
    static let footerGap: CGFloat = 25
    static let footerBottom: CGFloat = 16
    static var footerExtra: CGFloat { dividerGap + footerGap + footerBottom - bottomInset }
}

struct LetterPaperLayout: Equatable {
    enum Style: Equatable { case title, body, note, byline }
    enum Align: Equatable { case leading, trailing, center }
    struct Line: Equatable {
        var text: String
        var style: Style
        var align: Align
        var baseline: CGFloat = 0
    }

    let key: String
    let width: CGFloat
    let height: CGFloat
    let lines: [Line]
    let rules: [CGFloat]
    /// How the paper is folded inside the envelope: in half (short notes) or in thirds.
    let folds: Int
    let truncated: Bool
    let hasTitle: Bool
    /// The "rest is waiting in the app" footer and the dashed divider above it.
    let footer: Line?
    let dividerY: CGFloat?

    static func == (a: LetterPaperLayout, b: LetterPaperLayout) -> Bool { a.key == b.key }

    var foldedHeight: CGFloat { height / CGFloat(folds) }

    // MARK: making one

    private static let cacheLock = NSLock()
    private static var cache: [String: LetterPaperLayout] = [:]

    static func make(content: LetterContent, width: CGFloat, maxHeight: CGFloat) -> LetterPaperLayout {
        let key = "\(width.rounded())|\(maxHeight.rounded())|\(content.title ?? "∅")|\(content.byline)|\(content.truncated)|\(content.text)"
        cacheLock.lock()
        if let hit = cache[key] { cacheLock.unlock(); return hit }
        cacheLock.unlock()
        let made = build(content: content, width: width, maxHeight: maxHeight, key: key)
        cacheLock.lock()
        if cache.count > 24 { cache.removeAll() }
        cache[key] = made
        cacheLock.unlock()
        return made
    }

    private static func build(content: LetterContent, width: CGFloat, maxHeight: CGFloat, key: String) -> LetterPaperLayout {
        typealias M = LetterPaperMetrics
        // A little slack so a line drawn by SwiftUI can never be wider than the one CoreText measured.
        let textWidth = width - 2 * M.insetX - 4
        func rowsAllowed(footer: Bool) -> Int {
            let room = maxHeight - M.firstBaseline - M.bottomInset - (footer ? M.footerExtra : 0)
            return max(M.minRows, Int((room / M.pitch).rounded(.down)) + 1)
        }
        let bodyFont = LetterFonts.ct(.hand, size: M.bodySize)
        let titleFont = LetterFonts.ct(.handBold, size: M.titleSize)

        var rows: [Line] = []
        var hasTitle = false
        if let title = content.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty {
            hasTitle = true
            for line in wrap(title, font: titleFont, width: textWidth, maxLines: 2) {
                rows.append(Line(text: line, style: .title, align: .leading))
            }
        }

        var body: [String] = []
        for paragraph in paragraphs(content.text) {
            if paragraph.isEmpty { body.append("") } else { body += wrap(paragraph, font: bodyFont, width: textWidth, maxLines: nil) }
        }
        if body.isEmpty { body = [""] }

        // The signature with its red heart; with no name, a lone heart, unless the footer (which
        // ends in one) is there anyway.
        let byline = content.byline.trimmingCharacters(in: .whitespacesAndNewlines)
        var truncated = content.truncated
        let available = rowsAllowed(footer: truncated) - rows.count - 1
        if body.count > available {
            truncated = true
            let signRows = byline.isEmpty ? 0 : 1
            let room = rowsAllowed(footer: true) - rows.count - signRows
            body = Array(body.prefix(max(1, room)))
            while body.count > 1, body.last?.isEmpty == true { body.removeLast() }
            body[body.count - 1] = ellipsize(body[body.count - 1], font: bodyFont, width: textWidth)
        }
        rows += body.map { Line(text: $0, style: .body, align: .leading) }
        let signs = !byline.isEmpty || !truncated
        while rows.count + (signs ? 1 : 0) < M.minRows { rows.append(Line(text: "", style: .body, align: .leading)) }
        if signs { rows.append(Line(text: byline, style: .byline, align: .trailing)) }

        for index in rows.indices { rows[index].baseline = M.firstBaseline + CGFloat(index) * M.pitch }
        let last = rows.last?.baseline ?? M.firstBaseline
        var height = last + M.bottomInset
        var footer: Line?
        var dividerY: CGFloat?
        if truncated {
            dividerY = last + M.dividerGap
            footer = Line(text: M.restNote, style: .note, align: .center, baseline: last + M.dividerGap + M.footerGap)
            height = last + M.dividerGap + M.footerGap + M.footerBottom
        }
        let rules = rows.map { $0.baseline + M.ruleDrop }
        return LetterPaperLayout(key: key, width: width, height: height, lines: rows + (footer.map { [$0] } ?? []), rules: rules,
                                 folds: height > 300 ? 3 : 2, truncated: truncated, hasTitle: hasTitle,
                                 footer: footer, dividerY: dividerY)
    }

    private static func paragraphs(_ text: String) -> [String] {
        let raw = text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n")
        var out: [String] = []
        for piece in raw.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = piece.trimmingCharacters(in: .whitespaces)
            if line.isEmpty {
                if let last = out.last, !last.isEmpty { out.append("") }
            } else {
                out.append(line)
            }
        }
        while out.last?.isEmpty == true { out.removeLast() }
        return out
    }

    private static func attributed(_ string: String, font: CTFont) -> NSAttributedString {
        NSAttributedString(string: string, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
    }

    static func measure(_ string: String, font: CTFont) -> CGFloat {
        let line = CTLineCreateWithAttributedString(attributed(string, font: font))
        return CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
    }

    private static func wrap(_ string: String, font: CTFont, width: CGFloat, maxLines: Int?) -> [String] {
        let attr = attributed(string, font: font)
        let ns = attr.string as NSString
        let typesetter = CTTypesetterCreateWithAttributedString(attr)
        var lines: [String] = []
        var start = 0
        while start < ns.length {
            var count = CTTypesetterSuggestLineBreak(typesetter, start, Double(width))
            if count <= 0 { count = 1 }
            // Don't leave a one-letter word ("I", "a") hanging at the end of a line.
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
            // Never split a composed character (an emoji with modifiers, say).
            let range = ns.rangeOfComposedCharacterSequences(for: NSRange(location: start, length: min(count, ns.length - start)))
            let piece = ns.substring(with: range).trimmingCharacters(in: .whitespacesAndNewlines)
            lines.append(piece)
            start = range.location + range.length
            if let maxLines, lines.count == maxLines, start < ns.length {
                let rest = ns.substring(from: start)
                lines[lines.count - 1] = ellipsize(piece + " " + rest, font: font, width: width)
                break
            }
        }
        return lines
    }

    private static func ellipsize(_ string: String, font: CTFont, width: CGFloat) -> String {
        var words = string.trimmingCharacters(in: .whitespacesAndNewlines)
        // Three of the handwriting's own dots (Gaegu has no "…").
        let dots = "..."
        func fits(_ s: String) -> Bool { measure(s + dots, font: font) <= width }
        if fits(words) { return words + dots }
        while !words.isEmpty, !fits(words) {
            if let space = words.lastIndex(of: " ") {
                words = String(words[..<space]).trimmingCharacters(in: .whitespaces)
            } else {
                words.removeLast()
            }
        }
        while let last = words.last, ",;:—–-".contains(last) { words.removeLast() }
        return words + dots
    }
}

// MARK: - Drawing the paper

/// The front of the note: paper, rules, a soft crease where it was folded, and the words.
/// `top`/`height` pick the slice of the paper this view shows (a fold), so a fold never holds
/// a whole sheet's worth of drawing.
struct LetterPaperFace: View, Equatable {
    let layout: LetterPaperLayout
    var top: CGFloat = 0
    var height: CGFloat?
    var showCreases = true

    var body: some View {
        let sliceHeight = height ?? layout.height
        let top = self.top
        return Canvas { canvas, _ in
            typealias M = LetterPaperMetrics
            var ctx = canvas
            ctx.translateBy(x: 0, y: -top)
            let size = CGSize(width: layout.width, height: layout.height)
            let sheet = Path(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: M.corner, style: .continuous)
            ctx.fill(sheet, with: .linearGradient(Gradient(colors: [LetterPalette.paper, LetterPalette.paperShade]),
                                                  startPoint: .zero, endPoint: CGPoint(x: size.width * 0.3, y: size.height)))
            // A blush along the top, like the site's note slips.
            ctx.fill(Path(CGRect(x: 0, y: 0, width: size.width, height: 30)).intersection(sheet),
                     with: .linearGradient(Gradient(colors: [LetterPalette.rgb(0xfbe3ef, 0.55), LetterPalette.rgb(0xfbe3ef, 0)]),
                                           startPoint: .zero, endPoint: CGPoint(x: 0, y: 30)))

            var rules = Path()
            for y in layout.rules {
                rules.move(to: CGPoint(x: M.ruleInset, y: y))
                rules.addLine(to: CGPoint(x: size.width - M.ruleInset, y: y))
            }
            ctx.stroke(rules, with: .color(LetterPalette.rule), lineWidth: 1)
            if let y = layout.dividerY {
                var divider = Path()
                divider.move(to: CGPoint(x: M.ruleInset + 8, y: y))
                divider.addLine(to: CGPoint(x: size.width - M.ruleInset - 8, y: y))
                ctx.stroke(divider, with: .color(LetterPalette.lilacDeep), style: StrokeStyle(lineWidth: 1, lineCap: .round, dash: [4, 4]))
            }

            if showCreases {
                // Where it was folded: a soft valley of shade, not a line.
                for k in 1..<layout.folds {
                    let y = (size.height * CGFloat(k) / CGFloat(layout.folds)).rounded()
                    ctx.fill(Path(CGRect(x: 1, y: y - 7, width: size.width - 2, height: 7)),
                             with: .linearGradient(Gradient(colors: [LetterPalette.lid.opacity(0), LetterPalette.lid.opacity(0.055)]),
                                                   startPoint: CGPoint(x: 0, y: y - 7), endPoint: CGPoint(x: 0, y: y)))
                    ctx.fill(Path(CGRect(x: 1, y: y, width: size.width - 2, height: 5)),
                             with: .linearGradient(Gradient(colors: [Color.white.opacity(0.5), Color.white.opacity(0)]),
                                                   startPoint: CGPoint(x: 0, y: y), endPoint: CGPoint(x: 0, y: y + 5)))
                }
            }

            let probe = CGSize(width: 2000, height: 400)
            for line in layout.lines where line.baseline > top - 20 && line.baseline < top + sliceHeight + 40 {
                let text = LetterPaperFace.text(for: line)
                let resolved = ctx.resolve(text)
                let baseline = resolved.firstBaseline(in: probe)
                let measured = resolved.measure(in: probe)
                let x: CGFloat
                switch line.align {
                case .leading: x = M.insetX
                case .trailing: x = size.width - M.insetX - measured.width
                case .center: x = (size.width - measured.width) / 2
                }
                ctx.draw(resolved, at: CGPoint(x: x, y: line.baseline - baseline), anchor: .topLeading)
                if line.style == .title {
                    // A little hand-drawn wave under the title.
                    let width = min(measured.width, size.width - 2 * M.insetX)
                    var wave = Path()
                    let y = line.baseline + 7
                    wave.move(to: CGPoint(x: x + 1, y: y))
                    var px = x + 1
                    var up = true
                    while px < x + width - 6 {
                        wave.addQuadCurve(to: CGPoint(x: px + 8, y: y), control: CGPoint(x: px + 4, y: y + (up ? -2.6 : 2.6)))
                        px += 8
                        up.toggle()
                    }
                    ctx.stroke(wave, with: .color(LetterPalette.heart.opacity(0.55)), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
                }
            }

            ctx.stroke(sheet, with: .color(LetterPalette.paperEdge), lineWidth: 1)
        }
        .frame(width: layout.width, height: sliceHeight)
        .clipped()
    }

    static func text(for line: LetterPaperLayout.Line) -> Text {
        typealias M = LetterPaperMetrics
        switch line.style {
        case .title:
            return Text(line.text).font(LetterFonts.font(.handBold, size: M.titleSize)).foregroundColor(LetterPalette.plum)
        case .body:
            return Text(line.text).font(LetterFonts.font(.hand, size: M.bodySize)).foregroundColor(LetterPalette.ink)
        case .note:
            return Text(line.text).font(LetterFonts.font(.hand, size: M.noteSize)).foregroundColor(LetterPalette.softInk)
        case .byline:
            let heart = Text("❤️").font(.system(size: 17))
            if line.text.isEmpty { return heart }
            return Text(line.text).font(LetterFonts.font(.script, size: M.bylineSize)).foregroundColor(LetterPalette.plum)
                + Text("  ") + heart
        }
    }
}

/// The back of the paper (what shows on a fold while it's folded). The outermost fold carries a
/// little "for you ❤️", drawn upside down so it reads the right way once folded over.
struct LetterPaperBack: View, Equatable {
    let layout: LetterPaperLayout
    let panel: Int
    let outer: Bool
    var top: CGFloat = 0
    var height: CGFloat?

    var body: some View {
        let sliceHeight = height ?? layout.height
        let top = self.top
        return Canvas { canvas, _ in
            var ctx = canvas
            ctx.translateBy(x: 0, y: -top)
            let size = CGSize(width: layout.width, height: layout.height)
            let sheet = Path(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: LetterPaperMetrics.corner, style: .continuous)
            ctx.fill(sheet, with: .color(LetterPalette.paperBack))
            ctx.stroke(sheet, with: .color(LetterPalette.paperEdge), lineWidth: 1)
            guard outer else { return }
            let band = size.height / CGFloat(layout.folds)
            let center = band * (CGFloat(panel) + 0.5)
            var flipped = ctx
            flipped.translateBy(x: 0, y: center)
            flipped.scaleBy(x: 1, y: -1)
            let words = flipped.resolve(Text("for you").font(LetterFonts.font(.script, size: 30)).foregroundColor(LetterPalette.plum.opacity(0.85)))
            let heart = flipped.resolve(Text("❤️").font(.system(size: 18)))
            let wordsSize = words.measure(in: CGSize(width: 600, height: 200))
            let heartSize = heart.measure(in: CGSize(width: 600, height: 200))
            let total = wordsSize.width + 6 + heartSize.width
            let left = (size.width - total) / 2
            flipped.draw(words, at: CGPoint(x: left, y: 0), anchor: .leading)
            flipped.draw(heart, at: CGPoint(x: left + wordsSize.width + 6, y: 2), anchor: .leading)
        }
        .frame(width: layout.width, height: sliceHeight)
        .clipped()
    }
}

/// A strip of pink washi tape with white dots and torn ends.
struct LetterWashiTape: View, Equatable {
    var width: CGFloat = 96
    var height: CGFloat = 24

    var body: some View {
        Canvas { ctx, size in
            var strip = Path()
            let teeth = 5
            let tooth = size.height / CGFloat(teeth)
            strip.move(to: CGPoint(x: 3, y: 0))
            strip.addLine(to: CGPoint(x: size.width - 3, y: 0))
            for k in 0..<teeth {
                let y = CGFloat(k) * tooth
                strip.addLine(to: CGPoint(x: size.width - (k.isMultiple(of: 2) ? 0 : 3), y: y + tooth / 2))
                strip.addLine(to: CGPoint(x: size.width - 3, y: y + tooth))
            }
            strip.addLine(to: CGPoint(x: 3, y: size.height))
            for k in (0..<teeth).reversed() {
                let y = CGFloat(k) * tooth
                strip.addLine(to: CGPoint(x: k.isMultiple(of: 2) ? 0 : 3, y: y + tooth / 2))
                strip.addLine(to: CGPoint(x: 3, y: y))
            }
            strip.closeSubpath()
            ctx.fill(strip, with: .color(LetterPalette.ribbon.opacity(0.82)))
            var dots = Path()
            var x: CGFloat = 9
            var row = 0
            while x < size.width - 6 {
                for y in stride(from: row.isMultiple(of: 2) ? 6.0 : 12.0, to: Double(size.height) - 3, by: 12) {
                    dots.addEllipse(in: CGRect(x: x - 1.6, y: CGFloat(y) - 1.6, width: 3.2, height: 3.2))
                }
                x += 7
                row += 1
            }
            ctx.fill(dots, with: .color(Color.white.opacity(0.85)))
            // A faint sheen along the top.
            ctx.fill(Path(CGRect(x: 3, y: 1, width: size.width - 6, height: 3)), with: .color(Color.white.opacity(0.28)))
        }
        .frame(width: width, height: height)
    }
}

/// The note, folded or unfolding: each fold is its own slice of the paper, turned about its crease
/// in 3D. `angles[i]` is panel i's turn in degrees (0 = flat); the base panel never turns. Flat all
/// over, it is drawn as one sheet (no seams, one drawing).
struct LetterPaperSheet: View, Equatable {
    let layout: LetterPaperLayout
    let angles: [Double]
    var tapeAngle: Double = -4
    /// Overlap of a turning fold onto its neighbour, so no hairline shows between them.
    private static let overlap: CGFloat = 0.75

    var body: some View {
        let n = layout.folds
        let order = n == 3 ? [1, 2, 0] : [0, 1]
        ZStack(alignment: .topLeading) {
            if angles.allSatisfy({ $0 == 0 }) {
                ZStack(alignment: .top) {
                    LetterPaperFace(layout: layout).equatable()
                    tape
                }
            } else {
                ForEach(order, id: \.self) { index in
                    panel(index, count: n)
                }
            }
        }
        .frame(width: layout.width, height: layout.height, alignment: .topLeading)
    }

    private var tape: some View {
        LetterWashiTape().equatable()
            .rotationEffect(.degrees(tapeAngle))
            .offset(y: -11)
    }

    private func isBase(_ index: Int, _ n: Int) -> Bool { n == 3 ? index == 1 : index == 0 }

    @ViewBuilder
    private func panel(_ index: Int, count n: Int) -> some View {
        let angle = index < angles.count ? angles[index] : 0
        let front = abs(angle) <= 90
        let outer = n == 3 ? index == 0 : index == 1
        let base = isBase(index, n)
        let band = layout.height / CGFloat(n)
        let up: CGFloat = !base && index > 0 ? Self.overlap : 0
        let down: CGFloat = !base && index == 0 ? Self.overlap : 0
        let top = band * CGFloat(index) - up
        let height = band + up + down
        // The crease it turns about: its bottom edge for the top fold, its top edge for the others.
        let hinge: CGFloat = index == 0 ? band / height : up / height
        // SwiftUI's perspective is relative to the view's size; keep it what it would be for the whole sheet.
        let perspective = 0.32 * max(layout.width, height) / max(layout.width, layout.height)
        ZStack(alignment: .top) {
            if front {
                LetterPaperFace(layout: layout, top: top, height: height).equatable()
            } else {
                LetterPaperBack(layout: layout, panel: index, outer: outer, top: top, height: height).equatable()
            }
            if index == 0 { tape }
        }
        .frame(width: layout.width, height: height, alignment: .top)
        .rotation3DEffect(.degrees(base ? 0 : angle), axis: (x: 1, y: 0, z: 0),
                          anchor: UnitPoint(x: 0.5, y: hinge), perspective: perspective)
        .offset(y: top)
    }
}
