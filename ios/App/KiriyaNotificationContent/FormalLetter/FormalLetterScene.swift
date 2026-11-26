import SwiftUI

// The formal letter's whole performance as a pure function of time: FormalLetterGeometry lays the
// card out for a letter and a width, FormalLetterGeometry.pose(time:idle:wiggle:) says where every
// piece is at a given moment, and FormalLetterScene draws that pose. FormalLetterCard only supplies
// the clock.
//
// The opening, in seconds (FormalLetterGeometry.duration in all):
//   0.00  a light press on the envelope; a glint runs over the wax
//   0.20  the seal breaks (a chip stays on the envelope, a few crumbs fall) and the flap's tip springs up
//   0.27  the flap swings over like heavy paper, carrying the seal away with it and showing its
//         plum liner
//   0.55  the envelope glides down to make room
//   0.85  the folded letter rises out of the envelope
//   1.45  clear of it, the letter comes forward to the front
//   1.75  the empty envelope, its flap relaxing, tucks itself away behind the letter
//   2.00  it unfolds: the top third, then (2.25) the bottom third
//   2.65  it settles, the envelope now hidden behind it
//   3.20  at rest

struct FormalLetterGeometry {
    static let duration: Double = 3.2
    /// The tallest the open card gets by default (the host caps the notification at 720pt).
    static let defaultMaxHeight: CGFloat = 700
    static let margin: CGFloat = 14

    let width: CGFloat
    let maxHeight: CGFloat
    let locked: Bool
    let env: FormalLetterEnvelopeMetrics
    let paper: FormalLetterPaperLayout
    let sealedHeight: CGFloat
    let openHeight: CGFloat
    let headingY: CGFloat
    let hintY: CGFloat
    let envSealedCenter: CGPoint
    /// Where the envelope waits while the letter rises out of it (just under the letter's place).
    let envReceiveCenter: CGPoint
    let envReceiveScale: CGFloat = 0.9
    /// Where it ends: tucked away behind the open letter.
    let envRestCenter: CGPoint
    let envRestScale: CGFloat
    let paperRestCenter: CGPoint
    let insideScale: CGFloat
    let lift: CGFloat = 10
    let envelopeLines: (primary: String, secondary: String?)
    /// A locked letter's gold date seal on the envelope.
    let dateSeal: (day: String, month: String)?
    private(set) var swapTime: Double = 1.5

    private static let lock = NSLock()
    nonisolated(unsafe) private static var cache: [String: FormalLetterGeometry] = [:]  // guarded by `lock`

    static func make(content: FormalLetterContent, width: CGFloat, maxHeight: CGFloat = defaultMaxHeight,
                     scrollable: Bool = true, locked: Bool = false) -> FormalLetterGeometry {
        let key = "\(width)|\(maxHeight)|\(scrollable)|\(locked)|\(content.heading)|\(content.title)|\(content.openWhen ?? "∅")|\(content.from)|\(content.kind ?? "∅")|\(content.date?.timeIntervalSince1970 ?? 0)|\(content.lockedUntil?.timeIntervalSince1970 ?? 0)|\(content.truncated)|\(content.text)"
        lock.lock()
        if let hit = cache[key] { lock.unlock(); return hit }
        lock.unlock()
        let made = FormalLetterGeometry(content: content, width: width, maxHeight: maxHeight, scrollable: scrollable, locked: locked)
        lock.lock()
        if cache.count > 16 { cache.removeAll() }
        cache[key] = made
        lock.unlock()
        return made
    }

    static func height(content: FormalLetterContent, width: CGFloat, open: Bool, maxHeight: CGFloat = defaultMaxHeight,
                       scrollable: Bool = true, locked: Bool = false) -> CGFloat {
        let g = make(content: content, width: width, maxHeight: maxHeight, scrollable: scrollable, locked: locked)
        return open && !locked ? g.openHeight : g.sealedHeight
    }

    private init(content: FormalLetterContent, width: CGFloat, maxHeight: CGFloat, scrollable: Bool, locked: Bool) {
        self.width = width
        self.maxHeight = max(maxHeight, 420)
        self.locked = locked
        let margin = Self.margin
        var metrics = FormalLetterEnvelopeMetrics(width: min(width - 48, 336).rounded())
        if content.isFromMaomao { metrics.tone = .night }
        env = metrics
        envelopeLines = content.envelopeLines
        if locked, let until = content.lockedUntil {
            let format = DateFormatter()
            format.locale = Locale(identifier: "en_GB")
            format.timeZone = TimeZone(identifier: "Asia/Singapore") ?? .current
            format.dateFormat = "d"
            let day = format.string(from: until)
            format.dateFormat = "MMM"
            dateSeal = (day, format.string(from: until))
        } else {
            dateSeal = nil
        }
        let paperWidth = (width - 2 * margin).rounded()

        // Sealed: the heading, the envelope, and a line under it.
        let top: CGFloat = 14
        headingY = top + 17
        let hasHeading = !content.heading.trimmingCharacters(in: .whitespaces).isEmpty
        let envTop = top + (hasHeading ? 46 : 12)
        envSealedCenter = CGPoint(x: width / 2, y: envTop + env.height / 2)
        hintY = envTop + env.height + 31
        sealedHeight = (hintY + 27).rounded()

        // Open: the letter, centred, with the envelope tucked away behind it.
        paper = FormalLetterPaperLayout.make(content: content, width: paperWidth, maxHeight: self.maxHeight - 2 * margin, scrollable: scrollable)
        let natural = paper.height + 2 * margin
        openHeight = max(sealedHeight, natural).rounded(.up)
        let paperTop = margin + ((openHeight - natural) / 2).rounded()
        paperRestCenter = CGPoint(x: width / 2, y: paperTop + paper.height / 2)
        // At rest the envelope (open flap and all) lies behind the letter's middle and bottom thirds,
        // so not even the flap's tip shows above the folded letter while it unfolds.
        let middleTop = paperTop + paper.foldedHeight
        let room = paperTop + paper.height - 10 - (middleTop + 4)
        envRestScale = max(0.6, min(0.86, (paperWidth - 26) / env.width, room / (env.height + env.flapDepth)))
        envRestCenter = CGPoint(x: width / 2, y: middleTop + 4 + (env.height / 2 + env.flapDepth) * envRestScale)
        // The letter rises straight out of the envelope into its place, so the envelope goes to wait
        // just under that place (as far as the card allows; on a short card it then tucks up behind).
        let receiveHalf = env.height * 0.9 / 2
        let ideal = paperRestCenter.y + paper.foldedHeight / 2 + 12 + receiveHalf
        envReceiveCenter = CGPoint(x: width / 2, y: max(envSealedCenter.y, min(ideal, openHeight - receiveHalf - 10)))
        insideScale = min((env.width - 26) / paperWidth, (env.height - 20) / paper.foldedHeight, 0.95)

        // The letter may only come to the front once it's wholly out of the envelope: find that moment.
        var swap = 1.6
        var t = 0.85
        while t < 1.9 {
            let pose = self.pose(time: t, idle: 0)
            let envTop = pose.envCenter.y - env.height * pose.envScale / 2
            if pose.paperVisibleBottom < envTop - 1 { swap = t; break }
            t += 1.0 / 240
        }
        swapTime = swap
    }

    // MARK: the pose at a moment

    struct Pose {
        var headingOpacity = 1.0
        var headingDY: CGFloat = 0
        var hintOpacity = 1.0
        var envShown = true
        var envCenter = CGPoint.zero
        var envScale: CGFloat = 1
        var envAngle = 0.0
        var groundOpacity = 1.0
        var groundSpread: CGFloat = 1
        var flapAngle = 0.0
        var cracked = false
        var sealScale: CGFloat = 1
        var glint: Double?
        var crumbs: Double?
        var paperShown = true
        var paperFront = false
        var paperCenter = CGPoint.zero
        var paperScale: CGFloat = 1
        var paperVisibleBottom: CGFloat = 0
        var foldAngles: [Double] = [-180, 180]
        var paperLift = 0.0
        var paperShadowed = false
        var atRest = false
        /// The crest's kitten (an ear flick as the letter settles) and the signature heart's beat.
        var kitten = FormalLetterKittenPose.rest
        var heartScale: CGFloat = 1
        /// Seconds since the petals began to drift out of the fold (nil when there are none).
        var petals: Double?
    }

    /// `time` nil: sealed (the idle loop runs on `idle`, and `wiggle` is the seconds since a tap on a
    /// locked letter). Otherwise the seconds since the opening began.
    func pose(time: Double?, idle: Double, wiggle: Double? = nil) -> Pose {
        typealias M = FormalLetterMotion
        var p = Pose()

        // The idle loop: a slow breath (the envelope rising a point or so, its shadow softening) and,
        // once a cycle, a glint of light across the wax.
        let cycle = 5.6
        let phase = idle.truncatingRemainder(dividingBy: cycle)
        let breath = M.wave(idle, period: cycle, phase: 0.25)
        let float = -1.6 * CGFloat(breath)
        let glint = M.progress(phase, 2.2, 3.4)

        guard let t = time else {
            p.envCenter = CGPoint(x: envSealedCenter.x, y: envSealedCenter.y + float)
            p.groundOpacity = 1 - 0.22 * breath
            p.groundSpread = 1 + 0.025 * CGFloat(breath)
            if glint > 0, glint < 1 { p.glint = glint }
            if let wiggle, wiggle >= 0, wiggle < 0.8 {
                // "Not yet": a small shake, quickly still again.
                let decay = exp(-wiggle * 6)
                p.envAngle = 2.4 * sin(2 * Double.pi * wiggle / 0.2) * decay
                p.envCenter.x += CGFloat(2.2 * sin(2 * Double.pi * wiggle / 0.2 + 0.4) * decay)
                p.hintOpacity = 1
            }
            // The folded letter is already inside (hidden by the flap and pocket), so it's drawn
            // once while sealed rather than on the opening's first frames.
            p.paperScale = insideScale
            p.paperCenter = insidePosition(envCenter: p.envCenter, envScale: 1)
            p.paperVisibleBottom = p.paperCenter.y + paper.foldedHeight * insideScale / 2
            return p
        }

        if t >= Self.duration { return restPose() }

        p.headingOpacity = 1 - M.easeOut(M.progress(t, 0, 0.4))
        p.headingDY = -8 * CGFloat(M.easeOut(M.progress(t, 0, 0.4)))
        p.hintOpacity = 1 - M.progress(t, 0, 0.25)
        let idleLeft = 1 - M.easeInOut(M.progress(t, 0, 0.4))

        // A light press, as if a fingertip touched the seal.
        let press = M.bump(M.progress(t, 0, 0.34))
        p.envScale = 1 - 0.014 * CGFloat(press)
        p.sealScale = 1 - 0.03 * CGFloat(M.bump(M.progress(t, 0.02, 0.26)))
        let quickGlint = M.progress(t, 0, 0.32)
        if quickGlint < 1 { p.glint = quickGlint }

        // The seal breaks, and the flap lifts like heavy paper (no bounce), past upright to open flat.
        p.cracked = t >= 0.2
        if t >= 0.2 { p.crumbs = t - 0.2 }
        // The tip springs up a little as the wax lets go, then the flap swings over.
        p.flapAngle = 24 * M.easeOut(M.progress(t, 0.2, 0.38)) + 156 * M.glide(M.progress(t, 0.3, 1.12))
        // Once the letter is out, the empty envelope's flap relaxes a little as it's laid aside.
        p.flapAngle -= 60 * M.glide(M.progress(t, 1.55, 2.2))

        // The envelope glides down (and back a little) to make room, then, once the letter is out
        // and in front, tucks itself away behind it.
        let travel = M.glide(M.progress(t, 0.5, 1.45))
        let tuck = M.glide(M.progress(t, 1.75, 2.45))
        p.envCenter = M.lerp(M.lerp(envSealedCenter, envReceiveCenter, travel), envRestCenter, tuck)
        p.envCenter.y += float * CGFloat(idleLeft)
        p.envScale *= M.lerp(M.lerp(1, envReceiveScale, travel), envRestScale, tuck)
        p.groundOpacity = 1 - M.easeInOut(M.progress(t, 1.0, 1.9))

        // The letter: inside, rising out, coming to the front and forward, unfolding, settling.
        let inside = insidePosition(envCenter: p.envCenter, envScale: p.envScale)
        let rise = M.glide(M.progress(t, 0.9, 1.75))
        let envTop = p.envCenter.y - env.height * p.envScale / 2
        let foldedInside = paper.foldedHeight * insideScale * p.envScale
        let out = CGPoint(x: inside.x, y: envTop - foldedInside / 2 - 8)
        var position = M.lerp(inside, out, rise)
        let restLifted = CGPoint(x: paperRestCenter.x, y: paperRestCenter.y - lift)
        let forward = M.glide(M.progress(t, 1.5, 2.3))
        position = M.lerp(position, restLifted, forward)
        var scale = M.lerp(insideScale * p.envScale, 1, M.easeInOut(M.progress(t, 1.45, 2.3)))

        // Settling down onto the envelope, softly.
        let settle = M.progress(t, 2.6, 3.15)
        position.y += lift * CGFloat(M.easeInOut(settle))
        scale *= 1 + 0.008 * CGFloat(M.bump(M.progress(t, 2.0, 2.9)))

        p.paperCenter = position
        p.paperScale = scale
        p.paperVisibleBottom = position.y + paper.foldedHeight * scale / 2
        p.paperFront = t >= swapTime
        p.paperShadowed = t > 0.7
        p.paperLift = M.easeOut(M.progress(t, 1.2, 2.0)) * (1 - M.easeInOut(settle))

        // A few petals that were pressed inside drift out as the top third opens.
        if t > 2.08, t < 3.05 { p.petals = t - 2.08 }
        // As it settles: the kitten flicks an ear (twice), and the heart gives one "lub-dub".
        p.kitten.ear = 15 * M.bump(M.progress(t, 2.62, 2.84)) + 9 * M.bump(M.progress(t, 2.88, 3.06))
        p.heartScale = 1 + 0.26 * CGFloat(M.bump(M.progress(t, 2.76, 2.96))) + 0.13 * CGFloat(M.bump(M.progress(t, 2.98, 3.14)))

        // Unfolding: the top third, then the bottom third, each on a soft, well-damped spring.
        // (The springs' last fraction of a degree is eased out, so the folds lie exactly flat
        // before the letter comes to rest.)
        let flatten = 1 - M.smoothstep(M.progress(t, 2.85, 3.15))
        p.foldAngles = [
            -180 * (1 - M.spring(t - 2.0, response: 0.72, damping: 0.86)) * flatten,
            180 * (1 - M.spring(t - 2.25, response: 0.72, damping: 0.86)) * flatten,
        ].map { abs($0) < 0.02 ? 0 : $0 }
        return p
    }

    func restPose() -> Pose {
        var p = Pose()
        p.atRest = true
        p.headingOpacity = 0
        p.hintOpacity = 0
        p.envShown = false
        p.envCenter = envRestCenter
        p.envScale = envRestScale
        p.flapAngle = 180
        p.cracked = true
        p.groundOpacity = 0
        p.paperFront = true
        p.paperShadowed = true
        p.paperCenter = paperRestCenter
        p.foldAngles = [0, 0]
        return p
    }

    /// Where the folded letter sits inside the envelope: low in the pocket, clear of the edges.
    private func insidePosition(envCenter: CGPoint, envScale: CGFloat) -> CGPoint {
        let bottom = envCenter.y + env.height * envScale / 2 - 9 * env.k * envScale
        return CGPoint(x: envCenter.x, y: bottom - paper.foldedHeight * insideScale * envScale / 2)
    }
}

// MARK: - Drawing a pose

/// The whole card at one moment. `time` is nil while sealed (then `idle` drives the idle loop and
/// `wiggle` a locked letter's "not yet"), the seconds since the opening began while it opens, and
/// anything ≥ FormalLetterGeometry.duration at rest. `interactive` gives a resting long letter its
/// live scrolling body.
struct FormalLetterScene: View {
    let content: FormalLetterContent
    var time: Double?
    var idle: Double = 0
    var wiggle: Double?
    let width: CGFloat
    var maxHeight: CGFloat = FormalLetterGeometry.defaultMaxHeight
    var scrollable: Bool = true
    var locked: Bool = false
    var interactive: Bool = false
    /// 0...1: a locked letter's date line darkening for a moment (its "not yet" with Reduce Motion).
    var emphasis: Double = 0
    /// At rest: when the letter came to rest (the crest kitten's live clock), or, for rendering a
    /// frame, the seconds since then.
    var restSince: Date?
    var restTime: Double?

    var body: some View {
        let g = FormalLetterGeometry.make(content: content, width: width, maxHeight: maxHeight, scrollable: scrollable, locked: locked)
        let p = g.pose(time: locked ? nil : time, idle: idle, wiggle: wiggle)
        let m = g.env
        ZStack(alignment: .topLeading) {
            if p.headingOpacity > 0 && !content.heading.trimmingCharacters(in: .whitespaces).isEmpty { heading(g, p) }
            if p.hintOpacity > 0 { hint(g, p) }

            // Everything the opening will show is mounted from the start (faces not yet showing
            // are all but transparent), so each piece is drawn once while the letter waits rather
            // than on the frame it first appears.
            if p.envShown {
                ground(g, p)
                // The inside of the envelope, and the flap's lined inside once it has swung up.
                envelopeLayer(g, p) {
                    ZStack(alignment: .topLeading) {
                        FormalLetterEnvelopeBack(m: m).equatable()
                        flap(m, p, inside: true).opacity(p.flapAngle >= 90 ? 1 : Self.unseen)
                    }
                }
                .zIndex(1)
                envelopeLayer(g, p) {
                    FormalLetterEnvelopePocket(m: m, primary: g.envelopeLines.primary, secondary: g.envelopeLines.secondary, dateSeal: g.dateSeal).equatable()
                }
                .zIndex(3)
                // A small echo of the flowers, pressed on the pocket (it stays with the envelope).
                envelopeLayer(g, p) {
                    let frame = FormalLetterSpray.frame(.echo, k: m.k)
                    FormalLetterSpray(arrangement: .echo, k: m.k, night: m.tone == .night).equatable()
                        .offset(x: m.echoBinding.x - frame.width / 2, y: m.echoBinding.y - frame.height / 2)
                }
                .zIndex(3.5)
                envelopeLayer(g, p) {
                    ZStack(alignment: .topLeading) {
                        FormalLetterFlapShadow(m: m).equatable().opacity(max(0, 1 - p.flapAngle / 40))
                        flap(m, p, inside: false).opacity(p.flapAngle < 90 ? 1 : Self.unseen)
                    }
                }
                .zIndex(4)
                envelopeLayer(g, p) { seal(m, p) }.zIndex(5)
            }

            // One letter view throughout (in the pocket, then in front), so it's never rebuilt.
            // (At rest a long letter's scrolling paper takes over, and this one is let go.)
            if p.paperShown && !(p.atRest && interactive && g.paper.scrolls) {
                paper(g, p)
                    .zIndex(p.paperFront ? 7 : 2)
            }
            if let petals = p.petals { self.petals(g, p, petals).zIndex(7.5) }
            if interactive && g.paper.scrolls && p.atRest {
                // The resting letter with its live scrolling body. It takes over only once
                // everything is still, so even a slow first draw can't show as a hitch.
                resting(g).zIndex(8)
            }
        }
        .frame(width: width, height: time == nil || locked ? g.sealedHeight : g.openHeight, alignment: .topLeading)
    }

    // MARK: pieces

    private func heading(_ g: FormalLetterGeometry, _ p: FormalLetterGeometry.Pose) -> some View {
        HStack(spacing: 10) {
            ornamentLine(flipped: false)
            Text(content.heading)
                .font(FormalLetterFonts.font(.italic, size: 22))
                .foregroundColor(FormalLetterPalette.plum)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .layoutPriority(1)
            ornamentLine(flipped: true)
        }
        .frame(width: width - 40)
        .position(x: width / 2, y: g.headingY + p.headingDY)
        .opacity(p.headingOpacity)
    }

    private func ornamentLine(flipped: Bool) -> some View {
        Canvas { ctx, size in
            var line = Path()
            line.move(to: CGPoint(x: 0, y: size.height / 2))
            line.addLine(to: CGPoint(x: size.width - 4, y: size.height / 2))
            let colors = [FormalLetterPalette.gold.opacity(0), FormalLetterPalette.gold.opacity(0.9)]
            ctx.stroke(line, with: .linearGradient(Gradient(colors: colors), startPoint: .zero, endPoint: CGPoint(x: size.width, y: 0)), lineWidth: 0.8)
            ctx.fill(Path(ellipseIn: CGRect(x: size.width - 2.4, y: size.height / 2 - 1.2, width: 2.4, height: 2.4)), with: .color(FormalLetterPalette.gold))
        }
        .frame(width: 26, height: 6)
        .scaleEffect(x: flipped ? -1 : 1)
    }

    private func hint(_ g: FormalLetterGeometry, _ p: FormalLetterGeometry.Pose) -> some View {
        let words: Text
        if g.locked, let line = content.lockedLine() {
            words = Text(line)
                .font(FormalLetterFonts.font(.text, size: 15.5, smallCaps: true))
                .tracking(1.2)
                .foregroundColor(emphasis > 0.5 ? FormalLetterPalette.plum : FormalLetterPalette.soft)
        } else {
            words = Text("tap to break the seal")
                .font(FormalLetterFonts.font(.italic, size: 18))
                .foregroundColor(FormalLetterPalette.soft)
        }
        return words
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .frame(width: width - 40)
            .position(x: width / 2, y: g.hintY)
            .opacity(p.hintOpacity)
    }

    private func envelopeLayer<Content: View>(_ g: FormalLetterGeometry, _ p: FormalLetterGeometry.Pose, @ViewBuilder _ content: () -> Content) -> some View {
        content()
            .frame(width: g.env.width, height: g.env.height, alignment: .topLeading)
            .scaleEffect(p.envScale)
            .rotationEffect(.degrees(p.envAngle))
            .position(p.envCenter)
    }

    private func ground(_ g: FormalLetterGeometry, _ p: FormalLetterGeometry.Pose) -> some View {
        // As the envelope breathes up a point, its shadow drops and softens a touch.
        FormalLetterEnvelopeShadow(m: g.env).equatable()
            .scaleEffect(p.envScale * p.groundSpread)
            .rotationEffect(.degrees(p.envAngle))
            .position(x: p.envCenter.x, y: p.envCenter.y + (p.groundSpread - 1) * 40)
            .opacity(p.groundOpacity)
    }

    private func flap(_ m: FormalLetterEnvelopeMetrics, _ p: FormalLetterGeometry.Pose, inside: Bool) -> some View {
        let sealFrame = FormalLetterWaxSeal.frameSize(m.sealDiameter)
        let spray = FormalLetterSpray.frame(.seal, k: m.k)
        return ZStack(alignment: .topLeading) {
            FormalLetterFlapFace(m: m, inside: inside).equatable()
            if !inside {
                // The pressed flowers are tucked under the wax on the flap, so they lift away with it.
                FormalLetterSpray(arrangement: .seal, k: m.k, night: m.tone == .night).equatable()
                    .offset(x: m.sprayBinding.x - spray.width / 2, y: m.sprayBinding.y - spray.height / 2)
            }
            if !inside {
                // The seal's upper piece rides away on the flap.
                FormalLetterWaxSeal(diameter: m.sealDiameter, piece: .upper).equatable()
                    .offset(x: m.sealCenter.x - sealFrame / 2, y: m.sealCenter.y - sealFrame / 2)
                    .opacity(p.cracked ? 1 : Self.unseen)
            }
        }
        .frame(width: m.width, height: m.flapFrameHeight, alignment: .topLeading)
        .rotation3DEffect(.degrees(p.flapAngle), axis: (x: 1, y: 0, z: 0), anchor: .top, perspective: 0.5)
    }

    private func seal(_ m: FormalLetterEnvelopeMetrics, _ p: FormalLetterGeometry.Pose) -> some View {
        ZStack(alignment: .topLeading) {
            FormalLetterWaxSeal(diameter: m.sealDiameter, piece: .lower).equatable()
                .position(m.sealCenter)
                .opacity(p.cracked ? 1 : Self.unseen)
            crumbs(m, p.crumbs)
            FormalLetterWaxSeal(diameter: m.sealDiameter, piece: .whole).equatable()
                .scaleEffect(p.sealScale)
                .position(m.sealCenter)
                .opacity(p.cracked ? Self.unseen : 1)
            if let glint = p.glint, !p.cracked {
                FormalLetterSealGlint(diameter: m.sealDiameter, u: glint)
                    .scaleEffect(p.sealScale)
                    .position(m.sealCenter)
            }
        }
        .frame(width: m.width, height: m.height, alignment: .topLeading)
    }

    /// Three crumbs of wax knocked loose by the break, tumbling down off the envelope.
    private func crumbs(_ m: FormalLetterEnvelopeMetrics, _ time: Double?) -> some View {
        let specs: [(x: CGFloat, vx: CGFloat, vy: CGFloat, size: CGFloat, spin: Double)] = [
            (-0.55, -22, -26, 3.4, -260), (0.42, 26, -18, 2.8, 300), (0.1, 6, -30, 2.4, 200),
        ]
        let r = m.sealDiameter / 2
        let u = min(time ?? 0, 0.75)
        let shown = time.map { $0 < 0.75 } ?? false
        return ZStack(alignment: .topLeading) {
            ForEach(specs.indices, id: \.self) { index in
                let spec = specs[index]
                let x = m.sealCenter.x + spec.x * r + spec.vx * CGFloat(u) * m.k
                let y = m.sealCenter.y + r * 0.35 + (spec.vy * CGFloat(u) + 0.5 * 520 * CGFloat(u * u)) * m.k
                FormalLetterWaxCrumb(size: spec.size * m.k, shape: index).equatable()
                    .rotationEffect(.degrees(spec.spin * u))
                    .opacity(shown ? 1 - FormalLetterMotion.easeIn(FormalLetterMotion.progress(u, 0.35, 0.75)) : Self.unseen)
                    .position(x: x, y: y)
            }
        }
    }

    private func paper(_ g: FormalLetterGeometry, _ p: FormalLetterGeometry.Pose) -> some View {
        var kitten = p.kitten
        if p.atRest, let restTime { kitten = FormalLetterPeek.pose(at: restTime) }
        let live = p.atRest && interactive ? restSince.map { FormalLetterLiveKitten(since: $0) } : nil
        return FormalLetterSheet(layout: g.paper, angles: p.foldAngles, kitten: kitten, heartScale: p.heartScale, live: live).equatable()
            .modifier(FormalLetterPaperShadow(shadowed: p.paperShadowed, lift: p.paperLift))
            .scaleEffect(p.paperScale)
            .position(p.paperCenter)
    }

    /// Five petals slip out of the fold as the top third lifts, puff up a little, then drift down
    /// and out towards the paper's edges, turning, and fade before the letter comes to rest.
    private func petals(_ g: FormalLetterGeometry, _ p: FormalLetterGeometry.Pose, _ time: Double) -> some View {
        typealias M = FormalLetterMotion
        let specs: [(x: CGFloat, vx: CGFloat, vy: CGFloat, delay: Double, size: CGFloat, spin: Double, lilac: Bool)] = [
            (-0.16, -92, -58, 0.0, 12, -150, false), (0.12, 84, -66, 0.06, 10.5, 170, true),
            (-0.04, -60, -74, 0.13, 9.5, 120, true), (0.22, 104, -48, 0.18, 11.5, -130, false),
        ]
        let crease = p.paperCenter.y - g.paper.height * p.paperScale / 6
        return ZStack(alignment: .topLeading) {
            ForEach(specs.indices, id: \.self) { index in
                let spec = specs[index]
                let u = max(0, time - spec.delay)
                let fade = M.easeOut(M.progress(u, 0, 0.12)) * (1 - M.easeIn(M.progress(u, 0.42, 0.74)))
                let sway = 4 * CGFloat(sin(u * 8 + Double(index)))
                FormalLetterPetal(size: spec.size, lilac: spec.lilac).equatable()
                    .rotationEffect(.degrees(spec.spin * u + Double(index) * 47))
                    .position(x: p.paperCenter.x + spec.x * g.paper.width + spec.vx * CGFloat(u) + sway,
                              y: crease + spec.vy * CGFloat(u) + 0.5 * 230 * CGFloat(u * u))
                    .opacity(u > 0 ? fade : 0)
            }
        }
        .allowsHitTesting(false)
    }

    private func resting(_ g: FormalLetterGeometry) -> some View {
        FormalLetterRestingPaper(layout: g.paper, restSince: restSince)
            .modifier(FormalLetterPaperShadow(shadowed: true, lift: 0))
            .position(g.paperRestCenter)
    }

    /// Faces that aren't showing yet: drawn, but as good as invisible.
    static let unseen = 0.002
}

/// The letter's shadow: a close contact shadow and a soft one that grows while it's lifted.
struct FormalLetterPaperShadow: ViewModifier {
    let shadowed: Bool
    let lift: Double

    func body(content: Content) -> some View {
        content
            .compositingGroup()
            .shadow(color: FormalLetterPalette.plum.opacity(shadowed ? 0.07 + 0.05 * lift : 0), radius: shadowed ? CGFloat(1.5 + 2 * lift) : 0, x: 0, y: CGFloat(1 + 2 * lift))
            .shadow(color: FormalLetterPalette.plum.opacity(shadowed ? 0.1 + 0.06 * lift : 0), radius: shadowed ? CGFloat(8 + 10 * lift) : 0, x: 0, y: CGFloat(5 + 9 * lift))
    }
}
