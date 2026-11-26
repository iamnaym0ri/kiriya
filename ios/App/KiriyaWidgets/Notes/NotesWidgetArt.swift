import SwiftUI

// The little-note widget's art, all drawn in SwiftUI (no images): the lilac desk, a page torn from
// a notepad, washi tape, the note folded shut, a glossy heart, sparkles and Josh's "she opened it"
// stamp. The palette is the notification cards' (KiriyaNotificationContent/Letter: the site's paper,
// lilacs and plum ink), with a lamp-lit night version and a tinted one.

/// How the widget is being shown.
struct NotesWidgetLook: Equatable {
    enum Size: Equatable { case small, medium, large, rectangular }

    var size: Size
    /// The Home Screen's tinted or clear look (accented), StandBy at night, the Lock Screen (vibrant):
    /// the system keeps only each colour's opacity, so the art switches to outlines and washes.
    var tinted: Bool = false
    var dark: Bool = false
    /// False where the system takes the background away (StandBy, a clear/tinted Home Screen).
    var background: Bool = true
    /// The widget's size in points.
    var canvas: CGSize

    /// iPhone 11 sizes (Josh's and her phone), for previews and the lab.
    static func iPhone11(_ size: Size) -> CGSize {
        switch size {
        case .small: return CGSize(width: 169, height: 169)
        case .medium: return CGSize(width: 360, height: 169)
        case .large: return CGSize(width: 360, height: 376)
        case .rectangular: return CGSize(width: 160, height: 72)
        }
    }
}

// MARK: - Colours

struct NotesWidgetPalette {
    static func rgb(_ hex: UInt32, _ alpha: Double = 1) -> Color {
        Color(.sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255,
              blue: Double(hex & 0xff) / 255, opacity: alpha)
    }

    var paper: Color
    var paperShade: Color
    var paperBack: Color
    var paperEdge: Color
    var fibre: Color
    var rule: Color
    var margin: Color
    var ink: Color
    var title: Color
    var soft: Color
    var wave: Color
    var heart: Color
    var heartDeep: Color
    var gloss: Color
    var shadow: Color
    var flap: Color
    var flapShade: Color
    var stamp: Color
    var sparkle: Color
    /// Words written straight on the desk (outside the paper).
    var deskInk: Color
    var deskSoft: Color
    var tinted: Bool

    static func make(_ look: NotesWidgetLook) -> NotesWidgetPalette {
        var palette = base(look)
        if !look.background && !look.tinted {
            // StandBy: no desk behind the words written beside the note, only black.
            palette.deskInk = rgb(0xf3e8fb)
            palette.deskSoft = rgb(0xc9b3de)
        }
        return palette
    }

    private static func base(_ look: NotesWidgetLook) -> NotesWidgetPalette {
        if look.tinted {
            let white = Color.white
            return NotesWidgetPalette(
                paper: white.opacity(0.13), paperShade: white.opacity(0.10), paperBack: white.opacity(0.3),
                paperEdge: white.opacity(0.6), fibre: white.opacity(0.0), rule: white.opacity(0.16), margin: white.opacity(0.3),
                ink: white, title: white, soft: white.opacity(0.7), wave: white.opacity(0.75),
                heart: white, heartDeep: white, gloss: white.opacity(0), shadow: .clear,
                flap: white.opacity(0.2), flapShade: white.opacity(0.08), stamp: white.opacity(0.9),
                sparkle: white.opacity(0.5), deskInk: white, deskSoft: white.opacity(0.72), tinted: true)
        }
        if look.dark {
            return NotesWidgetPalette(
                paper: rgb(0xf6eef3), paperShade: rgb(0xece0ea), paperBack: rgb(0xe3d3e2),
                paperEdge: rgb(0xd7c3dd), fibre: rgb(0xffffff, 0.55), rule: rgb(0xe2d2e8), margin: rgb(0xeaa3c0, 0.75),
                ink: rgb(0x4a2f5e), title: rgb(0x46295c), soft: rgb(0x7a5b93), wave: rgb(0xec8db6),
                heart: rgb(0xe2445c), heartDeep: rgb(0xb3243f), gloss: rgb(0xffffff, 0.7), shadow: rgb(0x000000, 0.45),
                flap: rgb(0xeee2eb), flapShade: rgb(0xdcc9da), stamp: rgb(0xd8395a),
                sparkle: rgb(0xc7aee6, 0.75), deskInk: rgb(0xf3e8fb), deskSoft: rgb(0xc9b3de), tinted: false)
        }
        return NotesWidgetPalette(
            paper: rgb(0xfffafd), paperShade: rgb(0xfcf1f7), paperBack: rgb(0xf3e3ee),
            paperEdge: rgb(0xe8d8ec), fibre: rgb(0xffffff, 0.9), rule: rgb(0xeadff2), margin: rgb(0xf5b3cc, 0.8),
            ink: rgb(0x553868), title: rgb(0x4e2f63), soft: rgb(0x7a5b93), wave: rgb(0xf49ac1),
            heart: rgb(0xe2445c), heartDeep: rgb(0xb8263f), gloss: rgb(0xffffff, 0.75), shadow: rgb(0x4e2f63, 0.2),
            flap: rgb(0xfaeff6), flapShade: rgb(0xeddbe9), stamp: rgb(0xd8395a),
            sparkle: rgb(0xc3a3e3, 0.8), deskInk: rgb(0x4e2f63), deskSoft: rgb(0x7a5b93), tinted: false)
    }
}

// MARK: - The desk (the widget's container background)

struct NotesWidgetDesk: View {
    var dark: Bool

    var body: some View {
        let c = NotesWidgetPalette.rgb
        ZStack {
            if dark {
                LinearGradient(colors: [c(0x3b2554, 1), c(0x231436, 1)], startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [c(0x8a63b8, 0.30), c(0x8a63b8, 0)], center: UnitPoint(x: 0.5, y: 0.18),
                               startRadius: 0, endRadius: 260)
            } else {
                LinearGradient(colors: [c(0xfcf5fb, 1), c(0xecdff5, 1)], startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [Color.white.opacity(0.65), Color.white.opacity(0)], center: UnitPoint(x: 0.5, y: 0.2),
                               startRadius: 0, endRadius: 240)
            }
        }
    }
}

/// A few sparkles (and, at night, star dots) scattered on the desk, placed by fractions of the widget.
struct NotesWidgetSparkles: View {
    struct Spot { var x: CGFloat; var y: CGFloat; var size: CGFloat }
    var spots: [Spot]
    var color: Color
    var stars: Bool = false

    var body: some View {
        Canvas { ctx, size in
            for spot in spots {
                let center = CGPoint(x: spot.x * size.width, y: spot.y * size.height)
                if stars && spot.size < 4 {
                    ctx.fill(Path(ellipseIn: CGRect(x: center.x - spot.size / 2, y: center.y - spot.size / 2, width: spot.size, height: spot.size)),
                             with: .color(color))
                } else {
                    ctx.fill(NotesWidgetSparkle.path(center: center, radius: spot.size), with: .color(color))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

enum NotesWidgetSparkle {
    /// A four-pointed sparkle (✦) with softly pinched sides.
    static func path(center c: CGPoint, radius r: CGFloat) -> Path {
        var p = Path()
        let k = r * 0.22
        p.move(to: CGPoint(x: c.x, y: c.y - r))
        p.addQuadCurve(to: CGPoint(x: c.x + r, y: c.y), control: CGPoint(x: c.x + k, y: c.y - k))
        p.addQuadCurve(to: CGPoint(x: c.x, y: c.y + r), control: CGPoint(x: c.x + k, y: c.y + k))
        p.addQuadCurve(to: CGPoint(x: c.x - r, y: c.y), control: CGPoint(x: c.x - k, y: c.y + k))
        p.addQuadCurve(to: CGPoint(x: c.x, y: c.y - r), control: CGPoint(x: c.x - k, y: c.y - k))
        p.closeSubpath()
        return p
    }
}

// MARK: - A small deterministic random, so every note keeps its own tear and tape

struct NotesWidgetSeed {
    private var state: UInt64

    init(_ text: String) {
        var hash: UInt64 = 1469598103934665603
        for byte in text.utf8 { hash = (hash ^ UInt64(byte)) &* 1099511628211 }
        state = hash | 1
    }

    mutating func next() -> Double {
        state ^= state << 13
        state ^= state >> 7
        state ^= state << 17
        return Double(state % 10_000) / 10_000
    }

    mutating func range(_ low: Double, _ high: Double) -> Double { low + (high - low) * next() }
}

// MARK: - Washi tape

struct NotesWidgetTape: View {
    enum Pattern: CaseIterable { case dots, stripes, hearts }

    var width: CGFloat
    var height: CGFloat
    var pattern: Pattern
    var tinted: Bool = false
    var dark: Bool = false

    static func pattern(for key: String) -> Pattern {
        var seed = NotesWidgetSeed(key)
        return Pattern.allCases[Int(seed.next() * 3) % 3]
    }

    private var base: Color {
        let c = NotesWidgetPalette.rgb
        switch pattern {
        case .dots: return c(0xf7a8c7, dark ? 0.92 : 0.84)
        case .stripes: return c(0xcdb3ea, dark ? 0.92 : 0.86)
        case .hearts: return c(0xf9bfd5, dark ? 0.94 : 0.88)
        }
    }

    var body: some View {
        Canvas { ctx, size in
            let strip = Self.strip(size)
            if tinted {
                // Only opacity survives tinting: a wash with the pattern knocked out of it.
                ctx.drawLayer { layer in
                    layer.fill(strip, with: .color(.white.opacity(0.55)))
                    layer.blendMode = .destinationOut
                    layer.fill(marks(size), with: .color(.white))
                }
                ctx.stroke(strip, with: .color(.white.opacity(0.8)), lineWidth: 0.8)
                return
            }
            ctx.fill(strip, with: .color(base))
            ctx.clip(to: strip)
            ctx.fill(marks(size), with: .color(.white.opacity(pattern == .stripes ? 0.55 : 0.88)))
            // A faint sheen along the top and a slightly deeper lower edge: it reads as a strip of tape.
            ctx.fill(Path(CGRect(x: 0, y: 1, width: size.width, height: size.height * 0.16)), with: .color(.white.opacity(0.28)))
            ctx.fill(Path(CGRect(x: 0, y: size.height * 0.86, width: size.width, height: size.height * 0.14)),
                     with: .color(.black.opacity(0.035)))
        }
        .frame(width: width, height: height)
    }

    /// The strip with torn, zig-zag ends.
    static func strip(_ size: CGSize) -> Path {
        var p = Path()
        let teeth = max(3, Int((size.height / 5).rounded()))
        let tooth = size.height / CGFloat(teeth)
        let bite: CGFloat = min(3, size.height * 0.14)
        p.move(to: CGPoint(x: bite, y: 0))
        p.addLine(to: CGPoint(x: size.width - bite, y: 0))
        for k in 0..<teeth {
            let y = CGFloat(k) * tooth
            p.addLine(to: CGPoint(x: size.width - (k.isMultiple(of: 2) ? 0 : bite), y: y + tooth / 2))
            p.addLine(to: CGPoint(x: size.width - bite, y: y + tooth))
        }
        p.addLine(to: CGPoint(x: bite, y: size.height))
        for k in (0..<teeth).reversed() {
            let y = CGFloat(k) * tooth
            p.addLine(to: CGPoint(x: k.isMultiple(of: 2) ? 0 : bite, y: y + tooth / 2))
            p.addLine(to: CGPoint(x: bite, y: y))
        }
        p.closeSubpath()
        return p
    }

    private func marks(_ size: CGSize) -> Path {
        var p = Path()
        let h = size.height
        switch pattern {
        case .dots:
            let r = max(1.2, h * 0.075)
            let step = h * 0.36
            var x = step * 0.6
            var column = 0
            while x < size.width {
                var y = column.isMultiple(of: 2) ? h * 0.27 : h * 0.6
                while y < h - r {
                    p.addEllipse(in: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r))
                    y += h * 0.66
                }
                x += step
                column += 1
            }
        case .stripes:
            let gap = h * 0.42
            let thick = h * 0.16
            var x = -h
            while x < size.width + h {
                var band = Path()
                band.move(to: CGPoint(x: x, y: h))
                band.addLine(to: CGPoint(x: x + h * 0.7, y: 0))
                band.addLine(to: CGPoint(x: x + h * 0.7 + thick, y: 0))
                band.addLine(to: CGPoint(x: x + thick, y: h))
                band.closeSubpath()
                p.addPath(band)
                x += gap
            }
        case .hearts:
            let s = h * 0.3
            let step = h * 0.62
            var x = step * 0.55
            var column = 0
            while x < size.width {
                let y = column.isMultiple(of: 2) ? h * 0.34 : h * 0.68
                p.addPath(NotesWidgetHeart.path(in: CGRect(x: x - s / 2, y: y - s / 2, width: s, height: s * 0.92)))
                x += step
                column += 1
            }
        }
        return p
    }
}

// MARK: - A heart

enum NotesWidgetHeart {
    static func path(in rect: CGRect) -> Path {
        var p = Path()
        let w = rect.width, h = rect.height, x = rect.minX, y = rect.minY
        p.move(to: CGPoint(x: x + w * 0.5, y: y + h))
        p.addCurve(to: CGPoint(x: x, y: y + h * 0.32),
                   control1: CGPoint(x: x + w * 0.38, y: y + h * 0.86), control2: CGPoint(x: x, y: y + h * 0.62))
        p.addCurve(to: CGPoint(x: x + w * 0.5, y: y + h * 0.16),
                   control1: CGPoint(x: x, y: y + h * 0.02), control2: CGPoint(x: x + w * 0.38, y: y - h * 0.04))
        p.addCurve(to: CGPoint(x: x + w, y: y + h * 0.32),
                   control1: CGPoint(x: x + w * 0.62, y: y - h * 0.04), control2: CGPoint(x: x + w, y: y + h * 0.02))
        p.addCurve(to: CGPoint(x: x + w * 0.5, y: y + h),
                   control1: CGPoint(x: x + w, y: y + h * 0.62), control2: CGPoint(x: x + w * 0.62, y: y + h * 0.86))
        p.closeSubpath()
        return p
    }
}

/// A glossy little heart, like a sticker (the cards' ❤️, drawn, so it tints with the widget).
struct NotesWidgetHeartMark: View {
    var size: CGFloat
    var palette: NotesWidgetPalette

    var body: some View {
        Canvas { ctx, canvas in
            let rect = CGRect(origin: .zero, size: canvas).insetBy(dx: 0.5, dy: 0.5)
            let heart = NotesWidgetHeart.path(in: rect)
            if palette.tinted {
                ctx.fill(heart, with: .color(.white))
                return
            }
            ctx.fill(heart, with: .linearGradient(Gradient(colors: [palette.heart, palette.heartDeep]),
                                                  startPoint: CGPoint(x: rect.minX, y: rect.minY),
                                                  endPoint: CGPoint(x: rect.maxX * 0.7, y: rect.maxY)))
            let shine = Path(ellipseIn: CGRect(x: rect.width * 0.17, y: rect.height * 0.16, width: rect.width * 0.26, height: rect.height * 0.2))
            ctx.fill(shine.applying(CGAffineTransform(rotationAngle: -0.5).concatenating(.init(translationX: -rect.height * 0.12, y: rect.width * 0.12))),
                     with: .color(palette.gloss))
        }
        .frame(width: size, height: size * 0.92)
        .widgetAccentable()
    }
}

// MARK: - The page: torn from a notepad, ruled, with a pink margin and a lifted corner

struct NotesWidgetPage: View {
    var size: CGSize
    var palette: NotesWidgetPalette
    var seed: String
    /// Baselines of the ruled lines (the words sit on them).
    var rules: [CGFloat]
    var marginX: CGFloat?
    var ruleInset: CGFloat = 8
    var curl: CGFloat = 13

    var body: some View {
        let outline = Self.outline(size, seed: seed, curl: curl)
        ZStack(alignment: .topLeading) {
            if palette.tinted {
                outline.fill(palette.paper)
                outline.stroke(palette.paperEdge, lineWidth: 1)
            } else {
                outline
                    .fill(LinearGradient(colors: [palette.paper, palette.paperShade], startPoint: .top, endPoint: .bottom))
                    .shadow(color: palette.shadow, radius: 5, x: 0, y: 3)
                outline.stroke(palette.paperEdge.opacity(0.7), lineWidth: 0.6)
                // White fibres along the torn top.
                Self.tear(size, seed: seed).stroke(palette.fibre, lineWidth: 1.1)
            }
            Canvas { ctx, canvas in
                ctx.clip(to: outline)
                for y in rules {
                    ctx.fill(Path(CGRect(x: ruleInset, y: y + 3, width: canvas.width - 2 * ruleInset, height: 0.9)), with: .color(palette.rule))
                }
                if let marginX {
                    ctx.fill(Path(CGRect(x: marginX, y: 6, width: 0.9, height: canvas.height - 6)), with: .color(palette.margin))
                }
            }
            if curl > 0 { NotesWidgetCurl(size: curl, palette: palette).offset(x: size.width - curl, y: size.height - curl) }
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
    }

    /// The page: a torn top edge, straight sides, the bottom-right corner folded up.
    static func outline(_ size: CGSize, seed: String, curl: CGFloat) -> Path {
        var p = Path()
        let points = tearPoints(size, seed: seed)
        p.move(to: points[0])
        for point in points.dropFirst() { p.addLine(to: point) }
        p.addLine(to: CGPoint(x: size.width, y: size.height - curl))
        p.addLine(to: CGPoint(x: size.width - curl, y: size.height))
        p.addLine(to: CGPoint(x: 1.5, y: size.height))
        p.addQuadCurve(to: CGPoint(x: 0, y: size.height - 1.5), control: CGPoint(x: 0, y: size.height))
        p.closeSubpath()
        return p
    }

    static func tear(_ size: CGSize, seed: String) -> Path {
        var p = Path()
        let points = tearPoints(size, seed: seed)
        p.move(to: points[0])
        for point in points.dropFirst() { p.addLine(to: point) }
        return p
    }

    private static func tearPoints(_ size: CGSize, seed key: String) -> [CGPoint] {
        var seed = NotesWidgetSeed("tear-\(key)")
        var points: [CGPoint] = []
        var x: CGFloat = 0
        while x < size.width {
            points.append(CGPoint(x: x, y: CGFloat(seed.range(0.2, 2.6))))
            x += CGFloat(seed.range(2.4, 5.2))
        }
        points.append(CGPoint(x: size.width, y: CGFloat(seed.range(0.4, 2.2))))
        return points
    }
}

/// The page's bottom-right corner, folded up towards the reader.
struct NotesWidgetCurl: View {
    var size: CGFloat
    var palette: NotesWidgetPalette

    var body: some View {
        Canvas { ctx, canvas in
            let s = canvas.width
            var flap = Path()
            flap.move(to: CGPoint(x: 0, y: s))
            flap.addLine(to: CGPoint(x: s, y: 0))
            flap.addQuadCurve(to: CGPoint(x: 0, y: s), control: CGPoint(x: s * 0.18, y: s * 0.18))
            if palette.tinted {
                ctx.fill(flap, with: .color(palette.paperBack))
                return
            }
            var shade = Path()
            shade.move(to: CGPoint(x: 0, y: s))
            shade.addLine(to: CGPoint(x: s, y: 0))
            shade.addLine(to: CGPoint(x: s + 1.5, y: s * 0.35))
            shade.addLine(to: CGPoint(x: s * 0.35, y: s + 1.5))
            shade.closeSubpath()
            ctx.fill(shade, with: .color(palette.shadow.opacity(0.35)))
            ctx.fill(flap, with: .linearGradient(Gradient(colors: [palette.paperBack, palette.paper]),
                                                 startPoint: CGPoint(x: s, y: s), endPoint: CGPoint(x: s * 0.3, y: s * 0.3)))
            ctx.stroke(flap, with: .color(palette.paperEdge.opacity(0.8)), lineWidth: 0.5)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - The note folded shut (a sealed note, or a letter's announcement)

struct NotesWidgetFolded: View {
    var size: CGSize
    var palette: NotesWidgetPalette
    /// Where the top flap's free edge comes down to (at its middle), as a fraction of the height.
    var flapDepth: CGFloat = 0.42
    /// The flap's edge isn't quite square to the sides: a hand folded it.
    var slant: CGFloat = 2.2

    /// The flap: folded down from the top edge, its free edge a touch slanted, a hair inside the sides.
    static func flap(_ size: CGSize, depth: CGFloat, slant: CGFloat) -> Path {
        let y = size.height * depth
        var p = Path()
        p.move(to: CGPoint(x: 3, y: 0))
        p.addLine(to: CGPoint(x: size.width - 3, y: 0))
        p.addQuadCurve(to: CGPoint(x: size.width, y: 3), control: CGPoint(x: size.width, y: 0))
        p.addLine(to: CGPoint(x: size.width - 0.6, y: y + slant))
        p.addLine(to: CGPoint(x: 0.6, y: y - slant))
        p.addLine(to: CGPoint(x: 0, y: 3))
        p.addQuadCurve(to: CGPoint(x: 3, y: 0), control: CGPoint(x: 0, y: 0))
        p.closeSubpath()
        return p
    }

    static func flapEdge(_ size: CGSize, depth: CGFloat, slant: CGFloat) -> Path {
        let y = size.height * depth
        var p = Path()
        p.move(to: CGPoint(x: 0.6, y: y - slant))
        p.addLine(to: CGPoint(x: size.width - 0.6, y: y + slant))
        return p
    }

    var body: some View {
        let body = RoundedRectangle(cornerRadius: 3, style: .continuous)
        let flapHeight = size.height * flapDepth
        let flap = Self.flap(size, depth: flapDepth, slant: slant)
        let edge = Self.flapEdge(size, depth: flapDepth, slant: slant)
        ZStack(alignment: .topLeading) {
            if palette.tinted {
                body.fill(palette.paper)
                body.stroke(palette.paperEdge, lineWidth: 1)
                flap.fill(palette.flap)
                edge.stroke(palette.paperEdge, lineWidth: 1)
            } else {
                body
                    .fill(LinearGradient(colors: [palette.paper, palette.paperShade], startPoint: .top, endPoint: .bottom))
                    .shadow(color: palette.shadow, radius: 6, x: 0, y: 4)
                // The front panel's faint rules, showing through the paper.
                Canvas { ctx, canvas in
                    var y = flapHeight + 14
                    while y < canvas.height - 6 {
                        ctx.fill(Path(CGRect(x: 8, y: y, width: canvas.width - 16, height: 0.8)), with: .color(palette.rule.opacity(0.5)))
                        y += 15
                    }
                }
                // The flap lifts a hair off the panel: a soft shadow just under its edge.
                Canvas { ctx, _ in
                    ctx.addFilter(.blur(radius: 2.2))
                    ctx.stroke(edge.offsetBy(dx: 0, dy: 1.8), with: .color(palette.shadow.opacity(0.7)), lineWidth: 2.4)
                }
                flap.fill(LinearGradient(colors: [palette.flap, palette.flapShade], startPoint: .top, endPoint: .bottom))
                // The crease along the top catching the light, and the flap's cut edge.
                Rectangle().fill(Color.white.opacity(0.8)).frame(width: size.width - 6, height: 1).offset(x: 3, y: 1)
                edge.stroke(palette.paperEdge, lineWidth: 0.8)
                body.stroke(palette.paperEdge.opacity(0.7), lineWidth: 0.6)
            }
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
    }
}

// MARK: - Josh's stamp: "she opened it ♡"

struct NotesWidgetStamp: View {
    var lines: [String]
    var palette: NotesWidgetPalette
    var size: CGFloat = 13
    var faded: Bool = false

    var body: some View {
        let ink = faded ? palette.soft : palette.stamp
        VStack(spacing: 0) {
            ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                Text(line)
                    .font(NotesWidgetFonts.font(index == 0 ? .handBold : .hand, size: index == 0 ? size : size * 0.8))
                    .foregroundStyle(ink)
                    .lineLimit(1)
                    .fixedSize()
            }
        }
        .padding(.horizontal, size * 0.55)
        .padding(.vertical, size * 0.22)
        .background {
            ZStack {
                RoundedRectangle(cornerRadius: size * 0.45, style: .continuous).stroke(ink, lineWidth: 1.4)
                RoundedRectangle(cornerRadius: size * 0.3, style: .continuous).stroke(ink.opacity(0.6), lineWidth: 0.7).padding(2.6)
            }
        }
        .opacity(palette.tinted ? 1 : 0.88)
        .widgetAccentable()
    }
}

// MARK: - The title's wavy pink underline

struct NotesWidgetWave: Shape {
    var amplitude: CGFloat = 1.6
    var period: CGFloat = 9

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let mid = rect.midY
        p.move(to: CGPoint(x: rect.minX, y: mid))
        var x = rect.minX
        while x < rect.maxX {
            let next = min(x + period / 2, rect.maxX)
            let up = Int(((x - rect.minX) / (period / 2)).rounded()) % 2 == 0
            p.addQuadCurve(to: CGPoint(x: next, y: mid), control: CGPoint(x: (x + next) / 2, y: mid + (up ? -amplitude * 2 : amplitude * 2)))
            x = next
        }
        return p
    }
}
