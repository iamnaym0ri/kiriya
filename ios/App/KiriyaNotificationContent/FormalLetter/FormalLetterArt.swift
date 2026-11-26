import SwiftUI

// The stationery's small pieces, drawn as paths: the paper's deckled, gilded edge, the letterhead
// crest (a script K in a gilt oval with a little laurel and a heart), the hairline ornaments, the
// plum liner's pattern and the claret wax seal, whole or broken along the flap's edge.
// Gradients that turn with a piece are always two-stop (layered where more tones are needed):
// CoreGraphics seams multi-stop gradients at their inner stops when they're rotated.

enum FormalLetterDeckle {
    /// A sheet whose edges wander a little, the way handmade cotton paper does.
    static func path(_ rect: CGRect, seed: Double, depth: CGFloat = 1.5, step: CGFloat = 1.6) -> Path {
        typealias Mo = FormalLetterMotion
        var p = Path()
        func off(_ s: CGFloat, _ side: Double) -> CGFloat {
            // Long soft undulation plus a finer, irregular tooth: deckle, not scallops.
            let slow = Mo.wobble(Double(s) * 0.31, seed: seed + side)
            let fine = sin(Double(s) * 2.9 + seed * 5 + side) * sin(Double(s) * 1.13 + side * 2)
            return depth * CGFloat(0.5 + 0.32 * slow + 0.25 * fine)
        }
        let corner: CGFloat = 1.6
        // Top edge, left to right.
        var x = rect.minX + corner
        p.move(to: CGPoint(x: x, y: rect.minY + off(x, 1)))
        while x < rect.maxX - corner {
            x = min(rect.maxX - corner, x + step)
            p.addLine(to: CGPoint(x: x, y: rect.minY + off(x, 1)))
        }
        // Right edge, top to bottom.
        var y = rect.minY + corner
        while y < rect.maxY - corner {
            p.addLine(to: CGPoint(x: rect.maxX - off(y, 2), y: y))
            y = min(rect.maxY - corner, y + step)
        }
        p.addLine(to: CGPoint(x: rect.maxX - off(y, 2), y: y))
        // Bottom edge, right to left.
        x = rect.maxX - corner
        while x > rect.minX + corner {
            p.addLine(to: CGPoint(x: x, y: rect.maxY - off(x, 3)))
            x = max(rect.minX + corner, x - step)
        }
        p.addLine(to: CGPoint(x: x, y: rect.maxY - off(x, 3)))
        // Left edge, bottom to top.
        y = rect.maxY - corner
        while y > rect.minY + corner {
            p.addLine(to: CGPoint(x: rect.minX + off(y, 4), y: y))
            y = max(rect.minY + corner, y - step)
        }
        p.closeSubpath()
        return p
    }

    /// The gilt along the edge: a fine champagne line with a brighter catch of light on it.
    static func gild(_ ctx: GraphicsContext, _ sheet: Path, size: CGSize, width: CGFloat = 1.5) {
        ctx.stroke(sheet, with: .linearGradient(Gradient(colors: [FormalLetterPalette.goldLight, FormalLetterPalette.gold]),
                                                startPoint: .zero, endPoint: CGPoint(x: size.width, y: size.height)),
                   lineWidth: width)
        ctx.stroke(sheet, with: .color(FormalLetterPalette.goldDeep.opacity(0.35)), lineWidth: 0.4)
    }
}

/// Small vector hearts (the drawn ones; hearts in text are the red ❤️).
struct FormalLetterHeart: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width, h = rect.height
        var p = Path()
        p.move(to: CGPoint(x: rect.minX + w * 0.5, y: rect.minY + h * 0.98))
        p.addCurve(to: CGPoint(x: rect.minX, y: rect.minY + h * 0.32),
                   control1: CGPoint(x: rect.minX + w * 0.32, y: rect.minY + h * 0.8),
                   control2: CGPoint(x: rect.minX, y: rect.minY + h * 0.58))
        p.addCurve(to: CGPoint(x: rect.minX + w * 0.5, y: rect.minY + h * 0.17),
                   control1: CGPoint(x: rect.minX, y: rect.minY + h * 0.02),
                   control2: CGPoint(x: rect.minX + w * 0.38, y: rect.minY - h * 0.04))
        p.addCurve(to: CGPoint(x: rect.maxX, y: rect.minY + h * 0.32),
                   control1: CGPoint(x: rect.minX + w * 0.62, y: rect.minY - h * 0.04),
                   control2: CGPoint(x: rect.maxX, y: rect.minY + h * 0.02))
        p.addCurve(to: CGPoint(x: rect.minX + w * 0.5, y: rect.minY + h * 0.98),
                   control1: CGPoint(x: rect.maxX, y: rect.minY + h * 0.58),
                   control2: CGPoint(x: rect.minX + w * 0.68, y: rect.minY + h * 0.8))
        p.closeSubpath()
        return p
    }
}

enum FormalLetterOrnament {
    /// A gilt hairline with a little rose heart in the middle and a dot at each end.
    static func rule(_ ctx: GraphicsContext, center: CGPoint, width: CGFloat, heart: CGFloat = 7) {
        let gap = heart * 1.25
        var line = Path()
        line.move(to: CGPoint(x: center.x - width / 2, y: center.y))
        line.addLine(to: CGPoint(x: center.x - gap, y: center.y))
        line.move(to: CGPoint(x: center.x + gap, y: center.y))
        line.addLine(to: CGPoint(x: center.x + width / 2, y: center.y))
        ctx.stroke(line, with: .linearGradient(Gradient(colors: [FormalLetterPalette.gold.opacity(0.15), FormalLetterPalette.gold.opacity(0.85)]),
                                               startPoint: CGPoint(x: center.x - width / 2, y: 0), endPoint: CGPoint(x: center.x - gap, y: 0)),
                   lineWidth: 0.8)
        var right = Path()
        right.move(to: CGPoint(x: center.x + gap, y: center.y))
        right.addLine(to: CGPoint(x: center.x + width / 2, y: center.y))
        ctx.stroke(right, with: .linearGradient(Gradient(colors: [FormalLetterPalette.gold.opacity(0.85), FormalLetterPalette.gold.opacity(0.15)]),
                                                startPoint: CGPoint(x: center.x + gap, y: 0), endPoint: CGPoint(x: center.x + width / 2, y: 0)),
                   lineWidth: 0.8)
        for side in [-1.0, 1.0] {
            let x = center.x + CGFloat(side) * (gap + 4)
            ctx.fill(Path(ellipseIn: CGRect(x: x - 1.1, y: center.y - 1.1, width: 2.2, height: 2.2)), with: .color(FormalLetterPalette.gold))
        }
        ctx.fill(FormalLetterHeart().path(in: CGRect(x: center.x - heart / 2, y: center.y - heart * 0.47, width: heart, height: heart * 0.9)),
                 with: .color(FormalLetterPalette.rose))
    }
}

/// The letterhead: a sleepy lilac kitten in a gilt double oval, a little laurel round its foot and a
/// heart. `kitten: false` leaves the oval empty, for when the kitten is drawn on its own (to blink).
enum FormalLetterCrest {
    enum Look { case printed, embossed }

    static func draw(_ ctx: GraphicsContext, center: CGPoint, height h: CGFloat, look: Look = .printed, kitten: Bool = true) {
        let w = h * 0.74
        let oval = CGRect(x: center.x - w / 2, y: center.y - h / 2, width: w, height: h)
        let inner = oval.insetBy(dx: h * 0.06, dy: h * 0.06)

        func frame(_ c: GraphicsContext, leaf: Color, heartColor: Color, offset: CGSize) {
            var c = c
            c.translateBy(x: offset.width, y: offset.height)
            c.stroke(Path(ellipseIn: oval), with: .color(leaf), lineWidth: 0.9)
            c.stroke(Path(ellipseIn: inner), with: .color(leaf.opacity(0.55)), lineWidth: 0.5)
            // Laurel: a sprig up each side of the oval's foot.
            for side in [-1.0, 1.0] {
                var stem = Path()
                let start = CGPoint(x: center.x + CGFloat(side) * h * 0.06, y: center.y + h * 0.56)
                stem.move(to: start)
                let end = CGPoint(x: center.x + CGFloat(side) * h * 0.53, y: center.y - h * 0.02)
                let control = CGPoint(x: center.x + CGFloat(side) * h * 0.52, y: center.y + h * 0.5)
                stem.addQuadCurve(to: end, control: control)
                c.stroke(stem, with: .color(leaf), style: StrokeStyle(lineWidth: 0.7, lineCap: .round))
                for index in 0..<5 {
                    let u = 0.2 + Double(index) * 0.18
                    let a = CGFloat(1 - u), b = CGFloat(u)
                    let point = CGPoint(x: a * a * start.x + 2 * a * b * control.x + b * b * end.x,
                                        y: a * a * start.y + 2 * a * b * control.y + b * b * end.y)
                    let tangent = CGPoint(x: 2 * a * (control.x - start.x) + 2 * b * (end.x - control.x),
                                          y: 2 * a * (control.y - start.y) + 2 * b * (end.y - control.y))
                    let angle = atan2(tangent.y, tangent.x)
                    for flip in [-1.0, 1.0] {
                        var leafContext = c
                        leafContext.translateBy(x: point.x, y: point.y)
                        leafContext.rotate(by: .radians(Double(angle) + flip * 0.62 * side))
                        let length = h * (0.13 - 0.012 * CGFloat(index))
                        leafContext.fill(Path(ellipseIn: CGRect(x: 0, y: -length * 0.2, width: length, height: length * 0.4)), with: .color(leaf))
                    }
                }
            }
            c.fill(FormalLetterHeart().path(in: CGRect(x: center.x - h * 0.065, y: center.y + h * 0.5, width: h * 0.13, height: h * 0.12)),
                   with: .color(heartColor))
        }

        switch look {
        case .printed:
            frame(ctx, leaf: FormalLetterPalette.gold, heartColor: FormalLetterPalette.rose, offset: .zero)
            if kitten { FormalLetterKitten.draw(ctx, center: center, crestHeight: h) }
        case .embossed:
            // Blind embossed: no ink, just the paper raised (light above, shade below).
            let light = Color.white.opacity(0.9), shade = FormalLetterPalette.crease.opacity(0.32), base = FormalLetterPalette.paperBack
            frame(ctx, leaf: light, heartColor: light, offset: CGSize(width: -0.6, height: -0.6))
            frame(ctx, leaf: shade, heartColor: shade, offset: CGSize(width: 0.6, height: 0.7))
            frame(ctx, leaf: base, heartColor: base, offset: .zero)
            if kitten { FormalLetterKitten.drawEmbossed(ctx, center: center, crestHeight: h) }
        }
    }
}

/// How the crest's kitten looks at a moment: how far it has opened its sleepy eyes (0 closed and
/// content, 1 peeking) and the turn of its right ear (degrees).
struct FormalLetterKittenPose: Equatable {
    var open: Double = 0
    var ear: Double = 0
    static let rest = FormalLetterKittenPose()
}

/// The crest's kitten: an original little lilac cat face, front on, sleepy and content, with blush
/// ears and cheeks, a pink nose, an ω mouth, fine whiskers, faint tabby marks and a sprig of
/// lavender tucked behind one ear (the apothecary's touch). Drawn in units of the crest's height.
enum FormalLetterKitten {
    typealias P = FormalLetterPalette
    static let furLight = P.rgb(0xf1e8f9)
    static let furDeep = P.rgb(0xd5c2ea)
    static let line = P.rgb(0x6f4f86)
    static let earInner = P.rgb(0xf4c4d6)
    static let nose = P.rgb(0xe48aab)
    static let cheek = P.rgb(0xf2a9c3)
    static let tabby = P.rgb(0xb79cd4)

    /// The face's width and its centre, for a crest of height `h` centred at `center`.
    static func metrics(center: CGPoint, crestHeight h: CGFloat) -> (w: CGFloat, head: CGPoint) {
        (h * 0.52, CGPoint(x: center.x, y: center.y + h * 0.1))
    }

    static func headPath(_ o: CGPoint, _ w: CGFloat) -> Path {
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: o.x + x * w, y: o.y + y * w) }
        var p = Path()
        p.move(to: pt(0, -0.36))
        p.addCurve(to: pt(0.5, 0.04), control1: pt(0.3, -0.36), control2: pt(0.5, -0.22))
        p.addCurve(to: pt(0, 0.4), control1: pt(0.5, 0.3), control2: pt(0.27, 0.4))
        p.addCurve(to: pt(-0.5, 0.04), control1: pt(-0.27, 0.4), control2: pt(-0.5, 0.3))
        p.addCurve(to: pt(0, -0.36), control1: pt(-0.5, -0.22), control2: pt(-0.3, -0.36))
        p.closeSubpath()
        return p
    }

    /// An ear (side -1 left, 1 right), turned about its base by `turn` degrees; `scale` < 1 for the inner ear.
    static func earPath(_ o: CGPoint, _ w: CGFloat, side s: CGFloat, turn: Double, scale: CGFloat = 1) -> Path {
        let base = CGPoint(x: o.x + s * 0.27 * w, y: o.y - 0.25 * w)
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            // Relative to the base, shrunk towards it for the inner ear.
            CGPoint(x: base.x + (o.x + s * x * w - base.x) * scale, y: base.y + (o.y + y * w - base.y) * scale)
        }
        var p = Path()
        p.move(to: pt(0.47, -0.12))
        p.addCurve(to: pt(0.07, -0.34), control1: pt(0.46, -0.66), control2: pt(0.16, -0.62))
        p.closeSubpath()
        let turnAbout = CGAffineTransform(translationX: base.x, y: base.y).rotated(by: CGFloat(turn * Double.pi / 180 * Double(s)))
            .translatedBy(x: -base.x, y: -base.y)
        return p.applying(turnAbout)
    }

    static func draw(_ ctx: GraphicsContext, center: CGPoint, crestHeight h: CGFloat, pose: FormalLetterKittenPose = .rest) {
        let (w, o) = metrics(center: center, crestHeight: h)
        let stroke = max(0.65, w * 0.026)
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: o.x + x * w, y: o.y + y * w) }

        // A sprig of lavender, its stem tucked behind the right ear.
        sprig(ctx, from: pt(0.17, -0.12), angle: -50, length: w * 0.7)

        // Ears, then the head over their bases.
        for side in [-1.0, 1.0] as [CGFloat] {
            let turn = side > 0 ? pose.ear : 0
            let ear = earPath(o, w, side: side, turn: turn)
            ctx.fill(ear, with: .linearGradient(Gradient(colors: [furLight, furDeep]), startPoint: pt(0, -0.62), endPoint: pt(0, -0.1)))
            ctx.stroke(ear, with: .color(line), style: StrokeStyle(lineWidth: stroke, lineJoin: .round))
            ctx.fill(earPath(o, w, side: side, turn: turn, scale: 0.55).offsetBy(dx: -side * 0.02 * w, dy: 0.02 * w), with: .color(earInner))
        }
        let head = headPath(o, w)
        ctx.fill(head, with: .linearGradient(Gradient(colors: [furLight, furDeep]), startPoint: pt(0, -0.36), endPoint: pt(0, 0.42)))
        ctx.stroke(head, with: .color(line), style: StrokeStyle(lineWidth: stroke, lineJoin: .round))

        // Faint tabby marks on the forehead.
        var marks = Path()
        for (x, len) in [(-0.07, 0.07), (0, 0.09), (0.07, 0.07)] as [(CGFloat, CGFloat)] {
            marks.move(to: pt(x, -0.31))
            marks.addLine(to: pt(x * 0.85, -0.31 + len))
        }
        ctx.stroke(marks, with: .color(tabby), style: StrokeStyle(lineWidth: stroke * 0.8, lineCap: .round))

        // Cheeks.
        for side in [-1.0, 1.0] as [CGFloat] {
            var blush = ctx
            blush.addFilter(.blur(radius: w * 0.02))
            blush.fill(Path(ellipseIn: CGRect(x: o.x + side * 0.3 * w - 0.075 * w, y: o.y + 0.1 * w, width: 0.15 * w, height: 0.075 * w)),
                       with: .color(cheek.opacity(0.55)))
        }

        // Sleepy, content eyes: soft downward curves. When it peeks, round dark eyes open from
        // the middle of each curve (with a glint) as the curves fade.
        let open = CGFloat(max(0, min(1, pose.open)))
        for side in [-1.0, 1.0] as [CGFloat] {
            let c = pt(side * 0.19, -0.02)
            let ew = 0.085 * w, ed = 0.07 * w
            if open > 0.005 {
                let rx = 0.066 * w, ry = 0.08 * w * open
                let center = CGPoint(x: c.x, y: c.y + ed * 0.95 - ry * 0.45)
                ctx.fill(Path(ellipseIn: CGRect(x: center.x - rx, y: center.y - ry, width: rx * 2, height: ry * 2)), with: .color(line))
                if open > 0.5 {
                    let r = rx * 0.32
                    ctx.fill(Path(ellipseIn: CGRect(x: center.x - rx * 0.35 - r, y: center.y - ry * 0.45 - r, width: r * 2, height: r * 2)),
                             with: .color(Color.white.opacity(0.95 * Double((open - 0.5) / 0.5))))
                }
            }
            var lower = Path()
            lower.move(to: CGPoint(x: c.x - ew, y: c.y))
            lower.addQuadCurve(to: CGPoint(x: c.x + ew, y: c.y), control: CGPoint(x: c.x, y: c.y + ed * 2))
            ctx.stroke(lower, with: .color(line.opacity(Double(1 - open))), style: StrokeStyle(lineWidth: stroke * 1.1, lineCap: .round))
        }

        // Nose and ω mouth.
        var nose = Path()
        nose.move(to: pt(-0.042, 0.095))
        nose.addQuadCurve(to: pt(0.042, 0.095), control: pt(0, 0.08))
        nose.addQuadCurve(to: pt(0, 0.15), control: pt(0.04, 0.13))
        nose.addQuadCurve(to: pt(-0.042, 0.095), control: pt(-0.04, 0.13))
        ctx.fill(nose, with: .color(Self.nose))
        var mouth = Path()
        mouth.move(to: pt(-0.085, 0.15))
        mouth.addQuadCurve(to: pt(0, 0.152), control: pt(-0.05, 0.225))
        mouth.addQuadCurve(to: pt(0.085, 0.15), control: pt(0.05, 0.225))
        ctx.stroke(mouth, with: .color(line), style: StrokeStyle(lineWidth: stroke * 0.85, lineCap: .round, lineJoin: .round))

        // Fine whiskers, kept inside the oval.
        var whiskers = Path()
        for side in [-1.0, 1.0] as [CGFloat] {
            whiskers.move(to: pt(side * 0.36, 0.1)); whiskers.addLine(to: pt(side * 0.56, 0.075))
            whiskers.move(to: pt(side * 0.36, 0.15)); whiskers.addLine(to: pt(side * 0.55, 0.17))
        }
        ctx.stroke(whiskers, with: .color(line.opacity(0.5)), style: StrokeStyle(lineWidth: stroke * 0.6, lineCap: .round))
    }

    /// A tiny lavender sprig: a fine stem, five buds alternating along its top, one slim leaf.
    static func sprig(_ ctx: GraphicsContext, from: CGPoint, angle: Double, length L: CGFloat) {
        var c = ctx
        c.translateBy(x: from.x, y: from.y)
        c.rotate(by: .degrees(angle))
        var stem = Path()
        stem.move(to: .zero)
        stem.addQuadCurve(to: CGPoint(x: L, y: 0), control: CGPoint(x: L * 0.5, y: L * 0.04))
        c.stroke(stem, with: .color(FormalLetterFloraTone.day.stem), style: StrokeStyle(lineWidth: max(0.6, L * 0.04), lineCap: .round))
        var leaf = Path()
        leaf.move(to: CGPoint(x: L * 0.3, y: 0))
        leaf.addQuadCurve(to: CGPoint(x: L * 0.55, y: L * 0.12), control: CGPoint(x: L * 0.38, y: L * 0.14))
        leaf.addQuadCurve(to: CGPoint(x: L * 0.3, y: 0), control: CGPoint(x: L * 0.5, y: L * 0.02))
        c.fill(leaf, with: .color(FormalLetterFloraTone.day.leafDeep))
        for i in 0..<5 {
            let u = 0.46 + 0.125 * CGFloat(i)
            let side: CGFloat = i.isMultiple(of: 2) ? -1 : 1
            let size = L * (0.17 - 0.018 * CGFloat(i))
            var b = c
            b.translateBy(x: L * u, y: side * size * 0.32)
            b.rotate(by: .degrees(Double(side) * 28))
            let rect = CGRect(x: -size / 2, y: -size * 0.32, width: size, height: size * 0.64)
            b.fill(Path(ellipseIn: rect), with: .linearGradient(Gradient(colors: [FormalLetterFloraTone.day.lavenderLight, FormalLetterFloraTone.day.lavenderDeep]),
                                                                startPoint: CGPoint(x: 0, y: rect.minY), endPoint: CGPoint(x: 0, y: rect.maxY)))
        }
    }

    /// The kitten blind-embossed (the folded letter's outside): raised silhouette, pressed-in features.
    static func drawEmbossed(_ ctx: GraphicsContext, center: CGPoint, crestHeight h: CGFloat) {
        let (w, o) = metrics(center: center, crestHeight: h)
        var shape = headPath(o, w)
        shape.addPath(earPath(o, w, side: -1, turn: 0))
        shape.addPath(earPath(o, w, side: 1, turn: 0))
        var lit = ctx
        lit.translateBy(x: -0.6, y: -0.6)
        lit.stroke(shape, with: .color(Color.white.opacity(0.9)), lineWidth: 0.9)
        var shade = ctx
        shade.translateBy(x: 0.6, y: 0.7)
        shade.stroke(shape, with: .color(FormalLetterPalette.crease.opacity(0.3)), lineWidth: 0.9)
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: o.x + x * w, y: o.y + y * w) }
        var features = Path()
        for side in [-1.0, 1.0] as [CGFloat] {
            let c = pt(side * 0.19, -0.02)
            features.move(to: CGPoint(x: c.x - 0.085 * w, y: c.y))
            features.addQuadCurve(to: CGPoint(x: c.x + 0.085 * w, y: c.y), control: CGPoint(x: c.x, y: c.y + 0.14 * w))
        }
        features.move(to: pt(-0.085, 0.15))
        features.addQuadCurve(to: pt(0, 0.152), control: pt(-0.05, 0.225))
        features.addQuadCurve(to: pt(0.085, 0.15), control: pt(0.05, 0.225))
        ctx.stroke(features, with: .color(FormalLetterPalette.crease.opacity(0.35)), style: StrokeStyle(lineWidth: 0.7, lineCap: .round))
    }
}

/// The envelope's liner: plum paper with a gilt diamond lattice, tiny gold dots and little hearts.
enum FormalLetterLiner {
    static func fill(_ ctx: GraphicsContext, _ shape: Path, in rect: CGRect, k: CGFloat) {
        var c = ctx
        c.fill(shape, with: .linearGradient(Gradient(colors: [FormalLetterPalette.liner, FormalLetterPalette.linerDeep]),
                                            startPoint: CGPoint(x: rect.minX, y: rect.minY), endPoint: CGPoint(x: rect.minX, y: rect.maxY)))
        c.clip(to: shape)
        let cell = 15 * k
        var lattice = Path()
        var x = rect.minX - rect.height
        while x < rect.maxX + rect.height {
            lattice.move(to: CGPoint(x: x, y: rect.minY))
            lattice.addLine(to: CGPoint(x: x + rect.height, y: rect.maxY))
            lattice.move(to: CGPoint(x: x + rect.height, y: rect.minY))
            lattice.addLine(to: CGPoint(x: x, y: rect.maxY))
            x += cell * 1.414
        }
        c.stroke(lattice, with: .color(FormalLetterPalette.linerGold.opacity(0.28)), lineWidth: 0.55 * k)
        var dots = Path()
        var hearts = Path()
        let step = cell * 1.414 / 2
        var row = 0
        var y = rect.minY
        while y < rect.maxY + step {
            var x = rect.minX + (row.isMultiple(of: 2) ? 0 : step)
            var column = 0
            while x < rect.maxX + step {
                // Intersections get a gold dot; every other cell centre a tiny heart.
                dots.addEllipse(in: CGRect(x: x - 1.1 * k, y: y - 1.1 * k, width: 2.2 * k, height: 2.2 * k))
                if (row + column).isMultiple(of: 2) {
                    let s = 4.6 * k
                    hearts.addPath(FormalLetterHeart().path(in: CGRect(x: x + step - s / 2, y: y - s * 0.45, width: s, height: s * 0.9)))
                }
                x += step * 2
                column += 1
            }
            y += step
            row += 1
        }
        c.fill(dots, with: .color(FormalLetterPalette.linerGold.opacity(0.7)))
        c.fill(hearts, with: .color(FormalLetterPalette.linerHeart.opacity(0.62)))
    }
}

// MARK: - The wax seal

/// Claret sealing wax pressed with a script K inside a beaded ring. It sits over the tip of the
/// flap, so when the flap lifts it breaks along the flap's edge: the `upper` piece rides away on
/// the flap and the `lower` one stays on the envelope.
struct FormalLetterWaxSeal: View, Equatable {
    enum Piece: Equatable { case whole, upper, lower }
    let diameter: CGFloat
    let piece: Piece

    static func frameSize(_ diameter: CGFloat) -> CGFloat { (diameter * 1.3).rounded(.up) }

    /// The wax's outline: round, with the soft irregular spread of poured wax.
    static func blob(center: CGPoint, radius r: CGFloat) -> Path {
        var p = Path()
        let n = 72
        for i in 0...n {
            let a = Double(i) / Double(n) * 2 * Double.pi
            let wobble = 1 + 0.032 * sin(5 * a + 1.1) + 0.022 * sin(9 * a + 2.3) + 0.016 * sin(14 * a + 0.4) + 0.01 * sin(23 * a)
            let point = CGPoint(x: center.x + r * CGFloat(cos(a) * wobble), y: center.y + r * CGFloat(sin(a) * wobble))
            if i == 0 { p.move(to: point) } else { p.addLine(to: point) }
        }
        p.closeSubpath()
        return p
    }

    /// The break runs from the rim on the left round to the rim at the bottom, so all that stays on
    /// the envelope is a small chip of wax (where it held the pocket); the rest lifts with the flap.
    func crackPoints(center: CGPoint, radius r: CGFloat) -> [CGPoint] {
        let a = CGPoint(x: center.x + r * 1.15 * CGFloat(cos(2.88)), y: center.y + r * 1.15 * CGFloat(sin(2.88)))   // left, a little low
        let b = CGPoint(x: center.x + r * 1.15 * CGFloat(cos(1.31)), y: center.y + r * 1.15 * CGFloat(sin(1.31)))   // bottom, a little right
        let bow = CGPoint(x: center.x - r * 0.3, y: center.y + r * 0.42)
        var points: [CGPoint] = []
        let steps = 16
        for i in 0...steps {
            let u = CGFloat(i) / CGFloat(steps)
            let v = 1 - u
            var p = CGPoint(x: v * v * a.x + 2 * v * u * bow.x + u * u * b.x, y: v * v * a.y + 2 * v * u * bow.y + u * u * b.y)
            if i > 0 && i < steps {
                let jag = r * 0.06 * CGFloat(sin(Double(i) * 2.6 + 0.5)) * (i.isMultiple(of: 2) ? 1 : -0.75)
                p.x += jag * 0.7
                p.y += jag
            }
            points.append(p)
        }
        return points
    }

    /// The chip's side of the break (lower left).
    private func chip(_ points: [CGPoint], center: CGPoint, radius r: CGFloat) -> Path {
        // Out from each end of the break, away from the centre, and round the lower left.
        func outward(_ q: CGPoint) -> CGPoint { CGPoint(x: q.x + (q.x - center.x) * 3, y: q.y + (q.y - center.y) * 3) }
        var p = Path()
        p.addLines(points)
        p.addLine(to: outward(points.last!))
        p.addLine(to: CGPoint(x: center.x - r * 4, y: center.y + r * 4))
        p.addLine(to: outward(points.first!))
        p.closeSubpath()
        return p
    }

    var body: some View {
        let size = Self.frameSize(diameter)
        return Canvas { ctx, _ in
            let center = CGPoint(x: size / 2, y: size / 2)
            let r = diameter / 2
            let points = crackPoints(center: center, radius: r)
            var c = ctx
            let chipSide = chip(points, center: center, radius: r)
            switch piece {
            case .whole: break
            case .upper:
                var rest = Path(CGRect(x: 0, y: 0, width: size, height: size))
                rest.addPath(chipSide)
                c.clip(to: rest, style: FillStyle(eoFill: true))
            case .lower: c.clip(to: chipSide)
            }
            Self.drawWax(c, center: center, radius: r)
            if piece != .whole {
                // The fresh break: a dark fracture with a pale crumbly lip.
                var crack = Path()
                crack.addLines(points)
                c.stroke(crack, with: .color(FormalLetterPalette.waxShadow), style: StrokeStyle(lineWidth: 1.1, lineCap: .round, lineJoin: .round))
                var lip = c
                lip.translateBy(x: piece == .upper ? 0.6 : -0.6, y: piece == .upper ? -0.8 : 0.8)
                lip.stroke(crack, with: .color(FormalLetterPalette.waxLight.opacity(0.7)), style: StrokeStyle(lineWidth: 0.6, lineCap: .round, lineJoin: .round))
            }
        }
        .frame(width: size, height: size)
    }

    static func drawWax(_ ctx: GraphicsContext, center: CGPoint, radius r: CGFloat) {
        let blob = Self.blob(center: center, radius: r)
        // Its shadow on the paper: wax is thick.
        var shadow = ctx
        shadow.addFilter(.blur(radius: r * 0.08))
        shadow.fill(Self.blob(center: CGPoint(x: center.x + r * 0.03, y: center.y + r * 0.09), radius: r * 1.01),
                    with: .color(FormalLetterPalette.waxShadow.opacity(0.45)))
        // The wax: lit from the top left.
        ctx.fill(blob, with: .linearGradient(Gradient(colors: [FormalLetterPalette.waxLight, FormalLetterPalette.wax]),
                                             startPoint: CGPoint(x: center.x - r, y: center.y - r), endPoint: CGPoint(x: center.x, y: center.y + r * 0.2)))
        ctx.fill(blob, with: .linearGradient(Gradient(colors: [FormalLetterPalette.waxDeep.opacity(0), FormalLetterPalette.waxDeep.opacity(0.85)]),
                                             startPoint: CGPoint(x: center.x, y: center.y), endPoint: CGPoint(x: center.x + r * 0.8, y: center.y + r)))
        // The stamp's impression: a shallow round well (shaded at its top left, lit at its bottom right).
        let well = Path(ellipseIn: CGRect(x: center.x - r * 0.74, y: center.y - r * 0.74, width: r * 1.48, height: r * 1.48))
        ctx.fill(well, with: .linearGradient(Gradient(colors: [FormalLetterPalette.waxDeep, FormalLetterPalette.wax]),
                                             startPoint: CGPoint(x: center.x - r * 0.6, y: center.y - r * 0.6), endPoint: CGPoint(x: center.x + r * 0.5, y: center.y + r * 0.6)))
        ctx.stroke(Path(ellipseIn: CGRect(x: center.x - r * 0.74, y: center.y - r * 0.74, width: r * 1.48, height: r * 1.48)),
                   with: .linearGradient(Gradient(colors: [FormalLetterPalette.waxShadow.opacity(0.9), FormalLetterPalette.waxLight.opacity(0.9)]),
                                         startPoint: CGPoint(x: center.x - r * 0.5, y: center.y - r * 0.7), endPoint: CGPoint(x: center.x + r * 0.5, y: center.y + r * 0.7)),
                   lineWidth: r * 0.05)
        // A beaded ring.
        var beads = Path()
        var lights = Path()
        let count = 26
        for i in 0..<count {
            let a = Double(i) / Double(count) * 2 * Double.pi
            let p = CGPoint(x: center.x + r * 0.62 * CGFloat(cos(a)), y: center.y + r * 0.62 * CGFloat(sin(a)))
            let b = r * 0.045
            beads.addEllipse(in: CGRect(x: p.x - b, y: p.y - b, width: 2 * b, height: 2 * b))
            lights.addEllipse(in: CGRect(x: p.x - b * 0.9, y: p.y - b * 1.1, width: b * 1.1, height: b * 1.1))
        }
        ctx.fill(beads, with: .color(FormalLetterPalette.waxShadow.opacity(0.55)))
        ctx.fill(lights, with: .color(FormalLetterPalette.waxLight.opacity(0.9)))
        // The K, standing up in relief: shade below right, light above left.
        let font = FormalLetterFonts.font(.script, size: r * 1.25)
        let anchor = CGPoint(x: center.x + r * 0.03, y: center.y + r * 0.1)
        let dark = ctx.resolve(Text("K").font(font).foregroundColor(FormalLetterPalette.waxShadow.opacity(0.85)))
        let light = ctx.resolve(Text("K").font(font).foregroundColor(FormalLetterPalette.waxLight))
        let face = ctx.resolve(Text("K").font(font).foregroundColor(FormalLetterPalette.wax))
        ctx.draw(dark, at: CGPoint(x: anchor.x + r * 0.035, y: anchor.y + r * 0.045), anchor: .center)
        ctx.draw(light, at: CGPoint(x: anchor.x - r * 0.03, y: anchor.y - r * 0.035), anchor: .center)
        ctx.draw(face, at: anchor, anchor: .center)
        // Gloss: a soft crescent of light on the rim's top left.
        var gloss = Path()
        gloss.addArc(center: center, radius: r * 0.86, startAngle: .degrees(196), endAngle: .degrees(258), clockwise: false)
        ctx.stroke(gloss, with: .color(Color.white.opacity(0.42)), style: StrokeStyle(lineWidth: r * 0.07, lineCap: .round))
        var spark = Path()
        spark.addArc(center: center, radius: r * 0.86, startAngle: .degrees(214), endAngle: .degrees(226), clockwise: false)
        ctx.stroke(spark, with: .color(Color.white.opacity(0.55)), style: StrokeStyle(lineWidth: r * 0.09, lineCap: .round))
    }
}

/// A slow band of light passing over the wax (the seal's idle glint). `u` runs 0 → 1 across it.
struct FormalLetterSealGlint: View {
    let diameter: CGFloat
    let u: Double

    var body: some View {
        let size = FormalLetterWaxSeal.frameSize(diameter)
        return Canvas { ctx, _ in
            let center = CGPoint(x: size / 2, y: size / 2)
            let r = diameter / 2
            var c = ctx
            c.clip(to: FormalLetterWaxSeal.blob(center: center, radius: r))
            let travel = CGFloat(-1.5 + 3.0 * u) * r
            let band = r * 0.22
            let axis = CGPoint(x: 0.7071, y: 0.7071)
            let across = CGPoint(x: -axis.y, y: axis.x)
            let mid = CGPoint(x: center.x + axis.x * travel, y: center.y + axis.y * travel)
            let strength = 0.34 * FormalLetterMotion.bump(u)
            // Each half of the band is its own strip, so neither gradient spills past it.
            for side in [-1.0, 1.0] {
                let edge = CGPoint(x: mid.x + axis.x * band * CGFloat(side), y: mid.y + axis.y * band * CGFloat(side))
                let long = r * 3
                var strip = Path()
                strip.move(to: CGPoint(x: mid.x - across.x * long, y: mid.y - across.y * long))
                strip.addLine(to: CGPoint(x: mid.x + across.x * long, y: mid.y + across.y * long))
                strip.addLine(to: CGPoint(x: edge.x + across.x * long, y: edge.y + across.y * long))
                strip.addLine(to: CGPoint(x: edge.x - across.x * long, y: edge.y - across.y * long))
                strip.closeSubpath()
                c.fill(strip, with: .linearGradient(Gradient(colors: [Color.white.opacity(strength), Color.white.opacity(0)]), startPoint: mid, endPoint: edge))
            }
        }
        .frame(width: size, height: size)
        .blendMode(.screen)
        .allowsHitTesting(false)
    }
}

/// A crumb of wax that flies off as the seal breaks.
struct FormalLetterWaxCrumb: View, Equatable {
    let size: CGFloat
    let shape: Int

    var body: some View {
        Canvas { ctx, canvasSize in
            var p = Path()
            let n = 5 + shape % 3
            for i in 0..<n {
                let a = Double(i) / Double(n) * 2 * Double.pi + Double(shape)
                let rr = size / 2 * CGFloat(0.7 + 0.3 * sin(Double(i * 3 + shape)))
                let point = CGPoint(x: canvasSize.width / 2 + rr * CGFloat(cos(a)), y: canvasSize.height / 2 + rr * CGFloat(sin(a)))
                if i == 0 { p.move(to: point) } else { p.addLine(to: point) }
            }
            p.closeSubpath()
            ctx.fill(p, with: .linearGradient(Gradient(colors: [FormalLetterPalette.waxLight, FormalLetterPalette.waxDeep]),
                                              startPoint: .zero, endPoint: CGPoint(x: canvasSize.width, y: canvasSize.height)))
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Pressed flowers

/// The pressed flowers' colours. On the night-plum envelope they're paler and glow softly instead
/// of casting a shadow.
struct FormalLetterFloraTone: Equatable {
    let stem: Color
    let leafLight: Color
    let leafDeep: Color
    let lavenderLight: Color
    let lavenderDeep: Color
    let lavenderPale: Color
    let blushLight: Color
    let blushDeep: Color
    let lilacLight: Color
    let lilacDeep: Color
    let heartLight: Color
    let heartDeep: Color
    let breath: Color
    let breathEdge: Color
    let shadow: Color
    let shadowRadius: CGFloat
    let shadowOffset: CGSize

    typealias P = FormalLetterPalette
    static let day = FormalLetterFloraTone(
        stem: P.rgb(0x8a9a7c), leafLight: P.rgb(0xa9bb9a), leafDeep: P.rgb(0x7c9070),
        lavenderLight: P.rgb(0xb294d6), lavenderDeep: P.rgb(0x7d5ba6), lavenderPale: P.rgb(0xc9b0e6),
        blushLight: P.rgb(0xfbe0ea), blushDeep: P.rgb(0xe8a3bd), lilacLight: P.rgb(0xf0e6fa), lilacDeep: P.rgb(0xc0a5e0),
        heartLight: P.rgb(0xf6dc96), heartDeep: P.rgb(0xd6a744),
        breath: P.rgb(0xfffdf8), breathEdge: P.rgb(0xd9c9b6),
        shadow: P.plum.opacity(0.22), shadowRadius: 1.1, shadowOffset: CGSize(width: 0.5, height: 1))
    static let night = FormalLetterFloraTone(
        stem: P.rgb(0xb7c6a6), leafLight: P.rgb(0xd0ddc2), leafDeep: P.rgb(0xa3b693),
        lavenderLight: P.rgb(0xdcc8f4), lavenderDeep: P.rgb(0xb193d8), lavenderPale: P.rgb(0xece0fb),
        blushLight: P.rgb(0xfff0f5), blushDeep: P.rgb(0xf4bfd2), lilacLight: P.rgb(0xfaf5ff), lilacDeep: P.rgb(0xdccbf2),
        heartLight: P.rgb(0xfbe8b4), heartDeep: P.rgb(0xe8c068),
        breath: P.rgb(0xfffefa), breathEdge: P.rgb(0xf2e8da),
        shadow: Color.white.opacity(0.2), shadowRadius: 2.4, shadowOffset: .zero)
}

/// Pressed flowers drawn as paths: lavender, five-petal blossoms, baby's breath, leaf sprigs and buds.
/// Every function draws in the context it's given, from an origin, at an angle (degrees, 0 = right,
/// negative = up), at the size given.
enum FormalLetterFlora {
    typealias Tone = FormalLetterFloraTone

    static func polar(_ origin: CGPoint, _ angle: Double, _ distance: CGFloat) -> CGPoint {
        let a = angle * Double.pi / 180
        return CGPoint(x: origin.x + distance * CGFloat(cos(a)), y: origin.y + distance * CGFloat(sin(a)))
    }

    /// A fine stem with a gentle bend; returns where it ends.
    @discardableResult
    static func stem(_ c: GraphicsContext, from: CGPoint, angle: Double, length: CGFloat, bend: CGFloat = 0.06, width: CGFloat = 0.8, tone: Tone) -> CGPoint {
        let end = polar(from, angle, length)
        let mid = polar(from, angle, length * 0.5)
        let normal = polar(.zero, angle + 90, length * bend)
        var path = Path()
        path.move(to: from)
        path.addQuadCurve(to: end, control: CGPoint(x: mid.x + normal.x, y: mid.y + normal.y))
        c.stroke(path, with: .color(tone.stem), style: StrokeStyle(lineWidth: width, lineCap: .round))
        return end
    }

    static func leaf(_ c: GraphicsContext, base: CGPoint, angle: Double, length: CGFloat, width: CGFloat, tone: Tone) {
        var l = c
        l.translateBy(x: base.x, y: base.y)
        l.rotate(by: .degrees(angle))
        var path = Path()
        path.move(to: .zero)
        path.addQuadCurve(to: CGPoint(x: length, y: 0), control: CGPoint(x: length * 0.45, y: -width))
        path.addQuadCurve(to: .zero, control: CGPoint(x: length * 0.55, y: width * 0.9))
        l.fill(path, with: .linearGradient(Gradient(colors: [tone.leafLight, tone.leafDeep]),
                                           startPoint: CGPoint(x: 0, y: -width), endPoint: CGPoint(x: length, y: width)))
        var vein = Path()
        vein.move(to: CGPoint(x: length * 0.08, y: 0))
        vein.addLine(to: CGPoint(x: length * 0.8, y: 0))
        l.stroke(vein, with: .color(tone.leafDeep.opacity(0.55)), lineWidth: 0.35)
    }

    /// Lavender: a fine stem and, along its top half, little whorls of separate buds (a pair either
    /// side and one between), getting smaller and paler towards the tip.
    static func lavender(_ c: GraphicsContext, from: CGPoint, angle: Double, length L: CGFloat, tone: Tone) {
        var l = c
        l.translateBy(x: from.x, y: from.y)
        l.rotate(by: .degrees(angle))
        var stem = Path()
        stem.move(to: .zero)
        stem.addQuadCurve(to: CGPoint(x: L * 0.97, y: -L * 0.02), control: CGPoint(x: L * 0.45, y: L * 0.03))
        l.stroke(stem, with: .color(tone.stem), style: StrokeStyle(lineWidth: max(0.75, L * 0.012), lineCap: .round))
        let whorls = max(6, Int(L / 8.5))
        let spacing = L * 0.5 / CGFloat(whorls)
        for i in 0..<whorls {
            let u = CGFloat(i) / CGFloat(whorls - 1)
            let x = L * 0.5 + L * 0.47 * u
            let y = -L * 0.02 * (0.5 + 0.5 * u) * (0.5 + 0.5 * u)
            let size = L * (0.05 - 0.02 * u)
            let deep = i < whorls / 3 ? tone.lavenderDeep : tone.lavenderLight
            let light = i < whorls / 3 ? tone.lavenderLight : tone.lavenderPale
            let buds: [(dx: CGFloat, dy: CGFloat, turn: Double, scale: CGFloat)] = [
                (0, -0.62, -38, 1), (0.15, 0.62, 38, 1), (0.5 * spacing / size, 0, 0, 0.78),
            ]
            for bud in buds where !(i == whorls - 1 && bud.turn == 0) {
                var b = l
                b.translateBy(x: x + bud.dx * size, y: y + bud.dy * size)
                b.rotate(by: .degrees(bud.turn))
                let w = size * 1.05 * bud.scale, h = size * 0.62 * bud.scale
                let rect = CGRect(x: -w / 2, y: -h / 2, width: w, height: h)
                b.fill(Path(ellipseIn: rect), with: .linearGradient(Gradient(colors: [light, deep]),
                                                                    startPoint: CGPoint(x: 0, y: rect.minY), endPoint: CGPoint(x: 0, y: rect.maxY)))
            }
        }
    }

    /// A five-petal blossom, pressed flat: rounded petals with a faint vein each and a gold heart.
    static func blossom(_ c: GraphicsContext, at center: CGPoint, radius r: CGFloat, rotation: Double, light: Color, deep: Color, tone: Tone) {
        var b = c
        b.translateBy(x: center.x, y: center.y)
        b.rotate(by: .degrees(rotation))
        for i in 0..<5 {
            var p = b
            p.rotate(by: .degrees(Double(i) * 72))
            var petal = Path()
            petal.move(to: CGPoint(x: r * 0.1, y: 0))
            petal.addCurve(to: CGPoint(x: r * 0.98, y: -r * 0.08),
                           control1: CGPoint(x: r * 0.3, y: -r * 0.5), control2: CGPoint(x: r * 0.95, y: -r * 0.52))
            // A little notch at the tip.
            petal.addQuadCurve(to: CGPoint(x: r * 0.98, y: r * 0.08), control: CGPoint(x: r * 0.86, y: 0))
            petal.addCurve(to: CGPoint(x: r * 0.1, y: 0),
                           control1: CGPoint(x: r * 0.95, y: r * 0.52), control2: CGPoint(x: r * 0.3, y: r * 0.5))
            p.fill(petal, with: .linearGradient(Gradient(colors: [deep, light]), startPoint: .zero, endPoint: CGPoint(x: r, y: 0)))
            p.stroke(petal, with: .color(deep.opacity(0.55)), lineWidth: 0.3)
            var vein = Path()
            vein.move(to: CGPoint(x: r * 0.25, y: 0))
            vein.addLine(to: CGPoint(x: r * 0.62, y: 0))
            p.stroke(vein, with: .color(deep.opacity(0.6)), lineWidth: 0.35)
        }
        let heart = r * 0.24
        b.fill(Path(ellipseIn: CGRect(x: -heart, y: -heart, width: heart * 2, height: heart * 2)),
               with: .linearGradient(Gradient(colors: [tone.heartLight, tone.heartDeep]),
                                     startPoint: CGPoint(x: -heart, y: -heart), endPoint: CGPoint(x: heart, y: heart)))
        for i in 0..<5 {
            let dot = polar(.zero, Double(i) * 72 + 36, heart * 1.25)
            b.fill(Path(ellipseIn: CGRect(x: dot.x - r * 0.045, y: dot.y - r * 0.045, width: r * 0.09, height: r * 0.09)),
                   with: .color(tone.heartDeep))
        }
    }

    /// Baby's breath: a fine branching stem ending in clusters of tiny white florets.
    static func babysBreath(_ c: GraphicsContext, from: CGPoint, angle: Double, length L: CGFloat, clusters: Int, k: CGFloat, tone: Tone) {
        let end = stem(c, from: from, angle: angle, length: L, bend: 0.04, width: 0.6, tone: tone)
        var tips: [CGPoint] = [end]
        for i in 0..<max(0, clusters - 1) {
            let u = 0.45 + 0.45 * CGFloat(i) / CGFloat(max(1, clusters - 1))
            let base = polar(from, angle, L * u)
            let side: Double = i.isMultiple(of: 2) ? -1 : 1
            tips.append(stem(c, from: base, angle: angle + side * (34 + Double(i % 3) * 6), length: L * (0.2 + 0.05 * CGFloat(i % 2)),
                             bend: 0.05, width: 0.5, tone: tone))
        }
        for (index, tip) in tips.enumerated() {
            let florets: [(CGFloat, CGFloat, CGFloat)] = [(0, 0, 1.35), (1.9, -1.2, 1.05), (-1.6, -1.6, 1.0), (0.6, 2.0, 0.9)]
            for (n, f) in florets.enumerated() where n < 3 + index % 2 {
                let rr = f.2 * k
                let rect = CGRect(x: tip.x + f.0 * k - rr, y: tip.y + f.1 * k - rr, width: rr * 2, height: rr * 2)
                c.fill(Path(ellipseIn: rect), with: .color(tone.breath))
                c.stroke(Path(ellipseIn: rect), with: .color(tone.breathEdge), lineWidth: 0.35)
            }
        }
    }

    /// Olive-leaf sprig: a stem with slim leaves alternating along it, smaller towards the tip.
    static func leafSprig(_ c: GraphicsContext, from: CGPoint, angle: Double, length L: CGFloat, leaves: Int, k: CGFloat, tone: Tone) {
        stem(c, from: from, angle: angle, length: L, bend: 0.05, width: 0.75, tone: tone)
        for i in 0..<leaves {
            let u = 0.3 + 0.62 * CGFloat(i) / CGFloat(max(1, leaves - 1))
            let base = polar(from, angle, L * u)
            let side: Double = i.isMultiple(of: 2) ? -1 : 1
            let size = 1 - 0.35 * u
            leaf(c, base: base, angle: angle + side * 38, length: 13 * k * size, width: 3.2 * k * size, tone: tone)
        }
        leaf(c, base: polar(from, angle, L * 0.98), angle: angle, length: 9 * k, width: 2.4 * k, tone: tone)
    }
}

/// A spray of pressed flowers, for the envelope (tucked under the wax, or a small echo of it) and
/// for the letter's corner. `binding` is where the stems meet, at the centre of the frame.
struct FormalLetterSpray: View, Equatable {
    enum Arrangement: Equatable { case seal, echo, corner }
    let arrangement: Arrangement
    let k: CGFloat
    var night = false

    static func frame(_ arrangement: Arrangement, k: CGFloat) -> CGSize {
        switch arrangement {
        case .seal: return CGSize(width: 250 * k, height: 230 * k)
        case .echo: return CGSize(width: 120 * k, height: 110 * k)
        case .corner: return CGSize(width: 90 * k, height: 90 * k)
        }
    }

    var body: some View {
        let size = Self.frame(arrangement, k: k)
        let tone: FormalLetterFloraTone = night ? .night : .day
        return Canvas { ctx, _ in
            var c = ctx
            c.translateBy(x: size.width / 2, y: size.height / 2)
            c.addFilter(.shadow(color: tone.shadow, radius: tone.shadowRadius, x: tone.shadowOffset.width, y: tone.shadowOffset.height))
            c.drawLayer { layer in
                switch arrangement {
                case .seal: Self.seal(layer, k: k, tone: tone)
                case .echo: Self.echo(layer, k: k, tone: tone)
                case .corner: Self.corner(layer, k: k, tone: tone)
                }
            }
        }
        .frame(width: size.width, height: size.height)
        .allowsHitTesting(false)
    }

    typealias F = FormalLetterFlora

    /// Under the wax: cut stems peek out down to the left; the flowers fan up to the right.
    nonisolated static func seal(_ c: GraphicsContext, k: CGFloat, tone: FormalLetterFloraTone) {
        let o = CGPoint.zero
        for (angle, length) in [(156.0, 30.0), (166.0, 25.0), (174.0, 28.0)] {
            F.stem(c, from: o, angle: angle, length: length * k, bend: 0.03, width: 0.85, tone: tone)
        }
        F.leaf(c, base: F.polar(o, 26, 30 * k), angle: 30, length: 13 * k, width: 3 * k, tone: tone)
        F.leafSprig(c, from: o, angle: -3, length: 66 * k, leaves: 5, k: k, tone: tone)
        F.babysBreath(c, from: o, angle: 14, length: 52 * k, clusters: 3, k: k, tone: tone)
        F.lavender(c, from: o, angle: -52, length: 72 * k, tone: tone)
        F.babysBreath(c, from: o, angle: -40, length: 82 * k, clusters: 5, k: k, tone: tone)
        F.lavender(c, from: o, angle: -36, length: 84 * k, tone: tone)
        F.lavender(c, from: o, angle: -22, length: 98 * k, tone: tone)
        F.leaf(c, base: F.polar(o, -74, 22 * k), angle: -70, length: 15 * k, width: 3.4 * k, tone: tone)
        F.blossom(c, at: F.polar(o, 4, 60 * k), radius: 5 * k, rotation: 40, light: tone.blushLight, deep: tone.blushDeep, tone: tone)
        F.blossom(c, at: F.polar(o, -62, 48 * k), radius: 5.8 * k, rotation: 12, light: tone.lilacLight, deep: tone.lilacDeep, tone: tone)
        F.blossom(c, at: F.polar(o, -12, 44 * k), radius: 6.8 * k, rotation: 30, light: tone.lilacLight, deep: tone.lilacDeep, tone: tone)
        F.blossom(c, at: F.polar(o, -33, 56 * k), radius: 8.4 * k, rotation: -8, light: tone.blushLight, deep: tone.blushDeep, tone: tone)
    }

    /// A small echo of the spray, for a corner of the envelope.
    nonisolated static func echo(_ c: GraphicsContext, k: CGFloat, tone: FormalLetterFloraTone) {
        let o = CGPoint.zero
        F.leafSprig(c, from: o, angle: -152, length: 36 * k, leaves: 3, k: k * 0.8, tone: tone)
        F.lavender(c, from: o, angle: -116, length: 50 * k, tone: tone)
        F.babysBreath(c, from: o, angle: -136, length: 42 * k, clusters: 3, k: k, tone: tone)
        F.leaf(c, base: F.polar(o, -100, 14 * k), angle: -96, length: 11 * k, width: 2.6 * k, tone: tone)
        F.blossom(c, at: F.polar(o, -112, 31 * k), radius: 4.4 * k, rotation: 0, light: tone.lilacLight, deep: tone.lilacDeep, tone: tone)
        F.blossom(c, at: F.polar(o, -138, 23 * k), radius: 5.6 * k, rotation: 20, light: tone.blushLight, deep: tone.blushDeep, tone: tone)
    }

    /// The letter's corner: a blossom, a sprig of baby's breath, a little lavender and a leaf, all
    /// rising up and to the left from stems that run down to the right (where the tape holds them).
    nonisolated static func corner(_ c: GraphicsContext, k: CGFloat, tone: FormalLetterFloraTone) {
        let o = CGPoint.zero
        for (angle, length) in [(48.0, 11.0), (56.0, 9.5)] {
            F.stem(c, from: o, angle: angle, length: length * k, bend: 0.03, width: 0.7, tone: tone)
        }
        F.leaf(c, base: F.polar(o, -150, 6 * k), angle: -168, length: 13 * k, width: 3 * k, tone: tone)
        F.lavender(c, from: o, angle: -102, length: 30 * k, tone: tone)
        F.babysBreath(c, from: o, angle: -80, length: 26 * k, clusters: 3, k: k * 0.9, tone: tone)
        F.stem(c, from: o, angle: -132, length: 17 * k, bend: 0.05, width: 0.75, tone: tone)
        F.blossom(c, at: F.polar(o, -132, 18 * k), radius: 7 * k, rotation: 14, light: tone.blushLight, deep: tone.blushDeep, tone: tone)
    }
}

// MARK: - Little touches on the letter

enum FormalLetterTouches {
    typealias P = FormalLetterPalette

    /// The signature's red heart (drawn, so it can beat): glossy like the ❤️ beside it in the app.
    static func heart(_ ctx: GraphicsContext, in rect: CGRect) {
        let shape = FormalLetterHeart().path(in: rect)
        ctx.fill(shape, with: .linearGradient(Gradient(colors: [P.rgb(0xf35d74), P.rgb(0xcb1f3d)]),
                                              startPoint: CGPoint(x: rect.minX, y: rect.minY), endPoint: CGPoint(x: rect.maxX, y: rect.maxY)))
        var gloss = Path()
        gloss.addEllipse(in: CGRect(x: rect.minX + rect.width * 0.18, y: rect.minY + rect.height * 0.16,
                                    width: rect.width * 0.22, height: rect.height * 0.16))
        ctx.fill(gloss, with: .color(Color.white.opacity(0.55)))
    }

    /// A little paw print, stamped in soft ink: a pad and four toe beans.
    static func paw(_ ctx: GraphicsContext, center: CGPoint, size s: CGFloat, angle: Double, color: Color) {
        var c = ctx
        c.translateBy(x: center.x, y: center.y)
        c.rotate(by: .degrees(angle))
        var pad = Path()
        pad.move(to: CGPoint(x: -0.42 * s, y: 0.28 * s))
        pad.addCurve(to: CGPoint(x: 0.42 * s, y: 0.28 * s), control1: CGPoint(x: -0.5 * s, y: -0.22 * s), control2: CGPoint(x: 0.5 * s, y: -0.22 * s))
        pad.addQuadCurve(to: CGPoint(x: -0.42 * s, y: 0.28 * s), control: CGPoint(x: 0, y: 0.52 * s))
        c.fill(pad, with: .color(color))
        for (x, y, r) in [(-0.44, -0.3, 0.13), (-0.16, -0.5, 0.14), (0.16, -0.5, 0.14), (0.44, -0.3, 0.13)] as [(CGFloat, CGFloat, CGFloat)] {
            c.fill(Path(ellipseIn: CGRect(x: (x - r) * s, y: (y - r * 1.15) * s, width: 2 * r * s, height: 2.3 * r * s)), with: .color(color))
        }
    }

    /// A sprig of rosemary, for the apothecary: a fine stem with slim needle leaves along it.
    static func herb(_ ctx: GraphicsContext, from: CGPoint, angle: Double, length L: CGFloat) {
        let tone = FormalLetterFloraTone.day
        var c = ctx
        c.translateBy(x: from.x, y: from.y)
        c.rotate(by: .degrees(angle))
        var stem = Path()
        stem.move(to: .zero)
        stem.addQuadCurve(to: CGPoint(x: L, y: 0), control: CGPoint(x: L * 0.5, y: -L * 0.05))
        c.stroke(stem, with: .color(tone.stem), style: StrokeStyle(lineWidth: 0.8, lineCap: .round))
        let count = 9
        for i in 0..<count {
            let u = 0.18 + 0.8 * CGFloat(i) / CGFloat(count - 1)
            let side: Double = i.isMultiple(of: 2) ? -1 : 1
            let length = L * (0.2 - 0.08 * u)
            var leaf = c
            leaf.translateBy(x: L * u, y: -L * 0.05 * 4 * u * (1 - u))
            leaf.rotate(by: .degrees(side * 48))
            leaf.fill(Path(ellipseIn: CGRect(x: 0, y: -length * 0.13, width: length, height: length * 0.26)),
                      with: .linearGradient(Gradient(colors: [tone.leafLight, tone.leafDeep]),
                                            startPoint: .zero, endPoint: CGPoint(x: length, y: 0)))
        }
        // Two tiny pale-blue rosemary flowers.
        for (u, side) in [(0.5, -1.0), (0.78, 1.0)] as [(CGFloat, CGFloat)] {
            let p = CGPoint(x: L * u, y: side * L * 0.09 - L * 0.05 * 4 * u * (1 - u))
            c.fill(Path(ellipseIn: CGRect(x: p.x - L * 0.035, y: p.y - L * 0.03, width: L * 0.07, height: L * 0.06)),
                   with: .color(P.rgb(0xb9c4ea)))
        }
    }

    /// A short strip of washi tape: translucent lilac, fine white stripes, torn ends.
    static func tape(_ ctx: GraphicsContext, center: CGPoint, length: CGFloat, width: CGFloat, angle: Double) {
        var c = ctx
        c.translateBy(x: center.x, y: center.y)
        c.rotate(by: .degrees(angle))
        let half = length / 2, h = width / 2
        var strip = Path()
        let teeth = 4
        strip.move(to: CGPoint(x: -half, y: -h))
        strip.addLine(to: CGPoint(x: half, y: -h))
        for i in 0..<teeth {
            let y0 = -h + width * CGFloat(i) / CGFloat(teeth)
            strip.addLine(to: CGPoint(x: half - (i.isMultiple(of: 2) ? 1.2 : 0), y: y0 + width / CGFloat(teeth) * 0.5))
            strip.addLine(to: CGPoint(x: half, y: y0 + width / CGFloat(teeth)))
        }
        strip.addLine(to: CGPoint(x: -half, y: h))
        for i in (0..<teeth).reversed() {
            let y0 = -h + width * CGFloat(i) / CGFloat(teeth)
            strip.addLine(to: CGPoint(x: -half + (i.isMultiple(of: 2) ? 0 : 1.2), y: y0 + width / CGFloat(teeth) * 0.5))
            strip.addLine(to: CGPoint(x: -half, y: y0))
        }
        strip.closeSubpath()
        c.fill(strip, with: .color(P.rgb(0xdcc9ef, 0.72)))
        var lines = c
        lines.clip(to: strip)
        var stripes = Path()
        var x = -half - width
        while x < half + width {
            stripes.move(to: CGPoint(x: x, y: h))
            stripes.addLine(to: CGPoint(x: x + width, y: -h))
            x += 3.2
        }
        lines.stroke(stripes, with: .color(Color.white.opacity(0.45)), lineWidth: 0.7)
        c.fill(Path(CGRect(x: -half, y: -h, width: length, height: 0.8)), with: .color(Color.white.opacity(0.35)))
    }

    /// A pressed flower taped into the letter's corner (right of the crest, above the words).
    static func corner(_ ctx: GraphicsContext, at binding: CGPoint) {
        var c = ctx
        c.translateBy(x: binding.x, y: binding.y)
        c.addFilter(.shadow(color: P.plum.opacity(0.18), radius: 0.9, x: 0.4, y: 0.8))
        c.drawLayer { layer in FormalLetterSpray.corner(layer, k: 1, tone: .day) }
        // The tape across the stems, just below where they meet.
        tape(ctx, center: CGPoint(x: binding.x + 3, y: binding.y + 3.5), length: 24, width: 8, angle: -40)
    }
}

/// A petal drifting out of the letter as it unfolds.
struct FormalLetterPetal: View, Equatable {
    let size: CGFloat
    let lilac: Bool

    var body: some View {
        Canvas { ctx, _ in
            let tone = FormalLetterFloraTone.day
            let r = size / 2
            var petal = Path()
            petal.move(to: CGPoint(x: 0, y: r))
            petal.addCurve(to: CGPoint(x: size * 0.98, y: r * 0.92), control1: CGPoint(x: size * 0.3, y: 0), control2: CGPoint(x: size * 0.95, y: r * 0.1))
            petal.addQuadCurve(to: CGPoint(x: size * 0.98, y: r * 1.08), control: CGPoint(x: size * 0.86, y: r))
            petal.addCurve(to: CGPoint(x: 0, y: r), control1: CGPoint(x: size * 0.95, y: size * 0.95), control2: CGPoint(x: size * 0.3, y: size))
            let light = lilac ? tone.lilacLight : tone.blushLight, deep = lilac ? tone.lilacDeep : tone.blushDeep
            ctx.fill(petal, with: .linearGradient(Gradient(colors: [deep, light]), startPoint: CGPoint(x: 0, y: r), endPoint: CGPoint(x: size, y: r)))
            ctx.stroke(petal, with: .color(deep.opacity(0.5)), lineWidth: 0.3)
        }
        .frame(width: size, height: size)
        .allowsHitTesting(false)
    }
}
