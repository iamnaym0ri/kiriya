import CoreText
import SwiftUI

// Where everything sits, as a pure function of the card's width and its words. Two arrangements:
//
//  • the jar, waiting: the push title in the app's little day tag, the big jar, a caption.
//  • a pulled note: the paper on top (the app's .note-jar__paper: tape, label, "hey, u.", the note,
//    the byline), and the jar, small, underneath it, where the note came out of.

/// The push title in the app's day tag (.note-jar__day): a dashed, slightly turned label with a red heart.
struct JarTagLayout {
    var text: JarTextBlock
    var rect: CGRect
    var heartCenter: CGPoint
    var heartHeight: CGFloat
    var textOrigin: CGPoint
    var textWidth: CGFloat
    var fresh: Bool
}

/// A caption: some lines, where they go, in which ink.
struct JarCaptionLayout {
    var string: String
    var text: JarTextBlock
    var origin: CGPoint
    var width: CGFloat
    var align: CGFloat
    var height: CGFloat { text.height }
}

/// The paper a pulled note opens into.
struct JarPaperLayout {
    var size: CGSize
    var inset: CGFloat
    var label: JarTextBlock?
    var labelTop: CGFloat = 0
    var salutation: JarTextBlock?
    var salutationTop: CGFloat = 0
    var message: JarTextBlock
    var messageTop: CGFloat = 0
    var byline: JarTextBlock?
    var bylineTop: CGFloat = 0
    var more: JarTextBlock?
    var moreTop: CGFloat = 0
    /// How many panels it was folded into (2 or 3): the creases, and how it unfolds.
    var panels: Int
    var panelHeight: CGFloat { (size.height / CGFloat(panels) * 3).rounded() / 3 }
    var messageFont: String

    static func make(note: JarPulledNote, width: CGFloat, maxHeight: CGFloat) -> JarPaperLayout {
        let inset: CGFloat = width < 320 ? 19 : 21
        let textWidth = width - inset * 2
        // From the site's 28px Gaegu down to the system's rounded face for the longest notes, until it fits.
        let tiers: [(font: CTFont, line: CGFloat, salutation: Bool, name: String)] = [
            (JarFonts.hand(27), 31, true, "Gaegu 27"),
            (JarFonts.hand(25), 29, true, "Gaegu 25"),
            (JarFonts.hand(23.5), 27.5, true, "Gaegu 23.5"),
            (JarFonts.rounded(18, .regular), 24.5, true, "Rounded 18"),
            (JarFonts.rounded(17, .regular), 23, false, "Rounded 17"),
            (JarFonts.rounded(16, .regular), 21.5, false, "Rounded 16"),
        ]
        var best: JarPaperLayout?
        for tier in tiers {
            let layout = make(note: note, width: width, inset: inset, textWidth: textWidth, font: tier.font, line: tier.line,
                              salutation: tier.salutation, name: tier.name, maxLines: .max)
            best = layout
            if layout.size.height <= maxHeight { return layout }
        }
        // Still too long: the last tier, cut to fit, with a line saying where the rest is.
        let last = tiers[tiers.count - 1]
        let overflow = best!.size.height - maxHeight
        let keep = max(4, best!.message.lines.count - Int((overflow / last.line).rounded(.up)) - 1)
        return make(note: note, width: width, inset: inset, textWidth: textWidth, font: last.font, line: last.line,
                    salutation: false, name: last.name + " cut", maxLines: keep)
    }

    private static func make(note: JarPulledNote, width: CGFloat, inset: CGFloat, textWidth: CGFloat, font: CTFont, line: CGFloat,
                             salutation: Bool, name: String, maxLines: Int) -> JarPaperLayout {
        var y: CGFloat = 26
        var label: JarTextBlock?
        var labelTop: CGFloat = 0
        if let text = note.label?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
            label = JarText.block(text, font: JarFonts.rounded(11.5, .medium), color: JarPalette.microLabel, width: textWidth,
                                  lineHeight: 16, kern: 1.5, maxLines: 2)
            labelTop = y
            y += label!.height + (salutation ? 7 : 8)
        }
        var hello: JarTextBlock?
        var helloTop: CGFloat = 0
        if salutation {
            hello = JarText.block("hey, u.", font: JarFonts.hand(25), color: JarPalette.salutation, width: textWidth, lineHeight: 28)
            helloTop = y
            y += hello!.height + 5
        }
        let body = note.text.trimmingCharacters(in: .whitespacesAndNewlines)
        let message = JarText.block(body.isEmpty ? "…" : body, font: font, color: JarPalette.ink, width: textWidth, lineHeight: line, maxLines: maxLines)
        let messageTop = y
        y += message.height
        var more: JarTextBlock?
        var moreTop: CGFloat = 0
        if message.truncated {
            y += 6
            more = JarText.block("the rest is waiting in the app", font: JarFonts.hand(19.5), color: JarPalette.byline, width: textWidth, lineHeight: 22, heart: true)
            moreTop = y
            y += more!.height
        }
        var byline: JarTextBlock?
        var bylineTop: CGFloat = 0
        let by = note.byline.trimmingCharacters(in: .whitespacesAndNewlines)
        if !by.isEmpty {
            y += 11
            byline = JarText.block(by, font: JarFonts.hand(22), color: JarPalette.byline, width: textWidth, lineHeight: 25, maxLines: 2)
            bylineTop = y
            y += byline!.height
        }
        y += 19
        // Like the app's paper (min-height, the message taking the slack), a short note still looks like a note card.
        let minHeight: CGFloat = 196
        if y < minHeight {
            if byline != nil { bylineTop += minHeight - y }
            y = minHeight
        }
        let height = y.rounded(.up)
        let panels = height >= 330 ? 3 : 2
        return JarPaperLayout(size: CGSize(width: width, height: height), inset: inset, label: label, labelTop: labelTop,
                              salutation: hello, salutationTop: helloTop, message: message, messageTop: messageTop,
                              byline: byline, bylineTop: bylineTop, more: more, moreTop: moreTop, panels: panels, messageFont: name)
    }
}

/// The card's geometry for one width.
struct JarLayout {
    let width: CGFloat
    let margin: CGFloat

    // The waiting arrangement.
    let tag: JarTagLayout?
    let bigPlacement: JarArtist.Placement
    let bigJarRect: CGRect
    let bigCaptionTop: CGFloat
    let bigCaptionWidth: CGFloat

    // The pulled arrangement.
    let paperWidth: CGFloat
    let paperTop: CGFloat
    let smallScale: CGFloat

    static let artTop: CGFloat = 56       // the charms' tops (art units)
    static let artBottom: CGFloat = 372   // the floor shadow's bottom
    static let smallArtTop: CGFloat = 62  // the lid's top, with a little air for the bigger heart, when the jar is small

    init(width: CGFloat, heading: String, fresh: Bool) {
        let width = max(260, width.isFinite ? width : 375)
        self.width = width
        margin = jarClamp((width * 0.045).rounded(), 14, 20)
        var y: CGFloat = 13
        let title = JarText.headingWithoutHearts(heading)
        if !title.isEmpty {
            let maxText = width - margin * 2 - 60
            let ink = fresh ? JarPalette.freshInk : JarPalette.ink
            // One line if it fits (a size smaller if need be); otherwise two lines of about the same length.
            var block = JarText.block(title, font: JarFonts.hand(21), color: ink, width: maxText, lineHeight: 23, maxLines: 3)
            if block.lines.count > 1 {
                let smaller = JarText.block(title, font: JarFonts.hand(19.5), color: ink, width: maxText, lineHeight: 22, maxLines: 3)
                if smaller.lines.count == 1 {
                    block = smaller
                } else {
                    var low = maxText / 2, high = maxText
                    for _ in 0..<10 {
                        let mid = (low + high) / 2
                        if JarText.block(title, font: JarFonts.hand(20.5), color: ink, width: mid, lineHeight: 22.5, maxLines: 3).lines.count <= 2 { high = mid } else { low = mid }
                    }
                    block = JarText.block(title, font: JarFonts.hand(20.5), color: ink, width: high.rounded(.up) + 1, lineHeight: 22.5, maxLines: 2)
                }
            }
            let heart: CGFloat = 15, gap: CGFloat = 7, padX: CGFloat = 13, padY: CGFloat = 7
            let textWidth = block.maxWidth
            let tagWidth = (padX * 2 + heart + gap + textWidth).rounded(.up)
            let tagHeight = (padY * 2 + block.height).rounded(.up)
            let rect = CGRect(x: ((width - tagWidth) / 2).rounded(), y: y, width: tagWidth, height: tagHeight)
            tag = JarTagLayout(text: block, rect: rect,
                               heartCenter: CGPoint(x: rect.minX + padX + heart / 2, y: rect.minY + padY + block.lineHeight / 2 + 0.5),
                               heartHeight: heart, textOrigin: CGPoint(x: rect.minX + padX + heart + gap, y: rect.minY + padY),
                               textWidth: textWidth, fresh: fresh)
            y = rect.maxY + 8
        } else {
            tag = nil
        }
        let bigScale: CGFloat = width >= 375 ? 0.72 : 0.68
        let jarTop = y
        bigPlacement = JarArtist.Placement(base: CGPoint(x: (width / 2).rounded(), y: jarTop + (350 - Self.artTop) * bigScale), scale: bigScale)
        bigJarRect = CGRect(x: width / 2 - 125 * bigScale, y: jarTop + (90 - Self.artTop) * bigScale, width: 250 * bigScale, height: 275 * bigScale)
        bigCaptionTop = jarTop + (Self.artBottom - Self.artTop) * bigScale + 4
        bigCaptionWidth = width - margin * 2 - 16

        paperWidth = width - margin * 2 - 4
        paperTop = 21
        smallScale = width >= 375 ? 0.3 : 0.285
    }

    // MARK: waiting

    func bigCaption(_ text: String, color: JarRGB, heart: Bool = false) -> JarCaptionLayout {
        let font = JarFonts.hand(19.5)
        var block = JarText.block(text, font: font, color: color, width: bigCaptionWidth, lineHeight: 22, maxLines: 3, heart: heart)
        if block.lines.count > 1 {
            // Balanced lines, no lonely last word.
            let lines = block.lines.count
            var low = bigCaptionWidth / CGFloat(lines), high = bigCaptionWidth
            for _ in 0..<9 {
                let mid = (low + high) / 2
                if JarText.block(text, font: font, color: color, width: mid, lineHeight: 22, maxLines: 3, heart: heart).lines.count <= lines { high = mid } else { low = mid }
            }
            block = JarText.block(text, font: font, color: color, width: high.rounded(.up) + 1, lineHeight: 22, maxLines: 3, heart: heart)
        }
        return JarCaptionLayout(string: text, text: block, origin: CGPoint(x: margin + 8, y: bigCaptionTop), width: bigCaptionWidth, align: 0.5)
    }

    func bigHeight(caption: JarCaptionLayout?) -> CGFloat {
        (bigCaptionTop + max(22, caption?.height ?? 0) + 13).rounded(.up)
    }

    // MARK: a pulled note

    /// The tallest the paper may be so the whole card stays within ~600pt.
    var maxPaperHeight: CGFloat { 600 - paperTop - restJarHeight - 10 }
    var restJarHeight: CGFloat { (Self.artBottom - Self.smallArtTop) * smallScale + 2 }

    func paper(for note: JarPulledNote) -> JarPaperLayout {
        JarPaperLayout.make(note: note, width: paperWidth, maxHeight: maxPaperHeight)
    }

    func paperRect(_ paper: JarPaperLayout) -> CGRect {
        CGRect(x: margin, y: paperTop, width: paper.size.width, height: paper.size.height)
    }

    /// Under the paper, the small jar and its caption sit together as one centred row.
    private var restRow: (jarX: CGFloat, captionX: CGFloat, captionWidth: CGFloat) {
        let jarHalf = (136 * smallScale).rounded()
        let gap: CGFloat = 4
        let captionWidth = min(176, width - margin * 2 - jarHalf * 2 - gap - 10)
        let left = ((width - (jarHalf * 2 + gap + captionWidth)) / 2).rounded()
        return (left + jarHalf, left + jarHalf * 2 + gap, captionWidth)
    }

    func restPlacement(_ paper: JarPaperLayout) -> JarArtist.Placement {
        let jarTop = paperTop + paper.size.height + 2
        return JarArtist.Placement(base: CGPoint(x: restRow.jarX, y: jarTop + (350 - Self.smallArtTop) * smallScale), scale: smallScale)
    }

    func restJarRect(_ paper: JarPaperLayout) -> CGRect {
        let placement = restPlacement(paper)
        let rect = CGRect(x: 66, y: 60, width: 228, height: 300).applying(placement.transform)
        return rect.insetBy(dx: min(0, (rect.width - 88) / 2), dy: min(0, (rect.height - 88) / 2))
    }

    func restHeight(_ paper: JarPaperLayout) -> CGFloat {
        (paperTop + paper.size.height + 2 + restJarHeight + 8).rounded(.up)
    }

    /// Beside the small jar: what it's doing (another new note inside, finding one, a hiccup) and,
    /// on Josh's phone, that this was only a preview.
    func restCaptions(_ status: String, color: JarRGB, heart: Bool, preview: Bool, paper: JarPaperLayout) -> [JarCaptionLayout] {
        let row = restRow
        let first = JarText.block(status, font: JarFonts.hand(18.5), color: color, width: row.captionWidth, lineHeight: 20, maxLines: 3, heart: heart)
        let second = preview ? JarText.block("a preview: her jar is untouched", font: JarFonts.rounded(12, .medium), color: JarPalette.muted,
                                             width: row.captionWidth, lineHeight: 15, maxLines: 2) : nil
        let total = first.height + (second.map { $0.height + 4 } ?? 0)
        let center = CGPoint(x: 0, y: 238).applying(restPlacement(paper).transform).y
        var y = (center - total / 2).rounded()
        var captions = [JarCaptionLayout(string: status, text: first, origin: CGPoint(x: row.captionX, y: y), width: row.captionWidth, align: 0)]
        if let second {
            y += first.height + 4
            captions.append(JarCaptionLayout(string: "a preview: her jar is untouched", text: second, origin: CGPoint(x: row.captionX, y: y), width: row.captionWidth, align: 0))
        }
        return captions
    }
}

func jarClamp<T: Comparable>(_ value: T, _ low: T, _ high: T) -> T { min(high, max(low, value)) }
