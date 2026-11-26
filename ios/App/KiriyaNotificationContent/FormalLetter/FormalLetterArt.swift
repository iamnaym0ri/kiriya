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

/// The letterhead: a script K in a gilt double oval, a little laurel round its foot and a heart.
enum FormalLetterCrest {
    enum Look { case printed, embossed }

    static func draw(_ ctx: GraphicsContext, center: CGPoint, height h: CGFloat, look: Look = .printed) {
        let w = h * 0.74
        let oval = CGRect(x: center.x - w / 2, y: center.y - h / 2, width: w, height: h)
        let inner = oval.insetBy(dx: h * 0.06, dy: h * 0.06)
        let leafColor: Color
        let ink: Color
        switch look {
        case .printed:
            leafColor = FormalLetterPalette.gold
            ink = FormalLetterPalette.plum
        case .embossed:
            leafColor = FormalLetterPalette.paperFiber
            ink = FormalLetterPalette.paperFiber
        }

        func drawAll(_ c: GraphicsContext, leaf: Color, ink: Color, heartColor: Color, offset: CGSize) {
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
            let k = c.resolve(Text("K").font(FormalLetterFonts.font(.script, size: h * 0.74)).foregroundColor(ink))
            c.draw(k, at: CGPoint(x: center.x + h * 0.02, y: center.y + h * 0.06), anchor: .center)
        }

        switch look {
        case .printed:
            drawAll(ctx, leaf: leafColor, ink: ink, heartColor: FormalLetterPalette.rose, offset: .zero)
        case .embossed:
            // Blind embossed: no ink, just the paper raised (light above, shade below).
            drawAll(ctx, leaf: Color.white.opacity(0.9), ink: Color.white.opacity(0.9), heartColor: Color.white.opacity(0.9), offset: CGSize(width: -0.6, height: -0.6))
            drawAll(ctx, leaf: FormalLetterPalette.crease.opacity(0.32), ink: FormalLetterPalette.crease.opacity(0.32),
                    heartColor: FormalLetterPalette.crease.opacity(0.32), offset: CGSize(width: 0.6, height: 0.7))
            drawAll(ctx, leaf: FormalLetterPalette.paperBack, ink: FormalLetterPalette.paperBack, heartColor: FormalLetterPalette.paperBack, offset: .zero)
        }
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

/// A sprig of pressed lavender tucked under the wax: buds in little whorls along the top of a fine
/// stem, two slim leaves. Drawn from its cut end (hidden under the seal) up to the right.
struct FormalLetterLavender: View, Equatable {
    let length: CGFloat
    var angle: Double = -24

    static func frame(_ length: CGFloat) -> CGSize { CGSize(width: length * 2.2, height: length * 2.2) }

    var body: some View {
        let size = Self.frame(length)
        return Canvas { ctx, _ in
            var c = ctx
            c.translateBy(x: size.width / 2, y: size.height / 2)
            c.rotate(by: .degrees(angle))
            let L = length
            let stemColor = FormalLetterPalette.rgb(0x8a9a7c)
            // A soft shadow: pressed flowers sit flat but not weightless.
            var shade = c
            shade.addFilter(.blur(radius: 1.2))
            shade.translateBy(x: 0.6, y: 1.2)
            var stem = Path()
            stem.move(to: CGPoint(x: -L * 0.12, y: 0))
            stem.addQuadCurve(to: CGPoint(x: L, y: -L * 0.02), control: CGPoint(x: L * 0.45, y: L * 0.035))
            shade.stroke(stem, with: .color(FormalLetterPalette.plum.opacity(0.16)), lineWidth: 1.6)
            c.stroke(stem, with: .color(stemColor), style: StrokeStyle(lineWidth: max(0.9, L * 0.016), lineCap: .round))
            // Two slim leaves near the seal.
            for (u, side, len) in [(0.2, -1.0, 0.3), (0.3, 1.0, 0.26)] as [(CGFloat, CGFloat, CGFloat)] {
                var leaf = Path()
                let base = CGPoint(x: L * u, y: L * 0.018)
                let tip = CGPoint(x: base.x + L * len, y: base.y + side * L * 0.11)
                leaf.move(to: base)
                leaf.addQuadCurve(to: tip, control: CGPoint(x: base.x + L * len * 0.5, y: base.y + side * L * 0.12))
                leaf.addQuadCurve(to: base, control: CGPoint(x: base.x + L * len * 0.55, y: base.y + side * L * 0.01))
                c.fill(leaf, with: .linearGradient(Gradient(colors: [FormalLetterPalette.rgb(0x9db08f), FormalLetterPalette.rgb(0x7f9373)]),
                                                   startPoint: base, endPoint: tip))
            }
            // The buds: whorls getting smaller towards the tip.
            let whorls = 9
            for i in 0..<whorls {
                let u = 0.48 + 0.52 * CGFloat(i) / CGFloat(whorls - 1)
                let x = L * u
                let y = -L * 0.02 * u * u
                let size = L * (0.085 - 0.045 * CGFloat(i) / CGFloat(whorls - 1))
                for (k, side) in [-1.0, 1.0, 0.0].enumerated() {
                    let bud = CGRect(x: x - size * 0.55, y: y + CGFloat(side) * size * 0.42 - size * 0.32, width: size * 1.1, height: size * 0.64)
                    var b = c
                    b.translateBy(x: bud.midX, y: bud.midY)
                    b.rotate(by: .degrees(Double(side) * 32))
                    let rect = CGRect(x: -bud.width / 2, y: -bud.height / 2, width: bud.width, height: bud.height)
                    let colors = k == 2
                        ? [FormalLetterPalette.rgb(0xc1a6e0), FormalLetterPalette.rgb(0x9a78c2)]
                        : [FormalLetterPalette.rgb(0xa98bcf), FormalLetterPalette.rgb(0x7d5ba6)]
                    b.fill(Path(ellipseIn: rect), with: .linearGradient(Gradient(colors: colors),
                                                                        startPoint: CGPoint(x: 0, y: -rect.height / 2), endPoint: CGPoint(x: 0, y: rect.height / 2)))
                }
            }
        }
        .frame(width: size.width, height: size.height)
        .allowsHitTesting(false)
    }
}
