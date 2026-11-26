import SwiftUI

// The envelope, drawn piece by piece so each piece can move on its own: the lined back, the front
// pocket with lace along its hem, the lace-trimmed flap (outside and lined inside), the satin band,
// the bow's loops and tails, and the red wax seal. Every piece is an Equatable Canvas, so the
// animation only ever moves them; their drawing is made once.

/// Sizes of the envelope and its trimmings for a given envelope width.
struct LetterEnvelopeMetrics: Equatable {
    let width: CGFloat
    var k: CGFloat { width / 290 }
    var height: CGFloat { (width * 0.63).rounded() }
    var flapHeight: CGFloat { (height * 0.56).rounded() }
    var pocketDip: CGFloat { (height * 0.53).rounded() }
    var corner: CGFloat { 9 * k }
    var stroke: CGFloat { 2.6 * k }
    var laceDepth: CGFloat { 6.5 * k }
    var scallop: CGFloat { 10.5 * k }
    var bandWidth: CGFloat { 15 * k }
    var sealSize: CGFloat { 50 * k }
    var loopLength: CGFloat { 74 * k }
    var loopHeight: CGFloat { 54 * k }
    var tailLength: CGFloat { 92 * k }
    var tailWidth: CGFloat { 17 * k }
    var knot: CGPoint { CGPoint(x: width / 2, y: flapHeight) }
}

enum LetterLace {
    /// White scalloped lace along the segment a → b, hanging to the right of the direction of travel
    /// (with y pointing down), with an eyelet and an inner thread in each scallop.
    static func draw(_ ctx: GraphicsContext, from a: CGPoint, to b: CGPoint, depth: CGFloat, scallop: CGFloat) {
        var c = ctx
        let dx = b.x - a.x, dy = b.y - a.y
        let length = (dx * dx + dy * dy).squareRoot()
        guard length > 1 else { return }
        c.translateBy(x: a.x, y: a.y)
        c.rotate(by: .radians(atan2(dy, dx)))
        let count = max(1, Int((length / scallop).rounded()))
        let step = length / CGFloat(count)
        var scallops = Path()
        scallops.move(to: CGPoint(x: 0, y: -1.5))
        scallops.addLine(to: CGPoint(x: 0, y: 0))
        var inner = Path()
        var eyelets = Path()
        for i in 0..<count {
            let x = CGFloat(i) * step
            scallops.addCurve(to: CGPoint(x: x + step, y: 0),
                              control1: CGPoint(x: x + step * 0.02, y: depth * 1.34),
                              control2: CGPoint(x: x + step * 0.98, y: depth * 1.34))
            inner.move(to: CGPoint(x: x + step * 0.2, y: depth * 0.12))
            inner.addCurve(to: CGPoint(x: x + step * 0.8, y: depth * 0.12),
                           control1: CGPoint(x: x + step * 0.22, y: depth * 0.95),
                           control2: CGPoint(x: x + step * 0.78, y: depth * 0.95))
            let r = step * 0.11
            eyelets.addEllipse(in: CGRect(x: x + step / 2 - r, y: depth * 0.42 - r, width: 2 * r, height: 2 * r))
        }
        scallops.addLine(to: CGPoint(x: length, y: -1.5))
        scallops.closeSubpath()
        c.fill(scallops, with: .color(LetterPalette.lace))
        c.stroke(inner, with: .color(LetterPalette.laceLine.opacity(0.55)), lineWidth: 0.6)
        c.fill(eyelets, with: .color(LetterPalette.laceLine.opacity(0.9)))
        c.stroke(scallops, with: .color(LetterPalette.laceLine), lineWidth: 0.85)
    }
}

/// The lining's pattern: white dots and tiny pink hearts on lilac.
enum LetterLining {
    static func fill(_ ctx: GraphicsContext, _ shape: Path, in rect: CGRect, k: CGFloat) {
        var c = ctx
        c.fill(shape, with: .color(LetterPalette.lining))
        c.clip(to: shape)
        let gap = 13 * k
        var dots = Path()
        var hearts = Path()
        var row = 0
        var y = rect.minY + gap / 2
        while y < rect.maxY + gap {
            var x = rect.minX + (row.isMultiple(of: 2) ? gap / 2 : gap)
            var column = 0
            while x < rect.maxX + gap {
                if (row + column).isMultiple(of: 3) {
                    hearts.addPath(LetterHeart().path(in: CGRect(x: x - 3 * k, y: y - 2.7 * k, width: 6 * k, height: 5.4 * k)))
                } else {
                    dots.addEllipse(in: CGRect(x: x - 1.2 * k, y: y - 1.2 * k, width: 2.4 * k, height: 2.4 * k))
                }
                x += gap
                column += 1
            }
            y += gap * 0.87
            row += 1
        }
        c.fill(dots, with: .color(LetterPalette.liningDot))
        c.fill(hearts, with: .color(LetterPalette.liningHeart.opacity(0.75)))
    }
}

/// The inside back of the envelope (seen once the flap is open).
struct LetterEnvelopeBack: View, Equatable {
    let m: LetterEnvelopeMetrics

    var body: some View {
        Canvas { ctx, size in
            let rect = CGRect(x: 0, y: 0, width: m.width, height: m.height)
            let shape = Path(roundedRect: rect, cornerRadius: m.corner, style: .continuous)
            LetterLining.fill(ctx, shape, in: rect, k: m.k)
            // Depth: the inside darkens towards the bottom of the pocket.
            ctx.fill(shape, with: .linearGradient(Gradient(colors: [LetterPalette.lid.opacity(0.0), LetterPalette.lid.opacity(0.28)]),
                                                  startPoint: CGPoint(x: 0, y: 0), endPoint: CGPoint(x: 0, y: m.height * 0.6)))
            ctx.stroke(shape, with: .color(LetterPalette.plum), style: StrokeStyle(lineWidth: m.stroke, lineJoin: .round))
        }
        .frame(width: m.width, height: m.height)
    }
}

/// The front pocket: the side and bottom folds meeting in a V, with lace along the hem.
struct LetterEnvelopePocket: View, Equatable {
    let m: LetterEnvelopeMetrics

    static func outline(_ m: LetterEnvelopeMetrics) -> Path {
        let w = m.width, h = m.height, r = m.corner
        var p = Path()
        p.move(to: CGPoint(x: r * 0.29, y: r * 0.29))
        p.addLine(to: CGPoint(x: w / 2 - r * 0.9, y: m.pocketDip - r * 0.45))
        p.addQuadCurve(to: CGPoint(x: w / 2 + r * 0.9, y: m.pocketDip - r * 0.45), control: CGPoint(x: w / 2, y: m.pocketDip + r * 0.25))
        p.addLine(to: CGPoint(x: w - r * 0.29, y: r * 0.29))
        p.addQuadCurve(to: CGPoint(x: w, y: r), control: CGPoint(x: w, y: 0))
        p.addLine(to: CGPoint(x: w, y: h - r))
        p.addQuadCurve(to: CGPoint(x: w - r, y: h), control: CGPoint(x: w, y: h))
        p.addLine(to: CGPoint(x: r, y: h))
        p.addQuadCurve(to: CGPoint(x: 0, y: h - r), control: CGPoint(x: 0, y: h))
        p.addLine(to: CGPoint(x: 0, y: r))
        p.addQuadCurve(to: CGPoint(x: r * 0.29, y: r * 0.29), control: CGPoint(x: 0, y: 0))
        p.closeSubpath()
        return p
    }

    var body: some View {
        Canvas { ctx, size in
            let w = m.width, h = m.height
            LetterLace.draw(ctx, from: CGPoint(x: m.corner * 0.8, y: h - 1), to: CGPoint(x: w - m.corner * 0.8, y: h - 1),
                            depth: m.laceDepth, scallop: m.scallop)
            // Lace along the mouth, too (hidden under the flap until it opens).
            let r = m.corner
            LetterLace.draw(ctx, from: CGPoint(x: w / 2, y: m.pocketDip - r * 0.2), to: CGPoint(x: r * 0.6, y: r * 0.6),
                            depth: m.laceDepth * 0.85, scallop: m.scallop * 0.9)
            LetterLace.draw(ctx, from: CGPoint(x: w - r * 0.6, y: r * 0.6), to: CGPoint(x: w / 2, y: m.pocketDip - r * 0.2),
                            depth: m.laceDepth * 0.85, scallop: m.scallop * 0.9)
            let pocket = LetterEnvelopePocket.outline(m)
            ctx.fill(pocket, with: .linearGradient(Gradient(colors: [LetterPalette.cream, LetterPalette.creamShade]),
                                                   startPoint: CGPoint(x: 0, y: 0), endPoint: CGPoint(x: 0, y: h)))
            // The bottom fold's edges, softer than the outline (as in envelope.png).
            var folds = Path()
            folds.move(to: CGPoint(x: m.corner * 0.55, y: h - m.corner * 0.55))
            folds.addLine(to: CGPoint(x: w / 2, y: h * 0.64))
            folds.addLine(to: CGPoint(x: w - m.corner * 0.55, y: h - m.corner * 0.55))
            ctx.stroke(folds, with: .color(LetterPalette.foldLine.opacity(0.75)), style: StrokeStyle(lineWidth: 1.5 * m.k, lineCap: .round, lineJoin: .round))
            LetterStamp.draw(ctx, center: CGPoint(x: w * 0.835, y: h * 0.71), k: m.k)
            ctx.stroke(pocket, with: .color(LetterPalette.plum), style: StrokeStyle(lineWidth: m.stroke, lineJoin: .round))
        }
        .frame(width: m.width, height: m.height + m.laceDepth + 2, alignment: .top)
    }
}

/// The flap: a lace-trimmed triangle hinged on the top edge. Outside it is cream; inside, lined.
struct LetterFlapFace: View, Equatable {
    let m: LetterEnvelopeMetrics
    let inside: Bool

    static func triangle(_ m: LetterEnvelopeMetrics) -> Path {
        let w = m.width, h = m.flapHeight, r = m.corner
        let tip = 7 * m.k
        var p = Path()
        p.move(to: CGPoint(x: r * 0.29, y: r * 0.29))
        p.addQuadCurve(to: CGPoint(x: r, y: 0), control: CGPoint(x: 0, y: 0))
        p.addLine(to: CGPoint(x: w - r, y: 0))
        p.addQuadCurve(to: CGPoint(x: w - r * 0.29, y: r * 0.29), control: CGPoint(x: w, y: 0))
        let slope = h / (w / 2)
        let back = tip / (1 + slope * slope).squareRoot()
        p.addLine(to: CGPoint(x: w / 2 + back, y: h - back * slope))
        p.addQuadCurve(to: CGPoint(x: w / 2 - back, y: h - back * slope), control: CGPoint(x: w / 2, y: h + 1.5 * m.k))
        p.closeSubpath()
        return p
    }

    var body: some View {
        Canvas { ctx, size in
            let w = m.width, h = m.flapHeight
            let r = m.corner
            LetterLace.draw(ctx, from: CGPoint(x: r * 0.5, y: r * 0.5 + 1), to: CGPoint(x: w / 2, y: h + 0.5), depth: m.laceDepth, scallop: m.scallop)
            LetterLace.draw(ctx, from: CGPoint(x: w / 2, y: h + 0.5), to: CGPoint(x: w - r * 0.5, y: r * 0.5 + 1), depth: m.laceDepth, scallop: m.scallop)
            let flap = LetterFlapFace.triangle(m)
            if inside {
                LetterLining.fill(ctx, flap, in: CGRect(x: 0, y: 0, width: w, height: h), k: m.k)
                ctx.fill(flap, with: .linearGradient(Gradient(colors: [LetterPalette.lid.opacity(0.22), LetterPalette.lid.opacity(0)]),
                                                     startPoint: .zero, endPoint: CGPoint(x: 0, y: h * 0.7)))
            } else {
                ctx.fill(flap, with: .linearGradient(Gradient(colors: [LetterPalette.rgb(0xfffaf2), LetterPalette.rgb(0xfcf0e2)]),
                                                     startPoint: .zero, endPoint: CGPoint(x: 0, y: h)))
            }
            ctx.stroke(flap, with: .color(LetterPalette.plum), style: StrokeStyle(lineWidth: m.stroke, lineJoin: .round))
        }
        .frame(width: m.width, height: m.flapHeight + m.laceDepth + 4, alignment: .top)
    }
}

/// The shadow the closed flap casts on the pocket (soft, slightly below the flap's edges).
struct LetterFlapShadow: View, Equatable {
    let m: LetterEnvelopeMetrics

    var body: some View {
        Canvas { ctx, size in
            var c = ctx
            c.addFilter(.blur(radius: 3 * m.k))
            c.translateBy(x: 0, y: m.laceDepth * 0.7 + 2.5 * m.k)
            c.fill(LetterFlapFace.triangle(m), with: .color(LetterPalette.plum.opacity(0.16)))
        }
        .frame(width: m.width, height: m.flapHeight + m.laceDepth + 14, alignment: .top)
    }
}

/// The satin band wrapped down the middle of the envelope.
struct LetterRibbonBand: View, Equatable {
    let m: LetterEnvelopeMetrics

    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height
            let rect = CGRect(x: 0, y: 0, width: w, height: h)
            // Satin: a base, darker edges and a sheen down the middle, each a two-stop gradient.
            ctx.fill(Path(rect), with: .color(LetterPalette.ribbon))
            ctx.fill(Path(CGRect(x: 0, y: 0, width: w * 0.32, height: h)),
                     with: .linearGradient(Gradient(colors: [LetterPalette.ribbonDeep, LetterPalette.ribbonDeep.opacity(0)]),
                                           startPoint: .zero, endPoint: CGPoint(x: w * 0.32, y: 0)))
            ctx.fill(Path(CGRect(x: w * 0.68, y: 0, width: w * 0.32, height: h)),
                     with: .linearGradient(Gradient(colors: [LetterPalette.ribbonDeep.opacity(0), LetterPalette.ribbonDeep]),
                                           startPoint: CGPoint(x: w * 0.68, y: 0), endPoint: CGPoint(x: w, y: 0)))
            ctx.fill(Path(CGRect(x: w * 0.30, y: 0, width: w * 0.16, height: h)),
                     with: .linearGradient(Gradient(colors: [LetterPalette.ribbonLight.opacity(0), LetterPalette.ribbonLight]),
                                           startPoint: CGPoint(x: w * 0.30, y: 0), endPoint: CGPoint(x: w * 0.46, y: 0)))
            ctx.fill(Path(CGRect(x: w * 0.46, y: 0, width: w * 0.16, height: h)),
                     with: .linearGradient(Gradient(colors: [LetterPalette.ribbonLight, LetterPalette.ribbonLight.opacity(0)]),
                                           startPoint: CGPoint(x: w * 0.46, y: 0), endPoint: CGPoint(x: w * 0.62, y: 0)))
            var stitches = Path()
            stitches.move(to: CGPoint(x: 2.4 * m.k, y: 0)); stitches.addLine(to: CGPoint(x: 2.4 * m.k, y: h))
            stitches.move(to: CGPoint(x: w - 2.4 * m.k, y: 0)); stitches.addLine(to: CGPoint(x: w - 2.4 * m.k, y: h))
            ctx.stroke(stitches, with: .color(Color.white.opacity(0.75)), style: StrokeStyle(lineWidth: 0.8 * m.k, dash: [2.6 * m.k, 2.2 * m.k]))
            // Where it wraps round the top and bottom edges.
            ctx.fill(Path(CGRect(x: 0, y: 0, width: w, height: 3 * m.k)), with: .color(LetterPalette.ribbonShadow.opacity(0.45)))
            ctx.fill(Path(CGRect(x: 0, y: h - 3 * m.k, width: w, height: 3 * m.k)), with: .color(LetterPalette.ribbonShadow.opacity(0.45)))
        }
        .frame(width: m.bandWidth, height: m.height)
    }
}

/// One loop of the bow, drawn pointing right from the knot (x = 0, vertically centred), with its
/// soft shadow on the envelope.
struct LetterBowLoop: View, Equatable {
    let m: LetterEnvelopeMetrics

    static func frame(_ m: LetterEnvelopeMetrics) -> CGSize {
        CGSize(width: m.loopLength + 12 * m.k, height: m.loopHeight + 16 * m.k)
    }

    var body: some View {
        Canvas { ctx, size in
            let L = m.loopLength, H = m.loopHeight
            let cy = size.height / 2
            let pinch = H * 0.15
            var outer = Path()
            outer.move(to: CGPoint(x: 0, y: cy - pinch))
            outer.addCurve(to: CGPoint(x: L * 0.97, y: cy - H * 0.14),
                           control1: CGPoint(x: L * 0.30, y: cy - H * 0.80),
                           control2: CGPoint(x: L * 1.02, y: cy - H * 0.70))
            outer.addCurve(to: CGPoint(x: L * 0.66, y: cy + H * 0.42),
                           control1: CGPoint(x: L * 0.93, y: cy + H * 0.26),
                           control2: CGPoint(x: L * 0.84, y: cy + H * 0.44))
            outer.addCurve(to: CGPoint(x: 0, y: cy + pinch),
                           control1: CGPoint(x: L * 0.42, y: cy + H * 0.40),
                           control2: CGPoint(x: L * 0.16, y: cy + H * 0.16))
            outer.closeSubpath()

            var shadow = ctx
            shadow.addFilter(.blur(radius: 2.6 * m.k))
            shadow.fill(outer.offsetBy(dx: 1 * m.k, dy: 3.2 * m.k), with: .color(LetterPalette.plum.opacity(0.16)))

            ctx.fill(outer, with: .linearGradient(Gradient(colors: [LetterPalette.ribbonLight, LetterPalette.ribbonDeep]),
                                                  startPoint: CGPoint(x: 0, y: cy - H * 0.5), endPoint: CGPoint(x: 0, y: cy + H * 0.45)))
            // The underside of the ribbon, seen inside the loop: darkest where it turns into the knot.
            var under = Path()
            under.move(to: CGPoint(x: 0, y: cy + pinch * 0.15))
            under.addCurve(to: CGPoint(x: L * 0.80, y: cy - H * 0.02),
                           control1: CGPoint(x: L * 0.30, y: cy - H * 0.26),
                           control2: CGPoint(x: L * 0.66, y: cy - H * 0.22))
            under.addCurve(to: CGPoint(x: L * 0.50, y: cy + H * 0.30),
                           control1: CGPoint(x: L * 0.80, y: cy + H * 0.16),
                           control2: CGPoint(x: L * 0.68, y: cy + H * 0.28))
            under.addCurve(to: CGPoint(x: 0, y: cy + pinch),
                           control1: CGPoint(x: L * 0.30, y: cy + H * 0.30),
                           control2: CGPoint(x: L * 0.12, y: cy + H * 0.14))
            under.closeSubpath()
            ctx.fill(under, with: .linearGradient(Gradient(colors: [LetterPalette.ribbonShadow.opacity(0.85), LetterPalette.ribbonDeep.opacity(0.25)]),
                                                  startPoint: CGPoint(x: 0, y: cy), endPoint: CGPoint(x: L * 0.85, y: cy)))
            // Satin folds fanning out of the knot.
            var folds = Path()
            folds.move(to: CGPoint(x: L * 0.06, y: cy - pinch * 0.55))
            folds.addQuadCurve(to: CGPoint(x: L * 0.62, y: cy - H * 0.40), control: CGPoint(x: L * 0.28, y: cy - H * 0.36))
            folds.move(to: CGPoint(x: L * 0.06, y: cy - pinch * 0.1))
            folds.addQuadCurve(to: CGPoint(x: L * 0.86, y: cy - H * 0.22), control: CGPoint(x: L * 0.40, y: cy - H * 0.22))
            ctx.stroke(folds, with: .color(LetterPalette.ribbonDeep.opacity(0.45)), style: StrokeStyle(lineWidth: 1.1 * m.k, lineCap: .round))
            var sheen = Path()
            sheen.move(to: CGPoint(x: L * 0.22, y: cy - H * 0.36))
            sheen.addCurve(to: CGPoint(x: L * 0.86, y: cy - H * 0.36),
                           control1: CGPoint(x: L * 0.40, y: cy - H * 0.60),
                           control2: CGPoint(x: L * 0.72, y: cy - H * 0.58))
            ctx.stroke(sheen, with: .color(Color.white.opacity(0.55)), style: StrokeStyle(lineWidth: 2.2 * m.k, lineCap: .round))
            ctx.stroke(outer, with: .color(LetterPalette.ribbonShadow), style: StrokeStyle(lineWidth: 1.3 * m.k, lineJoin: .round))
        }
        .frame(width: LetterBowLoop.frame(m).width, height: LetterBowLoop.frame(m).height)
    }
}

/// One tail of the bow, hanging down from the knot (top centre) and ending in a notch.
struct LetterBowTail: View, Equatable {
    let m: LetterEnvelopeMetrics

    var body: some View {
        Canvas { ctx, size in
            let L = m.tailLength, W = m.tailWidth
            let cx = size.width / 2
            let sway = W * 0.45
            var tail = Path()
            tail.move(to: CGPoint(x: cx - W * 0.42, y: 0))
            tail.addCurve(to: CGPoint(x: cx - W * 0.5 + sway, y: L),
                          control1: CGPoint(x: cx - W * 0.5 - sway, y: L * 0.35),
                          control2: CGPoint(x: cx - W * 0.5 + sway * 1.4, y: L * 0.7))
            tail.addLine(to: CGPoint(x: cx + sway * 0.85, y: L - W * 0.55))
            tail.addLine(to: CGPoint(x: cx + W * 0.5 + sway, y: L + W * 0.08))
            tail.addCurve(to: CGPoint(x: cx + W * 0.42, y: 0),
                          control1: CGPoint(x: cx + W * 0.5 + sway * 1.4, y: L * 0.7),
                          control2: CGPoint(x: cx + W * 0.5 - sway, y: L * 0.35))
            tail.closeSubpath()
            var shadow = ctx
            shadow.addFilter(.blur(radius: 2.2 * m.k))
            shadow.fill(tail.offsetBy(dx: 1 * m.k, dy: 2.6 * m.k), with: .color(LetterPalette.plum.opacity(0.13)))
            // Two-stop gradients only: CoreGraphics leaves a dotted seam at inner stops once rotated.
            ctx.fill(tail, with: .linearGradient(Gradient(colors: [LetterPalette.ribbonDeep, LetterPalette.ribbonLight]),
                                                 startPoint: CGPoint(x: cx - W * 0.8, y: 0), endPoint: CGPoint(x: cx + W * 0.6, y: L * 0.2)))
            var fold = Path()
            fold.move(to: CGPoint(x: cx - W * 0.1, y: L * 0.05))
            fold.addCurve(to: CGPoint(x: cx + sway * 0.6, y: L * 0.82),
                          control1: CGPoint(x: cx - W * 0.2 - sway * 0.6, y: L * 0.35),
                          control2: CGPoint(x: cx + sway * 1.1, y: L * 0.62))
            ctx.stroke(fold, with: .color(Color.white.opacity(0.45)), style: StrokeStyle(lineWidth: 1.6 * m.k, lineCap: .round))
            ctx.stroke(tail, with: .color(LetterPalette.ribbonShadow), style: StrokeStyle(lineWidth: 1.2 * m.k, lineJoin: .round))
        }
        .frame(width: m.tailWidth * 2.6, height: m.tailLength + m.tailWidth)
    }
}

/// The knot in the middle of the bow (under the seal until the seal pops).
struct LetterBowKnot: View, Equatable {
    let m: LetterEnvelopeMetrics

    var body: some View {
        Canvas { ctx, size in
            let rect = CGRect(origin: .zero, size: size).insetBy(dx: 1, dy: 1)
            let knot = Path(roundedRect: rect, cornerRadius: rect.width * 0.38, style: .continuous)
            ctx.fill(knot, with: .linearGradient(Gradient(colors: [LetterPalette.ribbonLight, LetterPalette.ribbonDeep]),
                                                 startPoint: .zero, endPoint: CGPoint(x: 0, y: size.height)))
            var creases = Path()
            creases.move(to: CGPoint(x: rect.minX + rect.width * 0.3, y: rect.minY + 2))
            creases.addQuadCurve(to: CGPoint(x: rect.minX + rect.width * 0.3, y: rect.maxY - 2), control: CGPoint(x: rect.minX + rect.width * 0.18, y: rect.midY))
            creases.move(to: CGPoint(x: rect.maxX - rect.width * 0.3, y: rect.minY + 2))
            creases.addQuadCurve(to: CGPoint(x: rect.maxX - rect.width * 0.3, y: rect.maxY - 2), control: CGPoint(x: rect.maxX - rect.width * 0.18, y: rect.midY))
            ctx.stroke(creases, with: .color(LetterPalette.ribbonShadow.opacity(0.6)), lineWidth: 1 * m.k)
            ctx.stroke(knot, with: .color(LetterPalette.ribbonShadow), lineWidth: 1.3 * m.k)
        }
        .frame(width: 24 * m.k, height: 27 * m.k)
    }
}

/// The red wax seal pressed with a heart.
struct LetterWaxSeal: View, Equatable {
    let size: CGFloat

    var body: some View {
        Canvas { ctx, canvas in
            let c = CGPoint(x: canvas.width / 2, y: canvas.height / 2)
            let R = size / 2
            var blob = Path()
            let steps = 72
            for i in 0...steps {
                let a: Double = Double(i) / Double(steps) * 2 * Double.pi
                let wobble: Double = 0.04 * sin(7 * a + 0.4) + 0.025 * sin(12 * a + 1.3) + 0.018 * sin(3 * a)
                let r: CGFloat = R * CGFloat(1 + wobble)
                let p = CGPoint(x: c.x + r * CGFloat(cos(a)), y: c.y + r * CGFloat(sin(a)))
                if i == 0 { blob.move(to: p) } else { blob.addLine(to: p) }
            }
            blob.closeSubpath()
            var shadow = ctx
            shadow.addFilter(.blur(radius: R * 0.12))
            shadow.fill(blob.offsetBy(dx: 0, dy: R * 0.1), with: .color(LetterPalette.sealDeep.opacity(0.45)))
            ctx.fill(blob, with: .radialGradient(Gradient(colors: [LetterPalette.sealLight, LetterPalette.sealDeep]),
                                                 center: CGPoint(x: c.x - R * 0.3, y: c.y - R * 0.35), startRadius: 0, endRadius: R * 1.45))
            // The pressed ring.
            let ring = Path(ellipseIn: CGRect(x: c.x - R * 0.72, y: c.y - R * 0.72, width: R * 1.44, height: R * 1.44))
            ctx.stroke(ring.offsetBy(dx: 0, dy: R * 0.03), with: .color(LetterPalette.rgb(0xff8fa3, 0.55)), lineWidth: R * 0.05)
            ctx.stroke(ring, with: .color(LetterPalette.sealDeep.opacity(0.9)), lineWidth: R * 0.06)
            // The heart, embossed.
            let heartRect = CGRect(x: c.x - R * 0.42, y: c.y - R * 0.36, width: R * 0.84, height: R * 0.76)
            ctx.fill(LetterHeart().path(in: heartRect.offsetBy(dx: R * 0.03, dy: R * 0.05)), with: .color(LetterPalette.sealDeep.opacity(0.8)))
            ctx.fill(LetterHeart().path(in: heartRect), with: .linearGradient(Gradient(colors: [LetterPalette.rgb(0xffeef2), LetterPalette.rgb(0xffc9d5)]),
                                                                              startPoint: CGPoint(x: 0, y: heartRect.minY), endPoint: CGPoint(x: 0, y: heartRect.maxY)))
            // Gloss.
            var gloss = Path()
            gloss.addArc(center: c, radius: R * 0.86, startAngle: .degrees(200), endAngle: .degrees(258), clockwise: false)
            ctx.stroke(gloss, with: .color(Color.white.opacity(0.38)), style: StrokeStyle(lineWidth: R * 0.09, lineCap: .round))
        }
        .frame(width: size * 1.3, height: size * 1.3)
    }
}

/// A plump heart that fills its rect.
struct LetterHeart: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let w = r.width, h = r.height
        p.move(to: CGPoint(x: r.minX + w * 0.5, y: r.minY + h * 0.98))
        p.addCurve(to: CGPoint(x: r.minX, y: r.minY + h * 0.32),
                   control1: CGPoint(x: r.minX + w * 0.30, y: r.minY + h * 0.80),
                   control2: CGPoint(x: r.minX, y: r.minY + h * 0.62))
        p.addCurve(to: CGPoint(x: r.minX + w * 0.5, y: r.minY + h * 0.16),
                   control1: CGPoint(x: r.minX, y: r.minY - h * 0.04),
                   control2: CGPoint(x: r.minX + w * 0.42, y: r.minY - h * 0.02))
        p.addCurve(to: CGPoint(x: r.maxX, y: r.minY + h * 0.32),
                   control1: CGPoint(x: r.minX + w * 0.58, y: r.minY - h * 0.02),
                   control2: CGPoint(x: r.maxX, y: r.minY - h * 0.04))
        p.addCurve(to: CGPoint(x: r.minX + w * 0.5, y: r.minY + h * 0.98),
                   control1: CGPoint(x: r.maxX, y: r.minY + h * 0.62),
                   control2: CGPoint(x: r.minX + w * 0.70, y: r.minY + h * 0.80))
        p.closeSubpath()
        return p
    }
}

/// A four-pointed twinkle.
struct LetterSparkle: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let c = CGPoint(x: r.midX, y: r.midY)
        let a = r.width / 2, b = r.height / 2
        let pinch: CGFloat = 0.16
        p.move(to: CGPoint(x: c.x, y: c.y - b))
        p.addQuadCurve(to: CGPoint(x: c.x + a, y: c.y), control: CGPoint(x: c.x + a * pinch, y: c.y - b * pinch))
        p.addQuadCurve(to: CGPoint(x: c.x, y: c.y + b), control: CGPoint(x: c.x + a * pinch, y: c.y + b * pinch))
        p.addQuadCurve(to: CGPoint(x: c.x - a, y: c.y), control: CGPoint(x: c.x - a * pinch, y: c.y + b * pinch))
        p.addQuadCurve(to: CGPoint(x: c.x, y: c.y - b), control: CGPoint(x: c.x - a * pinch, y: c.y - b * pinch))
        p.closeSubpath()
        return p
    }
}

/// A red heart with a soft highlight (the little hearts that float out).
struct LetterRedHeart: View, Equatable {
    let size: CGFloat

    var body: some View {
        Canvas { ctx, canvas in
            let rect = CGRect(origin: .zero, size: canvas)
            ctx.fill(LetterHeart().path(in: rect), with: .linearGradient(Gradient(colors: [LetterPalette.sealLight, LetterPalette.seal]),
                                                                         startPoint: .zero, endPoint: CGPoint(x: canvas.width * 0.4, y: canvas.height)))
            ctx.fill(Path(ellipseIn: CGRect(x: rect.width * 0.17, y: rect.height * 0.13, width: rect.width * 0.24, height: rect.height * 0.16)),
                     with: .color(Color.white.opacity(0.55)))
        }
        .frame(width: size, height: size * 0.9)
    }
}

/// A little postage stamp with a red heart, and a soft postmark across its corner.
enum LetterStamp {
    static func draw(_ ctx: GraphicsContext, center: CGPoint, k: CGFloat) {
        var c = ctx
        c.translateBy(x: center.x, y: center.y)
        c.rotate(by: .degrees(7))
        let w = 30 * k, h = 36 * k
        let rect = CGRect(x: -w / 2, y: -h / 2, width: w, height: h)
        // Perforated edge: a white stamp with little bites taken out all round.
        var paper = Path(rect)
        let bite = 1.7 * k
        var holes = Path()
        var x = rect.minX + bite * 2
        while x < rect.maxX - bite {
            holes.addEllipse(in: CGRect(x: x - bite, y: rect.minY - bite, width: bite * 2, height: bite * 2))
            holes.addEllipse(in: CGRect(x: x - bite, y: rect.maxY - bite, width: bite * 2, height: bite * 2))
            x += bite * 3.2
        }
        var y = rect.minY + bite * 2
        while y < rect.maxY - bite {
            holes.addEllipse(in: CGRect(x: rect.minX - bite, y: y - bite, width: bite * 2, height: bite * 2))
            holes.addEllipse(in: CGRect(x: rect.maxX - bite, y: y - bite, width: bite * 2, height: bite * 2))
            y += bite * 3.2
        }
        paper = paper.subtracting(holes)
        var shadow = c
        shadow.translateBy(x: 0.8 * k, y: 1.2 * k)
        shadow.fill(paper, with: .color(LetterPalette.plum.opacity(0.12)))
        c.fill(paper, with: .color(Color.white))
        let inner = rect.insetBy(dx: 4 * k, dy: 4 * k)
        c.fill(Path(inner), with: .linearGradient(Gradient(colors: [LetterPalette.rgb(0xfde4ef), LetterPalette.rgb(0xf3e3f8)]),
                                                  startPoint: CGPoint(x: 0, y: inner.minY), endPoint: CGPoint(x: 0, y: inner.maxY)))
        c.stroke(Path(inner), with: .color(LetterPalette.ribbonDeep.opacity(0.55)), lineWidth: 0.7 * k)
        let heart = CGRect(x: -7.5 * k, y: -6.5 * k, width: 15 * k, height: 13.5 * k)
        c.fill(LetterHeart().path(in: heart), with: .linearGradient(Gradient(colors: [LetterPalette.sealLight, LetterPalette.seal]),
                                                                    startPoint: CGPoint(x: heart.minX, y: heart.minY), endPoint: CGPoint(x: heart.midX, y: heart.maxY)))
        c.fill(Path(ellipseIn: CGRect(x: heart.minX + 2.5 * k, y: heart.minY + 2 * k, width: 3.5 * k, height: 2.4 * k)), with: .color(Color.white.opacity(0.55)))
        // The postmark: a ring and three waves, in faded plum ink.
        var mark = c
        mark.translateBy(x: -w * 0.62, y: -h * 0.18)
        mark.rotate(by: .degrees(-12))
        let ink = LetterPalette.plum.opacity(0.3)
        mark.stroke(Path(ellipseIn: CGRect(x: -10 * k, y: -10 * k, width: 20 * k, height: 20 * k)), with: .color(ink), lineWidth: 1.1 * k)
        mark.stroke(Path(ellipseIn: CGRect(x: -6.5 * k, y: -6.5 * k, width: 13 * k, height: 13 * k)), with: .color(ink), lineWidth: 0.7 * k)
        var waves = Path()
        for row in 0..<3 {
            let yy = (CGFloat(row) - 1) * 4.5 * k
            waves.move(to: CGPoint(x: 12 * k, y: yy))
            var xx = 12 * k
            var up = true
            while xx < 34 * k {
                waves.addQuadCurve(to: CGPoint(x: xx + 5.5 * k, y: yy), control: CGPoint(x: xx + 2.75 * k, y: yy + (up ? -2.2 : 2.2) * k))
                xx += 5.5 * k
                up.toggle()
            }
        }
        mark.stroke(waves, with: .color(ink), style: StrokeStyle(lineWidth: 0.9 * k, lineCap: .round))
    }
}
