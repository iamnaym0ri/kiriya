import SwiftUI

// Original art for the con ticket, all drawn in SwiftUI: the ticket with its punched notches and
// perforation, a barcode, sparkles and confetti for the sky, and the red heart seal for her picks
// (a small cousin of the little note's wax seal).

// MARK: - The ticket

/// A rounded ticket with two half-moon notches where it tears: on the left and right edges at
/// `cut` (a fraction of the height) for a stub along the bottom, or on the top and bottom edges
/// at `cut` (a fraction of the width) for a stub on the right.
struct ConWidgetTicketShape: Shape {
    enum Tear { case across, down }
    var tear: Tear
    var cut: CGFloat
    var corner: CGFloat = 14
    var notch: CGFloat = 7

    func path(in rect: CGRect) -> Path {
        let r = min(corner, rect.width / 2, rect.height / 2)
        let n = notch
        var p = Path()
        let minX = rect.minX, maxX = rect.maxX, minY = rect.minY, maxY = rect.maxY
        p.move(to: CGPoint(x: minX + r, y: minY))
        if tear == .down {
            let x = rect.minX + rect.width * cut
            p.addLine(to: CGPoint(x: x - n, y: minY))
            p.addArc(center: CGPoint(x: x, y: minY), radius: n, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: true)
        }
        p.addLine(to: CGPoint(x: maxX - r, y: minY))
        p.addArc(center: CGPoint(x: maxX - r, y: minY + r), radius: r, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
        if tear == .across {
            let y = rect.minY + rect.height * cut
            p.addLine(to: CGPoint(x: maxX, y: y - n))
            p.addArc(center: CGPoint(x: maxX, y: y), radius: n, startAngle: .degrees(270), endAngle: .degrees(90), clockwise: true)
        }
        p.addLine(to: CGPoint(x: maxX, y: maxY - r))
        p.addArc(center: CGPoint(x: maxX - r, y: maxY - r), radius: r, startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false)
        if tear == .down {
            let x = rect.minX + rect.width * cut
            p.addLine(to: CGPoint(x: x + n, y: maxY))
            p.addArc(center: CGPoint(x: x, y: maxY), radius: n, startAngle: .degrees(0), endAngle: .degrees(180), clockwise: true)
        }
        p.addLine(to: CGPoint(x: minX + r, y: maxY))
        p.addArc(center: CGPoint(x: minX + r, y: maxY - r), radius: r, startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false)
        if tear == .across {
            let y = rect.minY + rect.height * cut
            p.addLine(to: CGPoint(x: minX, y: y + n))
            p.addArc(center: CGPoint(x: minX, y: y), radius: n, startAngle: .degrees(90), endAngle: .degrees(270), clockwise: true)
        }
        p.addLine(to: CGPoint(x: minX, y: minY + r))
        p.addArc(center: CGPoint(x: minX + r, y: minY + r), radius: r, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
        p.closeSubpath()
        return p
    }
}

/// The ticket, drawn: paper, the stub's tint, the dotted tear line, a plum outline and a soft shadow.
struct ConWidgetTicket: View {
    let look: ConWidgetLook
    var tear: ConWidgetTicketShape.Tear
    var cut: CGFloat
    var corner: CGFloat = 14
    var notch: CGFloat = 7

    var body: some View {
        let shape = ConWidgetTicketShape(tear: tear, cut: cut, corner: corner, notch: notch)
        GeometryReader { geo in
            let size = geo.size
            ZStack {
                shape.fill(LinearGradient(colors: [look.paperTop, look.paperBottom], startPoint: .top, endPoint: .bottom))
                // The stub's tint, clipped to the ticket.
                Rectangle()
                    .fill(look.stub)
                    .frame(width: tear == .down ? size.width * (1 - cut) : size.width,
                           height: tear == .across ? size.height * (1 - cut) : size.height)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .clipShape(shape)
                ConWidgetTearLine(tear: tear, cut: cut, inset: notch + 3)
                    .stroke(look.perforation, style: StrokeStyle(lineWidth: 1.6, lineCap: .round, dash: [0.1, 4.6]))
                shape.stroke(look.outline, lineWidth: look.outlineWidth)
            }
            .compositingGroup()
            .shadow(color: look.shadow, radius: look.isMono ? 0 : 5, x: 0, y: look.isMono ? 0 : 2.5)
        }
    }
}

struct ConWidgetTearLine: Shape {
    var tear: ConWidgetTicketShape.Tear
    var cut: CGFloat
    var inset: CGFloat

    func path(in rect: CGRect) -> Path {
        var p = Path()
        if tear == .across {
            let y = rect.minY + rect.height * cut
            p.move(to: CGPoint(x: rect.minX + inset, y: y))
            p.addLine(to: CGPoint(x: rect.maxX - inset, y: y))
        } else {
            let x = rect.minX + rect.width * cut
            p.move(to: CGPoint(x: x, y: rect.minY + inset))
            p.addLine(to: CGPoint(x: x, y: rect.maxY - inset))
        }
        return p
    }
}

// MARK: - Barcode

/// A short, made-up barcode from the con's name (so each con's ticket has its own).
struct ConWidgetBarcode: Shape {
    var seed: String

    func path(in rect: CGRect) -> Path {
        var p = Path()
        var state: UInt64 = 1469598103934665603
        for byte in seed.utf8 { state = (state ^ UInt64(byte)) &* 1099511628211 }
        func next() -> UInt64 {
            state ^= state << 13; state ^= state >> 7; state ^= state << 17
            return state
        }
        var x = rect.minX
        let unit = max(0.9, rect.width / 64)
        // Guard bars, then the "data", then guard bars again.
        let pattern: [CGFloat] = [1, 1, 1]
        for (i, w) in pattern.enumerated() where i % 2 == 0 {
            p.addRect(CGRect(x: x, y: rect.minY, width: w * unit, height: rect.height)); x += w * unit * 2
        }
        while x < rect.maxX - unit * 6 {
            let bar = CGFloat(1 + next() % 3) * unit
            let gap = CGFloat(1 + next() % 2) * unit
            p.addRect(CGRect(x: x, y: rect.minY, width: bar, height: rect.height * (next() % 9 == 0 ? 0.82 : 1)))
            x += bar + gap
        }
        x = rect.maxX - unit * 5
        for _ in 0..<2 {
            p.addRect(CGRect(x: x, y: rect.minY, width: unit, height: rect.height)); x += unit * 2
        }
        return p
    }
}

// MARK: - Sparkles, confetti, hearts

/// A four-pointed sparkle (the site's ✦).
struct ConWidgetSparkle: Shape {
    func path(in rect: CGRect) -> Path {
        let c = CGPoint(x: rect.midX, y: rect.midY)
        let rx = rect.width / 2, ry = rect.height / 2
        let pinch: CGFloat = 0.18
        var p = Path()
        p.move(to: CGPoint(x: c.x, y: c.y - ry))
        p.addQuadCurve(to: CGPoint(x: c.x + rx, y: c.y), control: CGPoint(x: c.x + rx * pinch, y: c.y - ry * pinch))
        p.addQuadCurve(to: CGPoint(x: c.x, y: c.y + ry), control: CGPoint(x: c.x + rx * pinch, y: c.y + ry * pinch))
        p.addQuadCurve(to: CGPoint(x: c.x - rx, y: c.y), control: CGPoint(x: c.x - rx * pinch, y: c.y + ry * pinch))
        p.addQuadCurve(to: CGPoint(x: c.x, y: c.y - ry), control: CGPoint(x: c.x - rx * pinch, y: c.y - ry * pinch))
        p.closeSubpath()
        return p
    }
}

struct ConWidgetHeartShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width, h = rect.height
        var p = Path()
        p.move(to: CGPoint(x: rect.minX + w * 0.5, y: rect.minY + h * 0.95))
        p.addCurve(to: CGPoint(x: rect.minX + w * 0.02, y: rect.minY + h * 0.36),
                   control1: CGPoint(x: rect.minX + w * 0.32, y: rect.minY + h * 0.78),
                   control2: CGPoint(x: rect.minX + w * 0.02, y: rect.minY + h * 0.62))
        p.addCurve(to: CGPoint(x: rect.minX + w * 0.5, y: rect.minY + h * 0.2),
                   control1: CGPoint(x: rect.minX + w * 0.02, y: rect.minY + h * 0.06),
                   control2: CGPoint(x: rect.minX + w * 0.4, y: rect.minY + h * 0.0))
        p.addCurve(to: CGPoint(x: rect.minX + w * 0.98, y: rect.minY + h * 0.36),
                   control1: CGPoint(x: rect.minX + w * 0.6, y: rect.minY + h * 0.0),
                   control2: CGPoint(x: rect.minX + w * 0.98, y: rect.minY + h * 0.06))
        p.addCurve(to: CGPoint(x: rect.minX + w * 0.5, y: rect.minY + h * 0.95),
                   control1: CGPoint(x: rect.minX + w * 0.98, y: rect.minY + h * 0.62),
                   control2: CGPoint(x: rect.minX + w * 0.68, y: rect.minY + h * 0.78))
        p.closeSubpath()
        return p
    }
}

/// The red heart seal stuck on her picks: wax with a scalloped rim, a pressed heart and a gloss.
struct ConWidgetHeartSeal: View {
    let look: ConWidgetLook
    var size: CGFloat = 24

    var body: some View {
        if look.isMono {
            ZStack {
                Circle().fill(Color.white.opacity(0.22))
                Circle().stroke(Color.white.opacity(0.7), lineWidth: 1.2)
                ConWidgetHeartShape().fill(Color.white).frame(width: size * 0.48, height: size * 0.44).offset(y: size * 0.02)
            }
            .frame(width: size, height: size)
            .widgetAccentable()
        } else {
            ZStack {
                // Scalloped wax: twelve little lobes round a disc.
                ForEach(0..<12, id: \.self) { i in
                    Circle()
                        .fill(look.wax)
                        .frame(width: size * 0.3, height: size * 0.3)
                        .offset(y: -size * 0.36)
                        .rotationEffect(.degrees(Double(i) * 30 + 8))
                }
                Circle().fill(RadialGradient(colors: [look.waxLight, look.wax], center: UnitPoint(x: 0.38, y: 0.32), startRadius: 0, endRadius: size * 0.5))
                    .frame(width: size * 0.84, height: size * 0.84)
                Circle().stroke(look.waxDeep.opacity(0.55), lineWidth: max(1, size * 0.045))
                    .frame(width: size * 0.62, height: size * 0.62)
                ConWidgetHeartShape().fill(look.waxHeart)
                    .frame(width: size * 0.34, height: size * 0.31)
                    .offset(y: size * 0.015)
                // Gloss.
                Circle().trim(from: 0.55, to: 0.8)
                    .stroke(Color.white.opacity(0.55), style: StrokeStyle(lineWidth: max(1, size * 0.06), lineCap: .round))
                    .frame(width: size * 0.66, height: size * 0.66)
            }
            .frame(width: size, height: size)
            .rotationEffect(.degrees(-12))
            .shadow(color: look.waxDeep.opacity(0.35), radius: 1.5, x: 0, y: 1)
        }
    }
}

/// The lilac sky behind the ticket: two-stop gradient (no CoreGraphics seams), a soft light from
/// above and a scatter of sparkles and confetti, placed by fraction so every size gets its own.
struct ConWidgetSky: View {
    let look: ConWidgetLook
    var confetti: [ConWidgetConfetto]

    var body: some View {
        GeometryReader { geo in
            ZStack {
                LinearGradient(colors: [look.skyTop, look.skyBottom], startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [look.skyGlow, look.skyGlow.opacity(0)], center: UnitPoint(x: 0.3, y: 0.05),
                               startRadius: 0, endRadius: max(geo.size.width, geo.size.height) * 0.75)
                ForEach(confetti.indices, id: \.self) { i in
                    let bit = confetti[i]
                    bit.view(look)
                        .position(x: geo.size.width * bit.x, y: geo.size.height * bit.y)
                }
            }
        }
    }
}

struct ConWidgetConfetto {
    enum Kind { case sparkle, warmSparkle, dot, warmDot, gold, heart }
    var kind: Kind
    var x: CGFloat
    var y: CGFloat
    var size: CGFloat
    var angle: Double = 0

    @ViewBuilder
    func view(_ look: ConWidgetLook) -> some View {
        switch kind {
        case .sparkle: ConWidgetSparkle().fill(look.sparkle).frame(width: size, height: size)
        case .warmSparkle: ConWidgetSparkle().fill(look.sparkleWarm).frame(width: size, height: size)
        case .dot: Circle().fill(look.sparkle).frame(width: size, height: size)
        case .warmDot: Circle().fill(look.sparkleWarm).frame(width: size, height: size)
        case .gold: Capsule().fill(look.confettiGold).frame(width: size, height: size * 0.42).rotationEffect(.degrees(angle))
        case .heart: ConWidgetHeartShape().fill(look.sparkleWarm).frame(width: size, height: size * 0.92).rotationEffect(.degrees(angle))
        }
    }

    // Placed to sit in the margins round the ticket.
    static let small: [ConWidgetConfetto] = [
        .init(kind: .sparkle, x: 0.06, y: 0.12, size: 7),
        .init(kind: .warmDot, x: 0.95, y: 0.24, size: 3),
        .init(kind: .gold, x: 0.045, y: 0.36, size: 6, angle: 60),
        .init(kind: .sparkle, x: 0.955, y: 0.86, size: 6),
    ]
    static let medium: [ConWidgetConfetto] = [
        .init(kind: .sparkle, x: 0.028, y: 0.14, size: 7),
        .init(kind: .warmDot, x: 0.5, y: 0.03, size: 3),
        .init(kind: .gold, x: 0.022, y: 0.7, size: 6, angle: 60),
        .init(kind: .sparkle, x: 0.976, y: 0.2, size: 6),
        .init(kind: .heart, x: 0.975, y: 0.84, size: 5, angle: 12),
        .init(kind: .dot, x: 0.62, y: 0.975, size: 2.5),
    ]
    static let large: [ConWidgetConfetto] = [
        .init(kind: .sparkle, x: 0.028, y: 0.07, size: 7),
        .init(kind: .warmDot, x: 0.46, y: 0.015, size: 3),
        .init(kind: .gold, x: 0.022, y: 0.36, size: 6, angle: 60),
        .init(kind: .sparkle, x: 0.976, y: 0.1, size: 6),
        .init(kind: .heart, x: 0.976, y: 0.42, size: 5, angle: 12),
        .init(kind: .dot, x: 0.024, y: 0.76, size: 2.5),
        .init(kind: .warmSparkle, x: 0.977, y: 0.9, size: 6),
        .init(kind: .gold, x: 0.6, y: 0.988, size: 5, angle: -20),
    ]
}
