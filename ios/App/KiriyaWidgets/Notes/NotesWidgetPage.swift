import SwiftUI

// The words on the page: laid out up front with CoreText on a ruled grid that fits the widget,
// biggest handwriting first ("love you ♡" fills a small widget; a long note steps down a size or
// two and ends with "..." where the widget runs out), then drawn one SwiftUI Text per line, each
// baseline sitting exactly on its rule.

struct NotesWidgetPageContent: Equatable {
    var title: String?
    /// A heading in Josh's script instead of a title ("for Kiriya", "to Kiriya").
    var scriptHeading: String?
    var body: String
    /// "— Josh", with a heart after it.
    var signature: String?
    /// Small words at the left of the signature line ("this morning").
    var when: String?
    /// The words go on in the app (the push carried only the start, or the page ran out).
    var continues: Bool = false
    /// Leave the signature line's right side free (Josh's stamp sits there).
    var stampRoom: CGFloat = 0
    /// A heart sticker on an otherwise empty page (large only).
    var sticker: Bool = false
}

struct NotesWidgetPageLayout: Equatable {
    enum Role: Equatable { case title, script, body, signature, when, more }
    struct Row: Equatable {
        var text: String
        var role: Role
        var face: NotesWidgetFonts.Face
        var size: CGFloat
        var x: CGFloat
        var baseline: CGFloat
        var trailing: Bool = false
        var width: CGFloat
    }

    var rows: [Row] = []
    var rules: [CGFloat] = []
    var pitch: CGFloat = 20
    var bodySize: CGFloat = 17
    var wave: CGRect?
    var heart: CGRect?
    var truncated = false
    /// The last line of words is only a heart or an emoji.
    var lonely = false
    /// The words fill less than half the page (a short note on a big widget).
    var roomy = false
    var marginX: CGFloat?

    struct Metrics {
        var sizes: ClosedRange<CGFloat>
        /// Line pitch as a multiple of the body size.
        var leading: CGFloat
        var top: CGFloat
        var bottom: CGFloat
        var left: CGFloat
        var right: CGFloat
        var margin: CGFloat?
        var joinParagraphs: Bool
        var titleScale: CGFloat = 1.12
        var signScale: CGFloat = 1.08

        static func forSize(_ size: NotesWidgetLook.Size, page: CGSize) -> Metrics {
            switch size {
            case .small:
                return Metrics(sizes: 16...23, leading: 1.2, top: 16, bottom: 9, left: 12, right: 10, margin: nil, joinParagraphs: true)
            case .medium:
                return Metrics(sizes: 16...22, leading: 1.2, top: 16, bottom: 9, left: 30, right: 14, margin: 21, joinParagraphs: true)
            case .large, .rectangular:
                return Metrics(sizes: 18...28, leading: 1.26, top: 20, bottom: 12, left: 34, right: 16, margin: 24, joinParagraphs: false,
                               titleScale: 1.1, signScale: 1.12)
            }
        }
    }

    static func make(_ content: NotesWidgetPageContent, page: CGSize, size: NotesWidgetLook.Size) -> NotesWidgetPageLayout {
        let m = Metrics.forSize(size, page: page)
        let width = page.width - m.left - m.right - 3
        // The biggest handwriting that holds every word, preferring one that leaves no heart or
        // emoji alone on the last line.
        var fits: NotesWidgetPageLayout?
        var last: NotesWidgetPageLayout?
        for raw in stride(from: m.sizes.upperBound, through: m.sizes.lowerBound, by: -1) {
            let attempt = layout(content, page: page, m: m, bodySize: raw, width: width)
            last = attempt
            guard !attempt.truncated else { continue }
            if !attempt.lonely { return attempt }
            if fits == nil { fits = attempt }
        }
        return fits ?? last ?? NotesWidgetPageLayout()
    }

    private static func layout(_ content: NotesWidgetPageContent, page: CGSize, m: Metrics, bodySize: CGFloat, width: CGFloat) -> NotesWidgetPageLayout {
        var out = NotesWidgetPageLayout()
        out.bodySize = bodySize
        out.marginX = m.margin
        let pitch = (bodySize * m.leading).rounded()
        out.pitch = pitch
        let first = m.top + NotesWidgetWrap.ascent(.hand, bodySize)
        let rowCount = max(2, Int(((page.height - m.bottom - first) / pitch).rounded(.down)) + 1)
        out.rules = (0..<rowCount).map { (first + CGFloat($0) * pitch).rounded() }
        func baseline(_ row: Int) -> CGFloat { out.rules[min(row, out.rules.count - 1)] }

        var row = 0
        // Heading: the note's title (bold, with a wavy pink underline) or a script greeting.
        let titleSize = (bodySize * m.titleScale).rounded()
        if let title = content.title {
            // A title a little too long for the line steps down (to just under the words' size);
            // still too long, it takes two lines (cut short after that).
            var size = titleSize
            while size > (bodySize * 0.92).rounded(), NotesWidgetWrap.width(title, .handBold, size) > width { size -= 1 }
            var lines = [title]
            if NotesWidgetWrap.width(title, .handBold, size) > width {
                size = titleSize
                lines = NotesWidgetWrap.balanced(title, .handBold, size, width: width)
                if let last = lines.last, NotesWidgetWrap.width(last, .handBold, size) > width {
                    lines[lines.count - 1] = NotesWidgetWrap.ellipsize(last, .handBold, size, width: width)
                }
            }
            for line in lines {
                out.rows.append(Row(text: line, role: .title, face: .handBold, size: size, x: m.left, baseline: baseline(row), width: width))
                row += 1
            }
            let w = min(width, NotesWidgetWrap.width(lines.last ?? title, .handBold, size))
            out.wave = CGRect(x: m.left, y: baseline(row - 1) + 3.2, width: w, height: 5)
        } else if let heading = content.scriptHeading {
            let size = (bodySize * 1.2).rounded()
            out.rows.append(Row(text: heading, role: .script, face: .script, size: size, x: m.left, baseline: baseline(row), width: width))
            row += 1
        }

        // The signature line is always the last line used.
        let signs = content.signature != nil || content.when != nil
        // Josh's stamp needs the bottom two lines.
        let available = rowCount - row - (signs ? 1 : 0) - (content.stampRoom > 0 ? 1 : 0)
        var lines = NotesWidgetWrap.lines(content.body, .hand, bodySize, width: width, joinParagraphs: m.joinParagraphs)
        if lines.isEmpty { lines = [""] }
        var truncated = false
        if lines.count > available {
            truncated = true
            lines = Array(lines.prefix(max(1, available)))
            lines[lines.count - 1] = NotesWidgetWrap.ellipsize(lines[lines.count - 1] + " …", .hand, bodySize, width: width)
        } else if content.continues, let last = lines.last {
            lines[lines.count - 1] = NotesWidgetWrap.ellipsize(last + " …", .hand, bodySize, width: width)
        }
        out.truncated = truncated
        if lines.count > 1, let tail = lines.last, tail.count <= 3, !tail.contains(where: { $0.isLetter || $0.isNumber }) {
            out.lonely = true
        }
        for line in lines {
            out.rows.append(Row(text: line, role: .body, face: .hand, size: bodySize, x: m.left, baseline: baseline(row), width: width))
            row += 1
        }

        if signs {
            // Straight after the words; Josh's stamp keeps the bottom two lines' right side.
            let signRow = min(row, rowCount - 1)
            let y = baseline(signRow)
            let signSize = (bodySize * m.signScale).rounded()
            let besideStamp = content.stampRoom > 0 && signRow >= rowCount - 2
            var right = page.width - m.right - (besideStamp ? content.stampRoom : 0)
            if let signature = content.signature {
                let heart = (signSize * 0.62).rounded()
                let heartX = right - heart
                out.heart = CGRect(x: heartX, y: y - heart * 0.98, width: heart, height: heart * 0.92)
                right = heartX - signSize * 0.22
                let w = NotesWidgetWrap.width(signature, .script, signSize)
                out.rows.append(Row(text: signature, role: .signature, face: .script, size: signSize, x: right - w, baseline: y + 1, trailing: true, width: w + 2))
                right -= w
            }
            if let when = content.when {
                let size = (bodySize * 0.74).rounded()
                let room = right - m.left - 8
                if NotesWidgetWrap.width(when, .hand, size) <= room {
                    out.rows.append(Row(text: when, role: .when, face: .hand, size: size, x: m.left, baseline: y, width: room))
                } else if signRow + 1 < rowCount, content.stampRoom == 0 {
                    // No room beside the signature: on the line under it (smaller if it must be).
                    var small = min(size, (bodySize * 0.64).rounded())
                    while small > 11, NotesWidgetWrap.width(when, .hand, small) > width { small -= 1 }
                    out.rows.append(Row(text: when, role: .when, face: .hand, size: small, x: m.left, baseline: baseline(signRow + 1), width: width))
                }
            }
            out.roomy = signRow < rowCount / 2
        }
        return out
    }
}

/// The page's words, drawn at the layout's baselines.
struct NotesWidgetPageWords: View {
    var layout: NotesWidgetPageLayout
    var palette: NotesWidgetPalette

    var body: some View {
        ZStack(alignment: .topLeading) {
            if let wave = layout.wave {
                NotesWidgetWave(amplitude: 1.3, period: 8)
                    .stroke(palette.wave, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                    .frame(width: wave.width, height: wave.height)
                    .offset(x: wave.minX, y: wave.minY)
                    .widgetAccentable()
            }
            ForEach(Array(layout.rows.enumerated()), id: \.offset) { _, row in
                // A 1-point frame whose top is the line's baseline (the words hang above it): every
                // row's frame starts at the same place, so nothing shifts the others, and an emoji
                // that makes its line taller still sits on the rule.
                Text(row.text)
                    .font(NotesWidgetFonts.font(row.face, size: row.size))
                    .foregroundStyle(color(row.role))
                    .lineLimit(1)
                    .fixedSize()
                    .alignmentGuide(.top) { $0[.firstTextBaseline] }
                    .frame(width: 1, height: 1, alignment: .topLeading)
                    .offset(x: row.x, y: row.baseline)
            }
            if let heart = layout.heart {
                NotesWidgetHeartMark(size: heart.width, palette: palette)
                    .offset(x: heart.minX, y: heart.minY)
            }
        }
    }

    private func color(_ role: NotesWidgetPageLayout.Role) -> Color {
        switch role {
        case .title, .script: return palette.title
        case .body: return palette.ink
        case .signature: return palette.title
        case .when, .more: return palette.soft
        }
    }
}
