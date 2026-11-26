import SwiftUI

// Everything the widget draws itself (original art, SwiftUI paths): the glossy ♡, a one-colour icon per
// signal for the tinted Home Screen and the Lock Screen (colour emoji turn into solid white blobs there,
// because the system keeps only each pixel's alpha), and the tiny doodles that decorate each button.

// MARK: - Shapes

/// The site's heart (server/push notification art: M0 30C-28 10…), fitted to the rect.
struct SignalsWidgetHeart: Shape {
    func path(in rect: CGRect) -> Path {
        // Source box: x −46…46, y −48…30 (92 × 78).
        let sx = rect.width / 92, sy = rect.height / 78
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + (x + 46) * sx, y: rect.minY + (y + 48) * sy) }
        var path = Path()
        path.move(to: p(0, 30))
        path.addCurve(to: p(-46, -24), control1: p(-28, 10), control2: p(-46, -6))
        path.addCurve(to: p(-22, -48), control1: p(-46, -38), control2: p(-35, -48))
        path.addCurve(to: p(0, -34), control1: p(-12, -48), control2: p(-4, -42))
        path.addCurve(to: p(22, -48), control1: p(4, -42), control2: p(12, -48))
        path.addCurve(to: p(46, -24), control1: p(35, -48), control2: p(46, -38))
        path.addCurve(to: p(0, 30), control1: p(46, -6), control2: p(28, 10))
        path.closeSubpath()
        return path
    }
}

/// A four-point sparkle with soft, concave sides.
struct SignalsWidgetSparkle: Shape {
    func path(in rect: CGRect) -> Path {
        let c = CGPoint(x: rect.midX, y: rect.midY)
        let w = rect.width / 2, h = rect.height / 2
        let k: CGFloat = 0.18
        var path = Path()
        path.move(to: CGPoint(x: c.x, y: c.y - h))
        path.addQuadCurve(to: CGPoint(x: c.x + w, y: c.y), control: CGPoint(x: c.x + w * k, y: c.y - h * k))
        path.addQuadCurve(to: CGPoint(x: c.x, y: c.y + h), control: CGPoint(x: c.x + w * k, y: c.y + h * k))
        path.addQuadCurve(to: CGPoint(x: c.x - w, y: c.y), control: CGPoint(x: c.x - w * k, y: c.y + h * k))
        path.addQuadCurve(to: CGPoint(x: c.x, y: c.y - h), control: CGPoint(x: c.x - w * k, y: c.y - h * k))
        path.closeSubpath()
        return path
    }
}

/// A plump five-point star.
struct SignalsWidgetStar: Shape {
    func path(in rect: CGRect) -> Path {
        let c = CGPoint(x: rect.midX, y: rect.midY + rect.height * 0.04)
        let r = min(rect.width, rect.height) / 2
        var path = Path()
        for i in 0..<10 {
            let angle = -CGFloat.pi / 2 + CGFloat(i) * .pi / 5
            let radius = i.isMultiple(of: 2) ? r : r * 0.5
            let point = CGPoint(x: c.x + cos(angle) * radius, y: c.y + sin(angle) * radius)
            if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        path.closeSubpath()
        return path
    }
}

/// A water drop, point up.
struct SignalsWidgetDrop: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width, h = rect.height
        let r = w * 0.5
        let center = CGPoint(x: rect.midX, y: rect.maxY - r)
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addCurve(to: CGPoint(x: rect.maxX, y: center.y),
                      control1: CGPoint(x: rect.midX + w * 0.18, y: rect.minY + h * 0.2),
                      control2: CGPoint(x: rect.maxX, y: center.y - r * 0.55))
        path.addArc(center: center, radius: r, startAngle: .degrees(0), endAngle: .degrees(180), clockwise: false)
        path.addCurve(to: CGPoint(x: rect.midX, y: rect.minY),
                      control1: CGPoint(x: rect.minX, y: center.y - r * 0.55),
                      control2: CGPoint(x: rect.midX - w * 0.18, y: rect.minY + h * 0.2))
        path.closeSubpath()
        return path
    }
}

// MARK: - The glossy ♡ (the "thinking of you" signal's picture)

struct SignalsWidgetGlossyHeart: View {
    var look: SignalsWidgetLook

    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width, h = proxy.size.height
            ZStack {
                if look.isMono {
                    SignalsWidgetHeart().fill(Color.white)
                } else {
                    SignalsWidgetHeart()
                        .fill(LinearGradient(colors: [SignalsWidgetPalette.heartLight, SignalsWidgetPalette.heart],
                                             startPoint: .top, endPoint: .center))
                    SignalsWidgetHeart()
                        .fill(LinearGradient(colors: [SignalsWidgetPalette.heart.opacity(0), SignalsWidgetPalette.heartDeep],
                                             startPoint: .center, endPoint: .bottom))
                    SignalsWidgetHeart()
                        .stroke(SignalsWidgetPalette.heartDeep.opacity(0.55), lineWidth: max(0.75, w * 0.025))
                    // Gloss: a soft oval on the left lobe and a small glint on the right.
                    Ellipse()
                        .fill(Color.white.opacity(0.75))
                        .frame(width: w * 0.2, height: h * 0.13)
                        .rotationEffect(.degrees(-38))
                        .offset(x: -w * 0.22, y: -h * 0.2)
                    Circle()
                        .fill(Color.white.opacity(0.55))
                        .frame(width: w * 0.07, height: w * 0.07)
                        .offset(x: w * 0.2, y: -h * 0.22)
                }
            }
            .frame(width: w, height: h)
        }
        .aspectRatio(92 / 78, contentMode: .fit)
    }
}

// MARK: - One-colour icons (tinted Home Screen, Lock Screen, StandBy at night)

/// Each signal as a solid shape with cut-outs, so it still reads when only its alpha survives.
struct SignalsWidgetIconShape: Shape {
    let signal: SignalsWidgetSignal

    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height)
        let origin = CGPoint(x: rect.midX - s / 2, y: rect.midY - s / 2)
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: origin.x + x * s, y: origin.y + y * s) }
        func box(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> CGRect {
            CGRect(x: origin.x + x * s, y: origin.y + y * s, width: w * s, height: h * s)
        }
        func circle(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat) -> Path {
            Path(ellipseIn: box(x - r, y - r, r * 2, r * 2))
        }
        func line(_ points: [CGPoint], width: CGFloat) -> Path {
            var path = Path()
            path.addLines(points)
            return path.strokedPath(StrokeStyle(lineWidth: width * s, lineCap: .round, lineJoin: .round))
        }

        switch signal {
        case .thinking:
            return SignalsWidgetHeart().path(in: box(0.04, 0.1, 0.92, 0.78))

        case .hug:
            // ( ♡ ): two arms holding a heart.
            var path = SignalsWidgetHeart().path(in: box(0.27, 0.27, 0.46, 0.39))
            var left = Path()
            left.move(to: p(0.25, 0.14))
            left.addQuadCurve(to: p(0.27, 0.86), control: p(-0.02, 0.5))
            var right = Path()
            right.move(to: p(0.75, 0.14))
            right.addQuadCurve(to: p(0.73, 0.86), control: p(1.02, 0.5))
            let style = StrokeStyle(lineWidth: 0.12 * s, lineCap: .round)
            path.addPath(left.strokedPath(style))
            path.addPath(right.strokedPath(style))
            return path

        case .kiss:
            var lips = Path()
            lips.move(to: p(0.04, 0.5))
            lips.addCurve(to: p(0.5, 0.33), control1: p(0.16, 0.36), control2: p(0.36, 0.16))
            lips.addCurve(to: p(0.96, 0.5), control1: p(0.64, 0.16), control2: p(0.84, 0.36))
            lips.addCurve(to: p(0.04, 0.5), control1: p(0.82, 0.94), control2: p(0.18, 0.94))
            lips.closeSubpath()
            var seam = Path()
            seam.move(to: p(0.13, 0.52))
            seam.addQuadCurve(to: p(0.87, 0.52), control: p(0.5, 0.64))
            return lips.subtracting(seam.strokedPath(StrokeStyle(lineWidth: 0.06 * s, lineCap: .round)))

        case .morning:
            var path = circle(0.5, 0.5, 0.21)
            for i in 0..<8 {
                let angle = CGFloat(i) * .pi / 4
                let inner = CGPoint(x: 0.5 + cos(angle) * 0.32, y: 0.5 + sin(angle) * 0.32)
                let outer = CGPoint(x: 0.5 + cos(angle) * 0.45, y: 0.5 + sin(angle) * 0.45)
                path.addPath(line([p(inner.x, inner.y), p(outer.x, outer.y)], width: 0.085))
            }
            return path

        case .night:
            let moon = circle(0.45, 0.54, 0.37).subtracting(circle(0.63, 0.4, 0.31))
            var path = moon
            path.addPath(SignalsWidgetSparkle().path(in: box(0.66, 0.06, 0.26, 0.3)))
            path.addPath(circle(0.86, 0.5, 0.04))
            return path

        case .miss:
            // A round face with big pleading eyes (a highlight in each) and a little wobbly mouth.
            var face = circle(0.5, 0.52, 0.44)
            for x in [0.34, 0.66] as [CGFloat] {
                face = face.subtracting(circle(x, 0.52, 0.12))
                face.addPath(circle(x - 0.035, 0.485, 0.045))
                face.addPath(circle(x + 0.045, 0.565, 0.022))
            }
            face = face.subtracting(line([p(0.22, 0.33), p(0.37, 0.27)], width: 0.055))
            face = face.subtracting(line([p(0.78, 0.33), p(0.63, 0.27)], width: 0.055))
            var mouth = Path()
            mouth.move(to: p(0.41, 0.78))
            mouth.addQuadCurve(to: p(0.59, 0.78), control: p(0.5, 0.7))
            return face.subtracting(mouth.strokedPath(StrokeStyle(lineWidth: 0.055 * s, lineCap: .round)))

        case .water:
            let drop = SignalsWidgetDrop().path(in: box(0.2, 0.06, 0.6, 0.86))
            var shine = Path()
            shine.move(to: p(0.33, 0.6))
            shine.addQuadCurve(to: p(0.43, 0.8), control: p(0.31, 0.75))
            return drop.subtracting(shine.strokedPath(StrokeStyle(lineWidth: 0.07 * s, lineCap: .round)))
        }
    }
}

// MARK: - Doodles: a few tiny marks in each button's corner, in that signal's ink

struct SignalsWidgetDoodle: View {
    let signal: SignalsWidgetSignal
    var color: Color
    /// The doodle's box; marks are placed inside it, top-right weighted.
    var size: CGFloat

    var body: some View {
        ZStack(alignment: .topTrailing) {
            switch signal {
            case .thinking:
                mark(SignalsWidgetHeart(), 0.42, 0.36, x: 0, y: 0.02)
                mark(SignalsWidgetHeart(), 0.26, 0.22, x: -0.5, y: 0.34, alpha: 0.7)
            case .hug:
                mark(SignalsWidgetHeart(), 0.36, 0.3, x: 0, y: 0.06)
                mark(SignalsWidgetSparkle(), 0.3, 0.3, x: -0.44, y: 0.36, alpha: 0.75)
            case .kiss:
                // x o
                cross(0.3, x: 0, y: 0.04)
                ring(0.3, x: -0.42, y: 0.04, alpha: 0.8)
                mark(SignalsWidgetHeart(), 0.22, 0.19, x: -0.2, y: 0.46, alpha: 0.7)
            case .morning:
                mark(SignalsWidgetSparkle(), 0.42, 0.42, x: 0, y: 0)
                mark(SignalsWidgetSparkle(), 0.24, 0.24, x: -0.48, y: 0.36, alpha: 0.75)
            case .night:
                mark(SignalsWidgetStar(), 0.36, 0.36, x: 0, y: 0)
                mark(SignalsWidgetStar(), 0.2, 0.2, x: -0.5, y: 0.3, alpha: 0.75)
                mark(Circle(), 0.09, 0.09, x: -0.14, y: 0.5, alpha: 0.7)
            case .miss:
                hollowHeart(0.4, x: 0, y: 0.04)
                hollowHeart(0.24, x: -0.5, y: 0.38, alpha: 0.75)
            case .water:
                mark(SignalsWidgetDrop(), 0.26, 0.36, x: 0, y: 0)
                mark(Circle(), 0.13, 0.13, x: -0.4, y: 0.2, alpha: 0.75)
                mark(SignalsWidgetDrop(), 0.16, 0.22, x: -0.22, y: 0.46, alpha: 0.7)
            }
        }
        .frame(width: size, height: size, alignment: .topTrailing)
        .accessibilityHidden(true)
    }

    private func mark<S: Shape>(_ shape: S, _ w: CGFloat, _ h: CGFloat, x: CGFloat, y: CGFloat, alpha: Double = 1) -> some View {
        shape.fill(color.opacity(alpha))
            .frame(width: w * size, height: h * size)
            .offset(x: x * size, y: y * size)
    }

    private func hollowHeart(_ w: CGFloat, x: CGFloat, y: CGFloat, alpha: Double = 1) -> some View {
        SignalsWidgetHeart().stroke(color.opacity(alpha), lineWidth: max(1, size * 0.07))
            .frame(width: w * size, height: w * size * 0.85)
            .offset(x: x * size, y: y * size)
    }

    private func ring(_ w: CGFloat, x: CGFloat, y: CGFloat, alpha: Double = 1) -> some View {
        Circle().stroke(color.opacity(alpha), lineWidth: max(1, size * 0.075))
            .frame(width: w * size, height: w * size)
            .offset(x: x * size, y: y * size)
    }

    private func cross(_ w: CGFloat, x: CGFloat, y: CGFloat, alpha: Double = 1) -> some View {
        Path { path in
            path.move(to: .zero); path.addLine(to: CGPoint(x: w * size, y: w * size))
            path.move(to: CGPoint(x: w * size, y: 0)); path.addLine(to: CGPoint(x: 0, y: w * size))
        }
        .stroke(color.opacity(alpha), style: StrokeStyle(lineWidth: max(1, size * 0.075), lineCap: .round))
        .frame(width: w * size, height: w * size)
        .offset(x: x * size, y: y * size)
    }
}

extension SignalsWidgetSignal {
    /// 🫂 draws smaller inside its box than the round faces; this evens them out by eye.
    var emojiOptical: CGFloat { self == .hug ? 1.12 : 1 }
}

// MARK: - The signal's picture: its colour emoji, or the drawn ♡, or (in one colour) its icon

struct SignalsWidgetPicture: View {
    let signal: SignalsWidgetSignal
    var look: SignalsWidgetLook
    var size: CGFloat

    var body: some View {
        Group {
            if signal == .thinking {
                SignalsWidgetGlossyHeart(look: look)
                    .frame(width: size * 0.98, height: size * 0.84)
            } else if look.isMono {
                SignalsWidgetIconShape(signal: signal)
                    .fill(Color.white, style: FillStyle(eoFill: false))
                    .frame(width: size * 0.9, height: size * 0.9)
            } else {
                emoji
            }
        }
        .frame(width: size, height: size)
        .widgetAccentable()
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private var emoji: some View {
        let points = size * 0.86 * signal.emojiOptical
        #if SIGNALS_LAB
        if let image = SignalsWidgetFonts.labEmojiImage?(signal.emoji, points) {
            Image(decorative: image, scale: 3)
        } else {
            Text(signal.emoji).font(SignalsWidgetFonts.emoji(size: points)).fixedSize()
        }
        #else
        Text(signal.emoji).font(SignalsWidgetFonts.emoji(size: points)).fixedSize()
        #endif
    }
}
