import CoreText
import SwiftUI

// The envelope, drawn piece by piece so each piece can move on its own: the lined back (seen once
// the flap is up), the front pocket with the letter's address written on it, the pointed flap with
// its gilt edge (outside) and plum liner (inside), and the shadow the flap casts. Every piece is an
// Equatable Canvas, so the animation only ever moves them; their drawing is made once.

/// Sizes of the envelope and its trimmings for a given envelope width.
struct FormalLetterEnvelopeMetrics: Equatable {
    let width: CGFloat
    var tone: FormalLetterPalette.Tone = .blush

    var k: CGFloat { width / 300 }
    var height: CGFloat { (width * 0.68).rounded() }
    /// How far the flap's point reaches down.
    var flapDepth: CGFloat { (height * 0.48).rounded() }
    /// The pocket's V-shaped mouth (hidden under the flap until it opens).
    var mouthDip: CGFloat { (height * 0.33).rounded() }
    var corner: CGFloat { 3 * k }
    var sealDiameter: CGFloat { (60 * k).rounded() }
    /// The flap's tip sits this far below the seal's centre (in seal radii), so most of the K rides
    /// away on the flap when the seal breaks.
    var sealTip: CGFloat { 0.3 }
    var sealCenter: CGPoint { CGPoint(x: width / 2, y: flapDepth - sealDiameter / 2 * sealTip) }
    var slope: CGFloat { flapDepth / (width / 2) }
    var lavenderLength: CGFloat { (84 * k).rounded() }
    /// The flap's frame also holds the seal's upper piece, which hangs below its tip.
    var flapFrameHeight: CGFloat { (flapDepth + sealDiameter * 0.75).rounded(.up) }
    /// The pocket's frame (with room for the address's descenders at the bottom).
    var pocketFrameHeight: CGFloat { height + 2 }

    /// The paper of the envelope.
    var body: Path { Path(roundedRect: CGRect(x: 0, y: 0, width: width, height: height), cornerRadius: corner, style: .continuous) }

    static func flapPath(_ m: FormalLetterEnvelopeMetrics, inset: CGFloat = 0) -> Path {
        let w = m.width, d = m.flapDepth, r = m.corner
        let tipRound = 9 * m.k
        let s = m.slope
        let run = tipRound / (1 + s * s).squareRoot()
        var p = Path()
        if inset == 0 {
            p.move(to: CGPoint(x: 0, y: r))
            p.addQuadCurve(to: CGPoint(x: r, y: 0), control: .zero)
            p.addLine(to: CGPoint(x: w - r, y: 0))
            p.addQuadCurve(to: CGPoint(x: w, y: r), control: CGPoint(x: w, y: 0))
            p.addLine(to: CGPoint(x: w / 2 + run, y: d - run * s))
            p.addQuadCurve(to: CGPoint(x: w / 2 - run, y: d - run * s), control: CGPoint(x: w / 2, y: d + 1.2 * m.k))
            p.closeSubpath()
            return p
        }
        // An inner triangle `inset` in from the two slanted edges (and the top).
        let hyp = (1 + s * s).squareRoot()
        let dy = inset * hyp
        let top = inset
        let tipY = d - dy
        let halfAtTop = (tipY - top) / s
        p.move(to: CGPoint(x: w / 2 - halfAtTop, y: top))
        p.addLine(to: CGPoint(x: w / 2 + halfAtTop, y: top))
        p.addLine(to: CGPoint(x: w / 2 + run * 0.6, y: tipY - run * 0.6 * s))
        p.addQuadCurve(to: CGPoint(x: w / 2 - run * 0.6, y: tipY - run * 0.6 * s), control: CGPoint(x: w / 2, y: tipY + 0.6 * m.k))
        p.closeSubpath()
        return p
    }

    /// The flap's two slanted edges only (for the gilt).
    static func flapEdges(_ m: FormalLetterEnvelopeMetrics, inset: CGFloat = 0) -> Path {
        let w = m.width, d = m.flapDepth, s = m.slope
        let hyp = (1 + s * s).squareRoot()
        // A line parallel to both slanted edges, `inset` inside them, from the top to the tip and back.
        let tipY = d - inset * hyp
        let run = 9 * m.k / hyp * (inset > 0 ? 0.6 : 1)
        let topY = inset > 0 ? inset * 1.3 : m.corner
        let half = (tipY - topY) / s
        var p = Path()
        p.move(to: CGPoint(x: w / 2 - half, y: topY))
        p.addLine(to: CGPoint(x: w / 2 - run, y: tipY - run * s))
        p.addQuadCurve(to: CGPoint(x: w / 2 + run, y: tipY - run * s), control: CGPoint(x: w / 2, y: tipY + (inset > 0 ? 0.6 : 1.2) * m.k))
        p.addLine(to: CGPoint(x: w / 2 + half, y: topY))
        return p
    }

    static func pocketPath(_ m: FormalLetterEnvelopeMetrics) -> Path {
        let w = m.width, h = m.height, r = m.corner
        var p = Path()
        p.move(to: CGPoint(x: 0, y: r * 0.6))
        p.addLine(to: CGPoint(x: w / 2 - 10 * m.k, y: m.mouthDip - 10 * m.k * (m.mouthDip / (w / 2))))
        p.addQuadCurve(to: CGPoint(x: w / 2 + 10 * m.k, y: m.mouthDip - 10 * m.k * (m.mouthDip / (w / 2))),
                       control: CGPoint(x: w / 2, y: m.mouthDip + 1.5 * m.k))
        p.addLine(to: CGPoint(x: w, y: r * 0.6))
        p.addLine(to: CGPoint(x: w, y: h - r))
        p.addQuadCurve(to: CGPoint(x: w - r, y: h), control: CGPoint(x: w, y: h))
        p.addLine(to: CGPoint(x: r, y: h))
        p.addQuadCurve(to: CGPoint(x: 0, y: h - r), control: CGPoint(x: 0, y: h))
        p.closeSubpath()
        return p
    }
}

/// The inside of the envelope's back: the plum liner, darkening down into the pocket.
struct FormalLetterEnvelopeBack: View, Equatable {
    let m: FormalLetterEnvelopeMetrics

    var body: some View {
        Canvas { ctx, _ in
            let shape = m.body
            ctx.fill(shape, with: .linearGradient(Gradient(colors: [m.tone.top, m.tone.bottom]), startPoint: .zero, endPoint: CGPoint(x: 0, y: m.height)))
            let inset = 5 * m.k
            let linerRect = CGRect(x: inset, y: inset, width: m.width - 2 * inset, height: m.height * 0.82)
            FormalLetterLiner.fill(ctx, Path(linerRect), in: linerRect, k: m.k)
            // Depth: the inside darkens towards the bottom of the pocket.
            ctx.fill(shape, with: .linearGradient(Gradient(colors: [FormalLetterPalette.linerDeep.opacity(0), FormalLetterPalette.linerDeep.opacity(0.45)]),
                                                  startPoint: CGPoint(x: 0, y: m.mouthDip * 0.4), endPoint: CGPoint(x: 0, y: m.mouthDip + 12 * m.k)))
            ctx.stroke(shape, with: .color(m.tone.edge), lineWidth: 0.8)
        }
        .frame(width: m.width, height: m.height)
    }
}

/// The front pocket (side and bottom flaps), with the letter's address written across it in
/// script and small capitals, the way a formal envelope is addressed.
struct FormalLetterEnvelopePocket: View, Equatable {
    let m: FormalLetterEnvelopeMetrics
    let primary: String
    let secondary: String?
    /// A locked letter's gold date seal ("14" / "FEB"), stuck on the pocket's corner.
    var dateSeal: (day: String, month: String)?

    nonisolated static func == (a: Self, b: Self) -> Bool {
        a.m == b.m && a.primary == b.primary && a.secondary == b.secondary
            && a.dateSeal?.day == b.dateSeal?.day && a.dateSeal?.month == b.dateSeal?.month
    }

    var body: some View {
        Canvas { ctx, _ in
            let w = m.width, h = m.height
            let pocket = FormalLetterEnvelopeMetrics.pocketPath(m)
            ctx.fill(pocket, with: .linearGradient(Gradient(colors: [m.tone.top, m.tone.bottom]), startPoint: CGPoint(x: 0, y: 0), endPoint: CGPoint(x: 0, y: h)))
            // A whisper of light across the heavy paper, from the top left.
            ctx.fill(pocket, with: .linearGradient(Gradient(colors: [Color.white.opacity(0.22 * m.tone.sheen), Color.white.opacity(0)]),
                                                   startPoint: CGPoint(x: 0, y: 0), endPoint: CGPoint(x: w * 0.55, y: h)))

            // The bottom flap's edges: a soft shadow cast on the side flaps, then a lit edge.
            let apex = CGPoint(x: w / 2, y: h * 0.5)
            for side in [-1.0, 1.0] {
                let corner = CGPoint(x: side < 0 ? 1.5 * m.k : w - 1.5 * m.k, y: h - 1.5 * m.k)
                var edge = Path()
                edge.move(to: corner)
                // Bowed out towards the corners, leaving the middle clear for the address.
                edge.addQuadCurve(to: apex, control: CGPoint(x: w / 2 + CGFloat(side) * w * 0.36, y: h * 0.6))
                var shade = ctx
                shade.translateBy(x: 0, y: -1.6 * m.k)
                shade.addFilter(.blur(radius: 2.2 * m.k))
                shade.stroke(edge, with: .color(m.tone.seam.opacity(0.5)), lineWidth: 2.2 * m.k)
                ctx.stroke(edge, with: .color(m.tone.seam.opacity(0.55)), lineWidth: 0.7)
                var lit = ctx
                lit.translateBy(x: 0, y: 0.8)
                lit.stroke(edge, with: .color(m.tone.seamLight.opacity(0.8)), lineWidth: 0.6)
            }
            // The mouth's edge catches the light (seen once the flap is up).
            var mouth = Path()
            mouth.move(to: CGPoint(x: 0, y: m.corner * 0.6))
            mouth.addLine(to: CGPoint(x: w / 2, y: m.mouthDip))
            mouth.addLine(to: CGPoint(x: w, y: m.corner * 0.6))
            ctx.stroke(mouth, with: .color(m.tone.seamLight.opacity(0.9)), lineWidth: 0.9)

            address(ctx)
            if let dateSeal {
                FormalLetterDateSeal.draw(ctx, center: CGPoint(x: w * 0.875, y: h * 0.79), radius: 21 * m.k, day: dateSeal.day, month: dateSeal.month)
            }
            ctx.stroke(pocket, with: .color(m.tone.edge), lineWidth: 0.8)
        }
        .frame(width: m.width, height: m.pocketFrameHeight, alignment: .top)
    }

    private func address(_ ctx: GraphicsContext) {
        let w = m.width, h = m.height
        let maxWidth = w * (dateSeal == nil ? 0.8 : 0.64)
        let scriptSize = 31 * m.k
        func scriptWidth(_ s: String, _ size: CGFloat) -> CGFloat {
            let font = FormalLetterFonts.ct(.script, size: size)
            let attr = NSAttributedString(string: s, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
            return CGFloat(CTLineGetTypographicBounds(CTLineCreateWithAttributedString(attr), nil, nil, nil))
        }
        // One line, shrinking a little if it must; two lines if it's long.
        var lines = [primary]
        var size = scriptSize
        let natural = scriptWidth(primary, scriptSize)
        if natural > maxWidth {
            if natural * 0.84 <= maxWidth {
                size = scriptSize * maxWidth / natural
            } else {
                size = scriptSize * 0.82
                let font = FormalLetterFonts.ct(.script, size: size)
                let attr = NSAttributedString(string: primary, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
                let typesetter = CTTypesetterCreateWithAttributedString(attr)
                let ns = primary as NSString
                // Balanced: break near the middle rather than filling the first line.
                let balanced = min(maxWidth, max(maxWidth * 0.62, scriptWidth(primary, size) / 2 + 14))
                let first = CTTypesetterSuggestLineBreak(typesetter, 0, Double(balanced))
                var rest = ns.substring(from: first).trimmingCharacters(in: .whitespaces)
                var head = ns.substring(to: first).trimmingCharacters(in: .whitespaces)
                if scriptWidth(head, size) > maxWidth { head = FormalLetterType.ellipsizeScript(head, size: size, width: maxWidth) }
                if scriptWidth(rest, size) > maxWidth {
                    rest = FormalLetterType.ellipsizeScript(rest, size: size, width: maxWidth)
                }
                lines = [head, rest]
            }
        }
        let ink = m.tone.ink
        let hasSecondary = secondary != nil
        let baselines: [CGFloat]
        if lines.count == 1 {
            baselines = [h * (hasSecondary ? 0.775 : 0.81)]
        } else {
            baselines = [h * (hasSecondary ? 0.70 : 0.73), h * (hasSecondary ? 0.70 : 0.73) + size * 0.95]
        }
        for (index, line) in lines.enumerated() {
            let text = ctx.resolve(Text(line).font(FormalLetterFonts.font(.script, size: size)).foregroundColor(ink))
            let probe = CGSize(width: 2000, height: 400)
            let measured = text.measure(in: probe)
            let base = text.firstBaseline(in: probe)
            ctx.draw(text, at: CGPoint(x: ((w - measured.width) / 2).rounded(), y: baselines[index] - base), anchor: .topLeading)
        }
        if let secondary {
            let caps = ctx.resolve(Text(secondary)
                .font(FormalLetterFonts.font(.text, size: 13 * m.k, smallCaps: true))
                .tracking(1.6 * m.k)
                .foregroundColor(m.tone.inkSoft))
            let probe = CGSize(width: 2000, height: 400)
            var measured = caps.measure(in: probe)
            let base = caps.firstBaseline(in: probe)
            measured.width = min(measured.width, w * 0.86)
            let y = (baselines.last ?? h * 0.78) + 22 * m.k
            ctx.draw(caps, at: CGPoint(x: ((w - measured.width) / 2).rounded(), y: y - base), anchor: .topLeading)
            // A hairline either side, like an engraved address line.
            let gap: CGFloat = 8 * m.k
            let length: CGFloat = 16 * m.k
            let midY = y - 4 * m.k
            var rules = Path()
            rules.move(to: CGPoint(x: (w - measured.width) / 2 - gap - length, y: midY))
            rules.addLine(to: CGPoint(x: (w - measured.width) / 2 - gap, y: midY))
            rules.move(to: CGPoint(x: (w + measured.width) / 2 + gap, y: midY))
            rules.addLine(to: CGPoint(x: (w + measured.width) / 2 + gap + length, y: midY))
            ctx.stroke(rules, with: .color(FormalLetterPalette.gold.opacity(0.85)), lineWidth: 0.7)
        }
    }
}

extension FormalLetterType {
    static func ellipsizeScript(_ string: String, size: CGFloat, width: CGFloat) -> String {
        let font = FormalLetterFonts.ct(.script, size: size)
        func measure(_ s: String) -> CGFloat {
            let attr = NSAttributedString(string: s, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
            return CGFloat(CTLineGetTypographicBounds(CTLineCreateWithAttributedString(attr), nil, nil, nil))
        }
        var words = string
        while !words.isEmpty, measure(words + "\u{2026}") > width {
            if let space = words.lastIndex(of: " ") { words = String(words[..<space]) } else { words.removeLast() }
        }
        while let last = words.last, " ,;:\u{2014}\u{2013}-".contains(last) { words.removeLast() }
        return words + "\u{2026}"
    }
}

/// The flap: a deep pointed flap hinged on the envelope's top edge. Outside it's the envelope's
/// paper with a double gilt edge; inside, the plum liner with a margin of paper round it.
struct FormalLetterFlapFace: View, Equatable {
    let m: FormalLetterEnvelopeMetrics
    let inside: Bool

    var body: some View {
        Canvas { ctx, _ in
            let w = m.width, d = m.flapDepth
            let flap = FormalLetterEnvelopeMetrics.flapPath(m)
            if inside {
                ctx.fill(flap, with: .linearGradient(Gradient(colors: [m.tone.bottom, m.tone.top]), startPoint: .zero, endPoint: CGPoint(x: 0, y: d)))
                let liner = FormalLetterEnvelopeMetrics.flapPath(m, inset: 6 * m.k)
                FormalLetterLiner.fill(ctx, liner, in: CGRect(x: 0, y: 0, width: w, height: d), k: m.k)
                ctx.stroke(liner, with: .color(FormalLetterPalette.linerDeep.opacity(0.6)), lineWidth: 0.5)
            } else {
                ctx.fill(flap, with: .linearGradient(Gradient(colors: [m.tone.top, m.tone.bottom]), startPoint: .zero, endPoint: CGPoint(x: 0, y: d * 1.4)))
                ctx.fill(flap, with: .linearGradient(Gradient(colors: [Color.white.opacity(0.3 * m.tone.sheen), Color.white.opacity(0)]),
                                                     startPoint: .zero, endPoint: CGPoint(x: w * 0.45, y: d)))
                // An engraved gilt line just inside the edge.
                let inner = FormalLetterEnvelopeMetrics.flapEdges(m, inset: 7 * m.k)
                ctx.stroke(inner, with: .color(FormalLetterPalette.gold.opacity(0.75)), style: StrokeStyle(lineWidth: 0.6 * m.k, lineCap: .round, lineJoin: .round))
            }
            // The gilded edge itself (seen from both sides).
            let edges = FormalLetterEnvelopeMetrics.flapEdges(m)
            ctx.stroke(edges, with: .linearGradient(Gradient(colors: [FormalLetterPalette.goldLight, FormalLetterPalette.gold]),
                                                    startPoint: .zero, endPoint: CGPoint(x: w, y: d)),
                       style: StrokeStyle(lineWidth: 1.5 * m.k, lineCap: .round, lineJoin: .round))
            ctx.stroke(edges, with: .color(FormalLetterPalette.goldDeep.opacity(0.35)), style: StrokeStyle(lineWidth: 0.4, lineCap: .round, lineJoin: .round))
        }
        .frame(width: m.width, height: m.flapDepth + 2 * m.k, alignment: .top)
    }
}

/// The soft shadow the closed flap casts on the pocket (thick paper).
struct FormalLetterFlapShadow: View, Equatable {
    let m: FormalLetterEnvelopeMetrics

    var body: some View {
        Canvas { ctx, _ in
            var c = ctx
            c.addFilter(.blur(radius: 3 * m.k))
            c.translateBy(x: 0, y: 2.4 * m.k)
            c.fill(FormalLetterEnvelopeMetrics.flapPath(m), with: .color(FormalLetterPalette.plum.opacity(0.2)))
        }
        .frame(width: m.width, height: m.flapDepth + 12 * m.k, alignment: .top)
    }
}

/// The envelope's shadow on the card: a soft, wide drop shadow and a tighter one along its foot, so
/// it reads as heavy paper lying just above the page.
struct FormalLetterEnvelopeShadow: View, Equatable {
    let m: FormalLetterEnvelopeMetrics
    static let pad: CGFloat = 40

    var body: some View {
        Canvas { ctx, _ in
            let pad = Self.pad
            let body = CGRect(x: pad, y: pad, width: m.width, height: m.height)
            var soft = ctx
            soft.addFilter(.blur(radius: 11 * m.k))
            soft.fill(Path(roundedRect: body.insetBy(dx: 6 * m.k, dy: 4 * m.k).offsetBy(dx: 0, dy: 9 * m.k), cornerRadius: 8 * m.k),
                      with: .color(FormalLetterPalette.plum.opacity(0.2)))
            var contact = ctx
            contact.addFilter(.blur(radius: 2.5 * m.k))
            contact.fill(Path(roundedRect: CGRect(x: body.minX + 4 * m.k, y: body.maxY - 6 * m.k, width: body.width - 8 * m.k, height: 7 * m.k),
                              cornerRadius: 3 * m.k),
                         with: .color(FormalLetterPalette.plum.opacity(0.16)))
        }
        .frame(width: m.width + 2 * Self.pad, height: m.height + 2 * Self.pad)
        .allowsHitTesting(false)
    }
}

/// A round gold-foil seal with a serrated edge, the day large in the middle and the month under it:
/// stuck on a letter that isn't ready to be opened.
enum FormalLetterDateSeal {
    static func draw(_ ctx: GraphicsContext, center: CGPoint, radius r: CGFloat, day: String, month: String) {
        var c = ctx
        c.translateBy(x: center.x, y: center.y)
        c.rotate(by: .degrees(9))
        var edge = Path()
        let teeth = 28
        for i in 0...(teeth * 2) {
            let a = Double(i) / Double(teeth * 2) * 2 * Double.pi
            let rr = i.isMultiple(of: 2) ? r : r * 0.92
            let point = CGPoint(x: rr * CGFloat(cos(a)), y: rr * CGFloat(sin(a)))
            if i == 0 { edge.move(to: point) } else { edge.addLine(to: point) }
        }
        edge.closeSubpath()
        var shadow = c
        shadow.addFilter(.blur(radius: 1.6))
        shadow.translateBy(x: 0.4, y: 1.2)
        shadow.fill(edge, with: .color(FormalLetterPalette.plum.opacity(0.28)))
        c.fill(edge, with: .linearGradient(Gradient(colors: [FormalLetterPalette.goldLight, FormalLetterPalette.gold]),
                                           startPoint: CGPoint(x: -r, y: -r), endPoint: CGPoint(x: r * 0.7, y: r)))
        let inner = Path(ellipseIn: CGRect(x: -r * 0.78, y: -r * 0.78, width: r * 1.56, height: r * 1.56))
        c.fill(inner, with: .linearGradient(Gradient(colors: [FormalLetterPalette.gold, FormalLetterPalette.goldLight]),
                                            startPoint: CGPoint(x: -r, y: -r), endPoint: CGPoint(x: r, y: r)))
        c.stroke(inner, with: .color(FormalLetterPalette.goldDeep.opacity(0.7)), lineWidth: 0.6)
        c.stroke(Path(ellipseIn: CGRect(x: -r * 0.7, y: -r * 0.7, width: r * 1.4, height: r * 1.4)),
                 with: .color(Color.white.opacity(0.45)), lineWidth: 0.4)
        let ink = FormalLetterPalette.rgb(0x6f5220)
        func stamp(_ text: Text, at point: CGPoint) {
            var lit = c
            lit.translateBy(x: -0.35, y: -0.45)
            lit.draw(lit.resolve(text.foregroundColor(Color.white.opacity(0.55))), at: point, anchor: .center)
            c.draw(c.resolve(text.foregroundColor(ink)), at: point, anchor: .center)
        }
        stamp(Text(day).font(FormalLetterFonts.font(.titleItalic, size: r * 0.86)), at: CGPoint(x: 0, y: -r * 0.13))
        stamp(Text(month.lowercased()).font(FormalLetterFonts.font(.text, size: r * 0.42, smallCaps: true)).tracking(r * 0.05),
              at: CGPoint(x: 0, y: r * 0.42))
        c.fill(FormalLetterHeart().path(in: CGRect(x: -r * 0.09, y: -r * 0.66, width: r * 0.18, height: r * 0.16)),
               with: .color(FormalLetterPalette.rose.opacity(0.9)))
    }
}
