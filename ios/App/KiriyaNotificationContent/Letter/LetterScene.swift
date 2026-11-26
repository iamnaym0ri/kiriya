import SwiftUI

// The letter's whole performance as a pure function of time: LetterGeometry lays the card out for a
// note and a width, LetterGeometry.pose(time:idle:) says where every piece is at a given moment,
// and LetterScene draws that pose. LetterCard (LetterCard.swift) only supplies the clock.
//
// The opening, in seconds (LetterGeometry.duration in all):
//   0.00  the seal gives a little squeeze, then pops off in a puff of hearts and sparkles
//   0.18  the bow's loops pull through, the knot slips, and the satin band slides off
//   0.30  the envelope starts gliding down to make room
//   0.50  the lace-trimmed flap swings open (and settles back a touch)
//   0.76  the folded note rises out of the envelope, red hearts drifting up from inside
//   1.40  the note, now clear of the envelope, comes forward and unfolds, fold by fold
//   1.92  it settles onto the open envelope with a small bounce and tilt
//   2.80  at rest

struct LetterGeometry {
    static let duration: Double = 2.8
    /// The tallest the open card gets by default (the host caps the notification at 720pt).
    static let defaultMaxHeight: CGFloat = 700

    let width: CGFloat
    let maxHeight: CGFloat
    let env: LetterEnvelopeMetrics
    let paper: LetterPaperLayout
    let sealedHeight: CGFloat
    let openHeight: CGFloat
    let headingY: CGFloat
    let hintY: CGFloat
    let envSealedCenter: CGPoint
    let envRestCenter: CGPoint
    let restScale: CGFloat = 0.9
    let restEnvelopeAngle: Double = 2.0
    let restPaperAngle: Double = -1.1
    let paperRestCenter: CGPoint
    let insideScale: CGFloat
    let lift: CGFloat = 12
    private(set) var swapTime: Double = 1.6

    private static let lock = NSLock()
    private static var cache: [String: LetterGeometry] = [:]

    static func make(content: LetterContent, width: CGFloat, maxHeight: CGFloat = defaultMaxHeight) -> LetterGeometry {
        let key = "\(width)|\(maxHeight)|\(content.heading)|\(content.title ?? "∅")|\(content.byline)|\(content.truncated)|\(content.text)"
        lock.lock()
        if let hit = cache[key] { lock.unlock(); return hit }
        lock.unlock()
        let made = LetterGeometry(content: content, width: width, maxHeight: maxHeight)
        lock.lock()
        if cache.count > 16 { cache.removeAll() }
        cache[key] = made
        lock.unlock()
        return made
    }

    static func height(content: LetterContent, width: CGFloat, open: Bool, maxHeight: CGFloat = defaultMaxHeight) -> CGFloat {
        let g = make(content: content, width: width, maxHeight: maxHeight)
        return open ? g.openHeight : g.sealedHeight
    }

    private init(content: LetterContent, width: CGFloat, maxHeight: CGFloat) {
        self.width = width
        self.maxHeight = max(maxHeight, 420)
        let inner = width - 32
        env = LetterEnvelopeMetrics(width: min(inner - 28, 326).rounded())
        let paperWidth = min(inner - 4, 346).rounded()

        // Sealed: the heading, the envelope, and "tap to open" under it.
        let top: CGFloat = 16
        headingY = top + 14
        let envTop = top + 28 + 22
        envSealedCenter = CGPoint(x: width / 2, y: envTop + env.height / 2)
        hintY = envTop + env.height + env.laceDepth + 16 + 11
        sealedHeight = (hintY + 11 + 18).rounded()

        // Open: the note on top, resting on the lower half of the envelope.
        // The note covers the top quarter of the open envelope, so its lined mouth and lace show
        // below; a long note may cover up to 40% to make room for a few more lines.
        let envRestHeight = env.height * restScale
        var paperTop: CGFloat = 30
        let tail = env.laceDepth * restScale + 16
        func visible(_ cover: CGFloat) -> CGFloat { (envRestHeight * (1 - cover)).rounded() }
        let roomy = self.maxHeight - paperTop - visible(0.24) - tail
        let cramped = self.maxHeight - paperTop - visible(0.40) - tail
        let firstTry = LetterPaperLayout.make(content: content, width: paperWidth, maxHeight: roomy)
        paper = firstTry.truncated && !content.truncated
            ? LetterPaperLayout.make(content: content, width: paperWidth, maxHeight: cramped)
            : firstTry
        let cover = min(0.40, max(0.24, 1 - (self.maxHeight - paperTop - tail - paper.height) / envRestHeight))
        let shown = visible(cover)
        let natural = paperTop + paper.height + shown + tail
        openHeight = max(sealedHeight, natural).rounded(.up)
        paperTop += ((openHeight - natural) / 2).rounded()
        paperRestCenter = CGPoint(x: width / 2, y: paperTop + paper.height / 2)
        let envRestTop = paperTop + paper.height + shown - envRestHeight
        envRestCenter = CGPoint(x: width / 2 + 3, y: envRestTop + env.height * restScale / 2)
        insideScale = min((env.width - 30) / paperWidth, (env.height - 26) / paper.foldedHeight, 0.92)

        // The note may only come forward once it is wholly out of the pocket: find that moment.
        var swap = 1.4
        var t = 0.7
        while t < 1.4 {
            let pose = self.pose(time: t, idle: 0)
            let paperBottom = pose.paperVisibleBottom
            // Clear of the envelope's top edge and of the lace standing up at its mouth.
            let envTop = pose.envCenter.y - env.height * pose.envScale / 2 - env.laceDepth * pose.envScale
            if paperBottom < envTop - 2 { swap = t; break }
            t += 1.0 / 240
        }
        swapTime = swap
    }

    // MARK: the pose at a moment

    struct Pose {
        var headingOpacity = 1.0
        var headingDY: CGFloat = 0
        var hintOpacity = 1.0
        var envCenter = CGPoint.zero
        var envScale: CGFloat = 1
        var envAngle = 0.0
        var groundOpacity = 1.0
        var flapAngle = 0.0
        var sealScale: CGFloat = 1
        var sealOpacity = 1.0
        var sealDY: CGFloat = 0
        var burst: Double?
        var loopLeft = 1.0
        var loopRight = 1.0
        var knotScale: CGFloat = 1
        var ribbonDrop: CGFloat = 0
        var ribbonOpacity = 1.0
        var tailSway = 0.0
        var tailSpread = 0.0
        var paperShown = false
        var paperShadowed = false
        var paperFront = false
        var paperCenter = CGPoint.zero
        var paperScale: CGFloat = 1
        var paperAngle = 0.0
        var paperLift = 0.0
        var paperVisibleBottom: CGFloat = 0
        var foldAngles: [Double] = []
        var heartsTime: Double?
        var twinkles: [Double] = [0, 0, 0, 0]
        var twinkleOpacity = 1.0
        var restSparkles = 0.0
        var atRest = false
    }

    func pose(time: Double?, idle: Double) -> Pose {
        typealias M = LetterMotion
        var p = Pose()
        let folds = paper.folds
        let foldedAngles: [Double] = folds == 3 ? [-180, 0, 180] : [0, 180]

        // The idle loop: a slow rock and float, the seal's heartbeat, the tails swaying, twinkles.
        let i = time == nil ? idle : idle
        let rock = 1.3 * sin(2 * .pi * i / 3.6)
        let float = CGFloat(-2.6 * sin(2 * .pi * i / 3.6 + 0.9))
        let beatPhase = i.truncatingRemainder(dividingBy: 2.8)
        let beat = 0.075 * M.bump(beatPhase / 0.34) + 0.045 * M.bump((beatPhase - 0.42) / 0.30)
        let sway = 2.6 * sin(2 * .pi * i / 3.1 + 0.6)
        let periods = [2.5, 3.2, 2.8, 3.6], phases = [0.0, 0.37, 0.71, 0.18]
        let twinkles = (0..<4).map { M.wave(i + (time ?? 0), period: periods[$0], phase: phases[$0]) }

        guard let t = time else {
            p.envCenter = CGPoint(x: envSealedCenter.x, y: envSealedCenter.y + float)
            p.envAngle = rock
            p.groundOpacity = 1 - Double(abs(float)) * 0.05
            p.sealScale = 1 + CGFloat(beat)
            p.tailSway = sway
            p.twinkles = twinkles
            // The folded note is already inside (hidden by the flap and pocket), so it is drawn
            // once while sealed rather than on the opening's first frames.
            p.paperShown = true
            p.foldAngles = foldedAngles
            p.paperScale = insideScale
            p.paperAngle = rock
            p.paperCenter = frameCenter(visibleCenter: insidePosition(envCenter: p.envCenter, envScale: 1), scale: insideScale)
            return p
        }

        if t >= LetterGeometry.duration { return restPose() }

        let idleLeft = 1 - M.easeInOut(M.progress(t, 0, 0.4))
        p.headingOpacity = 1 - M.easeOut(M.progress(t, 0, 0.35))
        p.headingDY = -8 * CGFloat(M.easeOut(M.progress(t, 0, 0.35)))
        p.hintOpacity = 1 - M.progress(t, 0, 0.22)
        p.twinkles = twinkles
        p.twinkleOpacity = 1 - M.progress(t, 0.1, 0.6)
        p.tailSway = sway * idleLeft

        // The envelope glides down to where it will rest, shrinking a touch as the note comes forward.
        let travel = M.glide(M.progress(t, 0.30, 1.30))
        p.envCenter = M.lerp(envSealedCenter, envRestCenter, travel)
        p.envCenter.y += float * CGFloat(idleLeft)
        p.envScale = M.lerp(1, restScale, travel)
        p.envAngle = rock * idleLeft + restEnvelopeAngle * M.glide(M.progress(t, 0.4, 1.5))
        p.groundOpacity = 1

        // The seal: a squeeze, then it pops.
        let squeeze = M.easeOut(M.progress(t, 0, 0.09))
        let pop = M.easeOut(M.progress(t, 0.09, 0.40))
        p.sealScale = t < 0.09 ? M.lerp(1 + CGFloat(beat * idleLeft), 0.86, squeeze) : M.lerp(0.86, 1.34, pop)
        p.sealOpacity = 1 - M.easeIn(M.progress(t, 0.15, 0.40))
        p.sealDY = -10 * CGFloat(pop)
        if t > 0.09, t < 0.9 { p.burst = M.progress(t, 0.09, 0.9) }

        // The bow unties: each loop pulls through, the knot slips, the band and tails slide off.
        p.loopLeft = 1 - M.easeIn(M.progress(t, 0.16, 0.36))
        p.loopRight = 1 - M.easeIn(M.progress(t, 0.22, 0.42))
        p.knotScale = 1 - CGFloat(M.easeIn(M.progress(t, 0.34, 0.50)))
        let fall = M.progress(t, 0.32, 0.62)
        p.ribbonDrop = 110 * CGFloat(M.easeIn(fall))
        p.ribbonOpacity = 1 - M.easeIn(M.progress(t, 0.40, 0.60))
        p.tailSpread = 16 * M.easeOut(fall)

        // The flap swings open on a spring, overshooting a little and settling back.
        if t > 0.50 { p.flapAngle = 180 * M.spring(t - 0.50, response: 0.62, damping: 0.74) }

        // The note: folded inside, then rising out, coming forward, unfolding and settling.
        p.paperShown = true
        p.paperShadowed = t > 0.45
        let foldedH = paper.foldedHeight
        let inside = insidePosition(envCenter: p.envCenter, envScale: p.envScale)
        let restVisible = visibleCenter(frameCenter: paperRestCenter, scale: 1)
        let target = CGPoint(x: restVisible.x, y: restVisible.y - lift)
        let rise = M.progress(t, 0.76, 1.50)
        let riseEase = M.glide(rise)
        var visible = M.lerp(inside, target, riseEase)
        let scale = M.lerp(insideScale * p.envScale, 1, M.easeInOut(M.progress(t, 0.86, 1.56)))
        var angle = M.lerp(p.envAngle, 0, riseEase) + 2.4 * M.bump(rise)

        // Unfolding, one fold after another, each on a soft spring.
        var angles = foldedAngles
        if folds == 3 {
            angles[0] = -180 * (1 - M.spring(t - 1.40, response: 0.56, damping: 0.8))
            angles[2] = 180 * (1 - M.spring(t - 1.60, response: 0.56, damping: 0.8))
        } else {
            angles[1] = 180 * (1 - M.spring(t - 1.42, response: 0.6, damping: 0.8))
        }
        p.foldAngles = angles

        // Settling: down onto the envelope with a small bounce, into its tilt.
        let settleT = t - 1.92
        if settleT > 0 {
            let drop = M.spring(settleT, response: 0.62, damping: 0.6)
            visible.y += lift * CGFloat(drop)
            angle = restPaperAngle * M.spring(settleT, response: 0.75, damping: 0.55)
        }
        p.paperScale = scale
        p.paperAngle = angle
        p.paperCenter = frameCenter(visibleCenter: visible, scale: scale)
        p.paperVisibleBottom = visible.y + foldedH * scale / 2
        p.paperLift = t < 1.92 ? M.easeOut(M.progress(t, 1.0, 1.5)) : 1 - M.easeOut(M.progress(t, 1.92, 2.5))
        p.paperFront = t >= swapTime

        if t > 0.84 { p.heartsTime = t - 0.84 }
        p.restSparkles = M.easeOut(M.progress(t, 2.1, 2.7))
        return p
    }

    func restPose() -> Pose {
        var p = Pose()
        p.atRest = true
        p.headingOpacity = 0
        p.hintOpacity = 0
        p.envCenter = envRestCenter
        p.envScale = restScale
        p.envAngle = restEnvelopeAngle
        p.flapAngle = 180
        p.sealOpacity = 0
        p.loopLeft = 0
        p.loopRight = 0
        p.knotScale = 0
        p.ribbonOpacity = 0
        p.paperShown = true
        p.paperShadowed = true
        p.paperFront = true
        p.paperCenter = paperRestCenter
        p.paperAngle = restPaperAngle
        p.foldAngles = Array(repeating: 0, count: paper.folds)
        p.twinkleOpacity = 0
        p.restSparkles = 1
        return p
    }

    /// Where the folded note sits inside the envelope: low in the pocket, clear of the edges.
    private func insidePosition(envCenter: CGPoint, envScale: CGFloat) -> CGPoint {
        let bottom = envCenter.y + env.height * envScale / 2 - 12 * env.k * envScale
        return CGPoint(x: envCenter.x, y: bottom - paper.foldedHeight * insideScale * envScale / 2)
    }

    /// The folded note's visible part: the middle third (in thirds) or the top half (in half).
    private func visibleCenter(frameCenter: CGPoint, scale: CGFloat) -> CGPoint {
        paper.folds == 2 ? CGPoint(x: frameCenter.x, y: frameCenter.y - paper.height / 4 * scale) : frameCenter
    }

    private func frameCenter(visibleCenter: CGPoint, scale: CGFloat) -> CGPoint {
        paper.folds == 2 ? CGPoint(x: visibleCenter.x, y: visibleCenter.y + paper.height / 4 * scale) : visibleCenter
    }
}

// MARK: - Drawing a pose

/// The whole card at one moment. `time` is nil while sealed (then `idle` drives the idle loop), the
/// seconds since the opening began while it opens, and anything ≥ LetterGeometry.duration at rest.
struct LetterScene: View {
    let content: LetterContent
    var time: Double?
    var idle: Double = 0
    let width: CGFloat
    var maxHeight: CGFloat = LetterGeometry.defaultMaxHeight

    var body: some View {
        let g = LetterGeometry.make(content: content, width: width, maxHeight: maxHeight)
        let p = g.pose(time: time, idle: idle)
        let m = g.env
        ZStack(alignment: .topLeading) {
            if p.headingOpacity > 0 {
                Text(content.heading)
                    .font(LetterFonts.font(.handBold, size: 23))
                    .foregroundColor(LetterPalette.plum)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(width: width - 48)
                    .position(x: width / 2, y: g.headingY + p.headingDY)
                    .opacity(p.headingOpacity)
            }
            if p.hintOpacity > 0 {
                Text("tap to open ❤️")
                    .font(LetterFonts.font(.hand, size: 19))
                    .foregroundColor(LetterPalette.softInk)
                    .position(x: width / 2, y: g.hintY)
                    .opacity(p.hintOpacity)
            }

            ground(g, p)

            // The inside of the envelope, and the flap once it has swung up.
            envelopeLayer(g, p) {
                ZStack(alignment: .topLeading) {
                    LetterEnvelopeBack(m: m).equatable()
                    if p.flapAngle >= 90 { flap(m, angle: p.flapAngle, inside: true) }
                }
            }
            .zIndex(1)

            if p.paperShown && !p.paperFront { paper(g, p).zIndex(2) }

            envelopeLayer(g, p) { LetterEnvelopePocket(m: m).equatable() }
                .zIndex(3)

            if p.flapAngle < 90 {
                envelopeLayer(g, p) {
                    ZStack(alignment: .topLeading) {
                        LetterFlapShadow(m: m).equatable().opacity(max(0, 1 - p.flapAngle / 50))
                        flap(m, angle: p.flapAngle, inside: false)
                    }
                }
                .zIndex(4)
            }

            if !p.atRest {
                envelopeLayer(g, p) { bow(m, p) }.zIndex(5)
                if let heartsTime = p.heartsTime { hearts(g, p, heartsTime).zIndex(6) }
            }

            if p.paperShown && p.paperFront { paper(g, p).zIndex(7) }

            sparkles(g, p).zIndex(8)
        }
        .frame(width: width, height: time == nil ? g.sealedHeight : g.openHeight, alignment: .topLeading)
    }

    // MARK: pieces

    private func envelopeLayer<Content: View>(_ g: LetterGeometry, _ p: LetterGeometry.Pose, @ViewBuilder _ content: () -> Content) -> some View {
        content()
            .frame(width: g.env.width, height: g.env.height, alignment: .topLeading)
            .scaleEffect(p.envScale)
            .rotationEffect(.degrees(p.envAngle))
            .position(p.envCenter)
    }

    private func flap(_ m: LetterEnvelopeMetrics, angle: Double, inside: Bool) -> some View {
        LetterFlapFace(m: m, inside: inside).equatable()
            .rotation3DEffect(.degrees(angle), axis: (x: 1, y: 0, z: 0), anchor: .top, perspective: 0.55)
    }

    private func ground(_ g: LetterGeometry, _ p: LetterGeometry.Pose) -> some View {
        Ellipse()
            .fill(RadialGradient(colors: [LetterPalette.plum.opacity(0.16), LetterPalette.plum.opacity(0)],
                                 center: .center, startRadius: 0, endRadius: g.env.width * 0.5))
            .frame(width: g.env.width * 1.05 * p.envScale, height: 26 * p.envScale)
            .position(x: p.envCenter.x, y: p.envCenter.y + g.env.height * p.envScale / 2 + 10)
            .opacity(p.groundOpacity)
    }

    private func bow(_ m: LetterEnvelopeMetrics, _ p: LetterGeometry.Pose) -> some View {
        let knot = m.knot
        let tailFrame = CGSize(width: m.tailWidth * 2.6, height: m.tailLength + m.tailWidth)
        let loopFrame = LetterBowLoop.frame(m)
        return ZStack(alignment: .topLeading) {
            Group {
                LetterRibbonBand(m: m).equatable()
                    .position(x: m.width / 2, y: m.height / 2 + p.ribbonDrop)
                ForEach([-1.0, 1.0], id: \.self) { side in
                    LetterBowTail(m: m).equatable()
                        .scaleEffect(x: side < 0 ? 1 : -1)
                        .rotationEffect(.degrees(-side * (24 + p.tailSpread) + p.tailSway * (side < 0 ? 1 : 0.8)), anchor: .top)
                        .position(x: knot.x, y: knot.y + tailFrame.height / 2 - 6 * m.k + p.ribbonDrop)
                }
            }
            .opacity(p.ribbonOpacity)

            ForEach([-1.0, 1.0], id: \.self) { side in
                let v = side < 0 ? p.loopLeft : p.loopRight
                if v > 0.001 {
                    LetterBowLoop(m: m).equatable()
                        .scaleEffect(x: CGFloat(v), y: CGFloat(0.55 + 0.45 * v), anchor: .leading)
                        .rotationEffect(.degrees(-13 - (1 - v) * 28), anchor: .leading)
                        .scaleEffect(x: side < 0 ? -1 : 1, anchor: .leading)
                        .opacity(min(1, v * 2.5))
                        .position(x: knot.x + loopFrame.width / 2 - 5 * m.k, y: knot.y - 2 * m.k)
                }
            }
            if p.knotScale > 0.01 {
                LetterBowKnot(m: m).equatable()
                    .scaleEffect(p.knotScale)
                    .position(knot)
            }
            if p.sealOpacity > 0.001 {
                LetterWaxSeal(size: m.sealSize).equatable()
                    .scaleEffect(p.sealScale)
                    .opacity(p.sealOpacity)
                    .position(x: knot.x, y: knot.y + p.sealDY)
            }
            if let burst = p.burst { self.burst(m, burst) }
        }
        .frame(width: m.width, height: m.height, alignment: .topLeading)
    }

    /// Hearts and sparkles puffing out of the seal as it pops.
    private func burst(_ m: LetterEnvelopeMetrics, _ u: Double) -> some View {
        let count = 10
        return ZStack {
            ForEach(0..<count, id: \.self) { index in
                let a = (Double(index) / Double(count) + 0.03) * 2 * Double.pi
                let reach = (index.isMultiple(of: 2) ? 52.0 : 40.0) * Double(m.k)
                let d = reach * LetterMotion.easeOut(LetterMotion.progress(u, 0, 0.75))
                let s = 0.4 + 0.8 * LetterMotion.easeOut(LetterMotion.progress(u, 0, 0.3)) - 0.4 * LetterMotion.progress(u, 0.4, 1)
                let o = 1 - LetterMotion.easeIn(LetterMotion.progress(u, 0.45, 1))
                Group {
                    if index.isMultiple(of: 2) {
                        LetterRedHeart(size: 11 * m.k).equatable()
                    } else {
                        LetterSparkle().fill(LetterPalette.sparkle).frame(width: 11 * m.k, height: 13 * m.k)
                    }
                }
                .scaleEffect(s)
                .opacity(o)
                .offset(x: CGFloat(cos(a) * d), y: CGFloat(sin(a) * d) - CGFloat(10 * u))
            }
        }
        .position(m.knot)
    }

    /// Red hearts drifting up out of the envelope's mouth as the note comes out.
    private func hearts(_ g: LetterGeometry, _ p: LetterGeometry.Pose, _ time: Double) -> some View {
        let specs: [(x: CGFloat, delay: Double, size: CGFloat, rise: CGFloat, drift: CGFloat)] = [
            (-0.30, 0.00, 14, 96, -10), (0.22, 0.08, 16, 120, 8), (-0.08, 0.16, 12, 84, 6),
            (0.34, 0.26, 12, 90, 10), (-0.20, 0.34, 15, 110, -6),
        ]
        let k = g.env.k
        let mouthY = p.envCenter.y - g.env.height * p.envScale / 2
        return ZStack(alignment: .topLeading) {
            ForEach(specs.indices, id: \.self) { index in
                let spec = specs[index]
                let u = LetterMotion.progress(time - spec.delay, 0, 1.15)
                if u > 0, u < 1 {
                    let grow = LetterMotion.easeOut(LetterMotion.progress(u, 0, 0.3))
                    let fade = 1 - LetterMotion.easeIn(LetterMotion.progress(u, 0.55, 1))
                    LetterRedHeart(size: spec.size * k).equatable()
                        .scaleEffect(0.35 + 0.65 * grow)
                        .rotationEffect(.degrees(Double(spec.drift) * sin(u * 5)))
                        .opacity(min(1, u * 8) * fade)
                        .position(x: p.envCenter.x + spec.x * g.env.width * p.envScale + spec.drift * CGFloat(sin(u * .pi * 1.5)),
                                  y: mouthY + 6 - spec.rise * k * CGFloat(LetterMotion.easeOut(u)))
                }
            }
        }
    }

    private func paper(_ g: LetterGeometry, _ p: LetterGeometry.Pose) -> some View {
        let lift = p.paperLift
        let shadowed = p.paperShadowed
        return LetterPaperSheet(layout: g.paper, angles: p.foldAngles).equatable()
            .compositingGroup()
            .shadow(color: LetterPalette.rgb(0xe3d3ec, shadowed ? 0.9 * (1 - lift) : 0), radius: 0, x: 3, y: 4)
            .shadow(color: LetterPalette.plum.opacity(shadowed ? 0.10 + 0.06 * lift : 0), radius: shadowed ? CGFloat(5 + 9 * lift) : 0, x: 0, y: CGFloat(3 + 9 * lift))
            .scaleEffect(p.paperScale)
            .rotationEffect(.degrees(p.paperAngle))
            .position(p.paperCenter)
    }

    /// Twinkles around the sealed envelope (fading as it opens) and two that catch the light at rest.
    private func sparkles(_ g: LetterGeometry, _ p: LetterGeometry.Pose) -> some View {
        let w = g.env.width, h = g.env.height
        let spots: [(x: CGFloat, y: CGFloat, size: CGFloat)] = [
            (0.50, -0.50, 17), (-0.55, -0.12, 12), (0.53, 0.42, 10), (-0.40, -0.62, 9),
        ]
        return ZStack(alignment: .topLeading) {
            if p.twinkleOpacity > 0.001 {
                ForEach(spots.indices, id: \.self) { index in
                    let spot = spots[index]
                    let v = p.twinkles[index]
                    LetterSparkle()
                        .fill(index.isMultiple(of: 2) ? LetterPalette.sparkle : LetterPalette.sparkleLight)
                        .frame(width: spot.size * g.env.k, height: spot.size * 1.2 * g.env.k)
                        .scaleEffect(0.45 + 0.55 * v)
                        .opacity((0.3 + 0.7 * v) * p.twinkleOpacity)
                        .position(x: g.envSealedCenter.x + spot.x * w, y: p.envCenter.y + spot.y * h)
                }
            }
            if p.restSparkles > 0.001 {
                let paperTop = g.paperRestCenter.y - g.paper.height / 2
                let left = g.paperRestCenter.x - g.paper.width / 2
                let right = g.paperRestCenter.x + g.paper.width / 2
                let envRight = g.envRestCenter.x + g.env.width * g.restScale / 2
                let envLeft = g.envRestCenter.x - g.env.width * g.restScale / 2
                let rest: [(x: CGFloat, y: CGFloat, size: CGFloat, color: Color)] = [
                    (right + 1, paperTop - 9, 15, LetterPalette.sparkle),
                    (left - 6, paperTop + 26, 9, LetterPalette.sparkleLight),
                    (envRight + 12, g.envRestCenter.y + 4, 12, LetterPalette.sparkleLight),
                    (envLeft - 10, g.envRestCenter.y + 30, 8, LetterPalette.sparkle),
                ]
                ForEach(rest.indices, id: \.self) { index in
                    let spot = rest[index]
                    LetterSparkle().fill(spot.color)
                        .frame(width: spot.size, height: spot.size * 1.2)
                        .scaleEffect(CGFloat(p.restSparkles))
                        .opacity(p.restSparkles)
                        .position(x: spot.x, y: spot.y)
                }
            }
        }
    }
}
