import SwiftUI

// The letter sheet: ivory cotton with a gilded deckle, the crest at its head, the words at the
// baselines FormalLetterPaperLayout worked out, and soft creases where it was folded in thirds.
// While it's folded or unfolding, each third is its own slice of the sheet turned about its crease
// in 3D; at rest it's one sheet, and a long letter's words scroll inside it.

enum FormalLetterInk {
    /// Draws one line of the letter at its baseline (`dy` shifts it, for the scrolling body).
    /// `heart: false` leaves the signature's heart to the beating one drawn over the paper.
    static func draw(_ ctx: GraphicsContext, _ line: FormalLetterPaperLayout.Line, layout: FormalLetterPaperLayout, dy: CGFloat = 0, heart: Bool = true) {
        let resolved = ctx.resolve(FormalLetterType.text(line.text, line.style))
        let probe = CGSize(width: 4000, height: 600)
        let baseline = resolved.firstBaseline(in: probe)
        let measured = resolved.measure(in: probe)
        let x = layout.x(for: line, measured: measured.width)
        ctx.draw(resolved, at: CGPoint(x: x, y: line.baseline + dy - baseline), anchor: .topLeading)
        if line.style == .signature {
            if heart { FormalLetterTouches.heart(ctx, in: layout.heartRect(for: line).offsetBy(dx: 0, dy: dy)) }
            signatureTouch(ctx, line, layout: layout, dy: dy)
        }
    }

    /// Beside the signature, in the empty space to its left: two little paw prints walking up to it
    /// (the crest's kitten was here), or, on Maomao's letters, a sprig of rosemary.
    static func signatureTouch(_ ctx: GraphicsContext, _ line: FormalLetterPaperLayout.Line, layout: FormalLetterPaperLayout, dy: CGFloat) {
        let x = layout.closingX
        guard x - 64 >= layout.padX else { return }
        let y = line.baseline + dy
        if layout.maomao {
            FormalLetterTouches.herb(ctx, from: CGPoint(x: x - 60, y: y - 4), angle: -24, length: 36)
        } else {
            let ink = FormalLetterPalette.rgb(0xb59bd2, 0.7)
            FormalLetterTouches.paw(ctx, center: CGPoint(x: x - 48, y: y - 2), size: 8.5, angle: 62, color: ink)
            FormalLetterTouches.paw(ctx, center: CGPoint(x: x - 27, y: y - 15), size: 8.5, angle: 70, color: ink)
        }
    }

    /// The scrolling window's soft top and bottom edges, as an alpha mask (paper coordinates).
    static func fadeMask(_ mask: GraphicsContext, viewport: ClosedRange<CGFloat>, width: CGFloat, dy: CGFloat = 0) {
        typealias M = FormalLetterPaperMetrics
        let top = viewport.lowerBound + dy, bottom = viewport.upperBound + dy
        let black = Color.black, clear = Color.black.opacity(0)
        mask.fill(Path(CGRect(x: -20, y: top, width: width + 40, height: M.fadeTop)),
                  with: .linearGradient(Gradient(colors: [clear, black]), startPoint: CGPoint(x: 0, y: top), endPoint: CGPoint(x: 0, y: top + M.fadeTop)))
        mask.fill(Path(CGRect(x: -20, y: top + M.fadeTop, width: width + 40, height: bottom - top - M.fadeTop - M.fadeBottom)), with: .color(black))
        mask.fill(Path(CGRect(x: -20, y: bottom - M.fadeBottom, width: width + 40, height: M.fadeBottom)),
                  with: .linearGradient(Gradient(colors: [black, clear]), startPoint: CGPoint(x: 0, y: bottom - M.fadeBottom), endPoint: CGPoint(x: 0, y: bottom)))
    }
}

/// The front of the letter. `top`/`height` pick the slice of the paper this view shows (one third,
/// while folded), so a fold never holds a whole sheet's worth of drawing.
struct FormalLetterPaperFace: View, Equatable {
    let layout: FormalLetterPaperLayout
    var top: CGFloat = 0
    var height: CGFloat?
    var showCreases = true
    /// Whether to draw the words inside the scrolling window (not when a live scroll view does).
    var windowText = true

    var body: some View {
        let sliceHeight = height ?? layout.height
        let top = self.top
        return Canvas { canvas, _ in
            var ctx = canvas
            ctx.translateBy(x: 0, y: -top)
            let size = CGSize(width: layout.width, height: layout.height)
            let sheet = FormalLetterDeckle.path(CGRect(origin: .zero, size: size), seed: layout.seed)
            ctx.fill(sheet, with: .linearGradient(Gradient(colors: [FormalLetterPalette.paper, FormalLetterPalette.paperShade]),
                                                  startPoint: .zero, endPoint: CGPoint(x: size.width * 0.35, y: size.height)))
            // Cotton: the faintest warmth along the edges.
            ctx.stroke(sheet, with: .color(FormalLetterPalette.paperFiber.opacity(0.55)), lineWidth: 5)

            if showCreases {
                var creases = ctx
                creases.clip(to: sheet)
                for k in 1..<3 {
                    let y = (size.height * CGFloat(k) / 3).rounded()
                    // Where it was folded: a soft valley of shade, barely there, never a line.
                    creases.fill(Path(CGRect(x: 0, y: y - 10, width: size.width, height: 10)),
                             with: .linearGradient(Gradient(colors: [FormalLetterPalette.crease.opacity(0), FormalLetterPalette.crease.opacity(0.035)]),
                                                   startPoint: CGPoint(x: 0, y: y - 10), endPoint: CGPoint(x: 0, y: y)))
                    creases.fill(Path(CGRect(x: 0, y: y, width: size.width, height: 7)),
                             with: .linearGradient(Gradient(colors: [Color.white.opacity(0.2), Color.white.opacity(0)]),
                                                   startPoint: CGPoint(x: 0, y: y), endPoint: CGPoint(x: 0, y: y + 7)))
                }
            }

            let visible = (top - 60)...(top + sliceHeight + 60)
            if visible.contains(layout.crestCenterY) {
                // The crest's frame; its kitten is drawn over the paper (FormalLetterKittenCrest) so it can move.
                FormalLetterCrest.draw(ctx, center: CGPoint(x: size.width / 2, y: layout.crestCenterY), height: FormalLetterPaperMetrics.crestHeight, kitten: false)
                FormalLetterTouches.corner(ctx, at: layout.cornerBinding)
            }

            let viewport = layout.viewport
            var windowed: [FormalLetterPaperLayout.Line] = []
            for line in layout.lines where visible.contains(line.baseline) {
                if let viewport, line.baseline > viewport.lowerBound {
                    windowed.append(line)
                } else {
                    FormalLetterInk.draw(ctx, line, layout: layout, heart: !layout.heartBeats)
                }
            }
            // Ornaments that live in the flow (inside the window when the body scrolls).
            func ornaments(_ c: GraphicsContext) {
                if visible.contains(layout.ornamentY) {
                    FormalLetterOrnament.rule(c, center: CGPoint(x: size.width / 2, y: layout.ornamentY), width: min(150, size.width * 0.44))
                }
                if let y = layout.dividerY, visible.contains(y) {
                    FormalLetterOrnament.rule(c, center: CGPoint(x: size.width / 2, y: y), width: min(190, size.width * 0.56))
                }
            }
            if let viewport {
                if windowText {
                    ctx.drawLayer { layer in
                        layer.clipToLayer { mask in FormalLetterInk.fadeMask(mask, viewport: viewport, width: size.width) }
                        ornaments(layer)
                        for line in windowed where line.baseline < viewport.upperBound + 40 {
                            FormalLetterInk.draw(layer, line, layout: layout)
                        }
                    }
                }
            } else {
                ornaments(ctx)
            }

            FormalLetterDeckle.gild(ctx, sheet, size: size)
        }
        .frame(width: layout.width, height: sliceHeight)
        // A Canvas doesn't clip what it draws: keep a slice to its own third.
        .clipped()
    }
}

/// The back of the letter (what shows on a fold while it's folded). The outermost third carries a
/// blind-embossed crest, drawn upside down so it reads the right way once folded over.
struct FormalLetterPaperBack: View, Equatable {
    let layout: FormalLetterPaperLayout
    let panel: Int
    let outer: Bool
    var top: CGFloat = 0
    var height: CGFloat?

    var body: some View {
        let sliceHeight = height ?? layout.height
        let top = self.top
        return Canvas { canvas, _ in
            var ctx = canvas
            ctx.translateBy(x: 0, y: -top)
            let size = CGSize(width: layout.width, height: layout.height)
            let sheet = FormalLetterDeckle.path(CGRect(origin: .zero, size: size), seed: layout.seed)
            ctx.fill(sheet, with: .linearGradient(Gradient(colors: [FormalLetterPalette.paperBack, FormalLetterPalette.paperBackShade]),
                                                  startPoint: .zero, endPoint: CGPoint(x: size.width * 0.3, y: size.height)))
            ctx.stroke(sheet, with: .color(FormalLetterPalette.paperFiber.opacity(0.6)), lineWidth: 5)
            if outer {
                let band = size.height / 3
                let center = band * (CGFloat(panel) + 0.5)
                var flipped = ctx
                flipped.translateBy(x: size.width / 2, y: center)
                flipped.scaleBy(x: 1, y: -1)
                FormalLetterCrest.draw(flipped, center: CGPoint(x: 0, y: -6), height: min(46, band * 0.5), look: .embossed)
                let words = flipped.resolve(Text("for Kiriya")
                    .font(FormalLetterFonts.font(.text, size: 12.5, smallCaps: true))
                    .tracking(1.6)
                    .foregroundColor(FormalLetterPalette.soft.opacity(0.8)))
                flipped.draw(words, at: CGPoint(x: 0, y: min(46, band * 0.5) / 2 + 16), anchor: .center)
            }
            FormalLetterDeckle.gild(ctx, sheet, size: size)
        }
        .frame(width: layout.width, height: sliceHeight)
        // A Canvas doesn't clip what it draws: keep a slice to its own third.
        .clipped()
    }
}

/// The letter, folded in thirds or unfolding: each third is its own slice turned about its crease
/// in 3D. `angles` = [top third, bottom third] in degrees (0 = flat; folded: -180 and 180). The
/// crest's kitten and the signature's heart ride on their thirds as small views of their own, so
/// they can move (an ear, an eye, a beat) without the paper being drawn again.
struct FormalLetterSheet: View, Equatable {
    let layout: FormalLetterPaperLayout
    let angles: [Double]
    var kitten: FormalLetterKittenPose = .rest
    var heartScale: CGFloat = 1
    /// At rest, the kitten's own clock (its rare sleepy peeks).
    var live: FormalLetterLiveKitten?
    /// Overlap of a turning fold onto its neighbour, so no hairline shows between them.
    private static let overlap: CGFloat = 1

    var body: some View {
        ZStack(alignment: .topLeading) {
            // The middle third first, then the bottom fold, then the top fold (outermost). Flat,
            // the three slices meet (overlapping a hair) as one sheet, so nothing is rebuilt at rest.
            ForEach([1, 2, 0], id: \.self) { index in panel(index) }
        }
        .frame(width: layout.width, height: layout.height, alignment: .topLeading)
    }

    @ViewBuilder
    private func panel(_ index: Int) -> some View {
        let angle = index == 0 ? angles[0] : index == 2 ? angles[1] : 0
        let front = abs(angle) <= 90
        let base = index == 1
        let band = layout.height / 3
        let up: CGFloat = index == 2 ? Self.overlap : 0
        let down: CGFloat = index == 0 ? Self.overlap : 0
        let top = band * CGFloat(index) - up
        let height = band + up + down
        // The crease it turns about: its bottom edge for the top fold, its top edge for the bottom one.
        let hinge: CGFloat = index == 0 ? band / height : up / height
        let perspective = 0.24 * max(layout.width, height) / max(layout.width, layout.height)
        // Both faces stay mounted (the hidden one all but transparent), so turning over never
        // has to draw a face for the first time mid-animation.
        ZStack(alignment: .topLeading) {
            FormalLetterPaperFace(layout: layout, top: top, height: height).equatable()
                .opacity(front ? 1 : FormalLetterScene.unseen)
            if index == layout.fold(of: layout.crestCenterY) {
                FormalLetterKittenCrest(height: FormalLetterPaperMetrics.crestHeight, pose: kitten, live: live, canvas: layout.kittenCanvas)
                    .position(x: layout.width / 2, y: layout.crestCenterY - top)
                    .opacity(front ? 1 : FormalLetterScene.unseen)
            }
            if layout.heartBeats, let line = layout.signatureLine, index == layout.fold(of: layout.heartRect(for: line).midY) {
                let rect = layout.heartRect(for: line)
                FormalLetterBeatingHeart(size: rect.size, scale: heartScale).equatable()
                    .position(x: rect.midX, y: rect.midY - top)
                    .opacity(front ? 1 : FormalLetterScene.unseen)
            }
            // (Once a fold lies flat, its back is let go.)
            if !base && angle != 0 {
                FormalLetterPaperBack(layout: layout, panel: index, outer: index == 0, top: top, height: height).equatable()
                    .opacity(front ? FormalLetterScene.unseen : 1)
            }
        }
        .frame(width: layout.width, height: height, alignment: .topLeading)
        .rotation3DEffect(.degrees(base ? 0 : angle), axis: (x: 1, y: 0, z: 0),
                          anchor: UnitPoint(x: 0.5, y: hinge), perspective: perspective)
        .offset(y: top)
    }
}

/// The signature's heart on its own, so it can give its little beat as the letter settles.
struct FormalLetterBeatingHeart: View, Equatable {
    let size: CGSize
    let scale: CGFloat

    var body: some View {
        Canvas { ctx, canvas in
            let w = size.width * scale, h = size.height * scale
            FormalLetterTouches.heart(ctx, in: CGRect(x: (canvas.width - w) / 2, y: (canvas.height - h) / 2, width: w, height: h))
        }
        // 6 pt of room each side for the beat (and whole-pixel placement for a whole-point heart).
        .frame(width: size.width + 12, height: size.height + 12)
        .allowsHitTesting(false)
    }
}

/// The kitten's clock at rest: when it came to rest, and which peeks are skipped (because she was
/// scrolling just then).
struct FormalLetterLiveKitten: Equatable {
    let since: Date
    var veto: Set<Int> = []
}

/// The crest's kitten, drawn over the crest's frame. Given a clock, it follows its own schedule of
/// rare, slow, sleepy peeks, and is redrawn only while one is under way.
struct FormalLetterKittenCrest: View {
    let height: CGFloat
    let pose: FormalLetterKittenPose
    var live: FormalLetterLiveKitten?
    let canvas: CGSize

    var body: some View {
        if let live {
            TimelineView(FormalLetterPeek.Schedule(start: live.since)) { timeline in
                FormalLetterKittenView(height: height, pose: FormalLetterPeek.pose(at: timeline.date.timeIntervalSince(live.since), veto: live.veto),
                                       canvas: canvas).equatable()
            }
        } else {
            FormalLetterKittenView(height: height, pose: pose, canvas: canvas).equatable()
        }
    }
}

struct FormalLetterKittenView: View, Equatable {
    let height: CGFloat
    let pose: FormalLetterKittenPose
    /// Chosen so the canvas lands on whole pixels (see FormalLetterPaperLayout.kittenCanvas).
    let canvas: CGSize

    var body: some View {
        Canvas { ctx, size in
            FormalLetterKitten.draw(ctx, center: CGPoint(x: size.width / 2, y: size.height / 2), crestHeight: height, pose: pose)
        }
        .frame(width: canvas.width, height: canvas.height)
        .allowsHitTesting(false)
    }
}

/// The kitten's peeks at rest: the first a few seconds after the letter settles, then every 7–11
/// seconds; each opens its eyes slowly, holds a moment and closes them again. All a function of
/// the seconds since rest.
enum FormalLetterPeek {
    static let first = 3.5
    static let gaps: [Double] = [9.0, 7.5, 11.0]
    static let duration = 1.7
    static var cycle: Double { gaps.reduce(0, +) }

    static func start(_ k: Int) -> Double {
        let laps = k / gaps.count
        return first + Double(laps) * cycle + gaps.prefix(k % gaps.count).reduce(0, +)
    }

    /// The last peek starting at or before `t` (nil before the first).
    static func latest(at t: Double) -> Int? {
        guard t >= first else { return nil }
        let laps = Int((t - first) / cycle)
        var k = laps * gaps.count
        while start(k + 1) <= t { k += 1 }
        return k
    }

    static func next(after t: Double) -> Int { (latest(at: t) ?? -1) + 1 }

    static func open(_ u: Double) -> Double {
        typealias M = FormalLetterMotion
        guard u > 0, u < duration else { return 0 }
        return 0.85 * M.easeInOut(M.progress(u, 0, 0.5)) * (1 - M.easeInOut(M.progress(u, 1.15, duration)))
    }

    static func pose(at t: Double, veto: Set<Int> = []) -> FormalLetterKittenPose {
        guard let k = latest(at: t), !veto.contains(k) else { return .rest }
        return FormalLetterKittenPose(open: open(t - start(k)))
    }

    /// Frames only while a peek is under way (30 a second), none in between.
    struct Schedule: TimelineSchedule {
        let start: Date

        func entries(from date: Date, mode: TimelineScheduleMode) -> Entries {
            Entries(start: start, from: date, still: mode == .lowFrequency)
        }

        struct Entries: Sequence, IteratorProtocol {
            let start: Date
            var k: Int
            var frame = 0
            var done = false
            let still: Bool
            static let fps = 30.0

            init(start: Date, from date: Date, still: Bool) {
                self.start = start
                self.still = still
                let t = date.timeIntervalSince(start)
                if let latest = FormalLetterPeek.latest(at: t), t < FormalLetterPeek.start(latest) + FormalLetterPeek.duration {
                    k = latest
                    frame = Int((t - FormalLetterPeek.start(latest)) * Self.fps)
                } else {
                    k = FormalLetterPeek.next(after: t)
                }
            }

            mutating func next() -> Date? {
                if still {
                    if done { return nil }
                    done = true
                    return start
                }
                let frames = Int(FormalLetterPeek.duration * Self.fps) + 2
                if frame > frames {
                    k += 1
                    frame = 0
                }
                let date = start.addingTimeInterval(FormalLetterPeek.start(k) + Double(frame) / Self.fps)
                frame += 1
                return date
            }
        }
    }
}

/// The letter at rest, ready to read. A long letter's words scroll inside the paper's window (the
/// crest and the paper stay put, the words fade softly at the window's edges); the words are drawn
/// exactly as on the animated sheet, so nothing shifts when it takes over.
struct FormalLetterRestingPaper: View {
    let layout: FormalLetterPaperLayout
    /// When the letter came to rest (the kitten's clock), or nil for a still kitten.
    var restSince: Date?
    @State private var veto: Set<Int> = []

    var body: some View {
        ZStack(alignment: .topLeading) {
            FormalLetterPaperFace(layout: layout, windowText: layout.viewport == nil).equatable()
            FormalLetterKittenCrest(height: FormalLetterPaperMetrics.crestHeight, pose: .rest,
                                    live: restSince.map { FormalLetterLiveKitten(since: $0, veto: veto) }, canvas: layout.kittenCanvas)
                .position(x: layout.width / 2, y: layout.crestCenterY)
            if let viewport = layout.viewport {
                let height = viewport.upperBound - viewport.lowerBound
                ScrollView(.vertical) {
                    FormalLetterScrollBody(layout: layout)
                        .background(GeometryReader { proxy in
                            Color.clear.preference(key: FormalLetterScrollOffset.self, value: proxy.frame(in: .named("formal-letter-body")).minY)
                        })
                }
                .coordinateSpace(name: "formal-letter-body")
                .onPreferenceChange(FormalLetterScrollOffset.self) { _ in scrolled() }
                .scrollIndicatorsFlash(onAppear: true)
                // A dark indicator on the ivory paper, even when the phone is in dark mode.
                .environment(\.colorScheme, .light)
                .frame(width: layout.width, height: height)
                .mask(
                    // The same soft edges as FormalLetterInk.fadeMask (two-stop pieces, so no seams).
                    VStack(spacing: 0) {
                        LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom)
                            .frame(height: FormalLetterPaperMetrics.fadeTop)
                        Color.black
                        LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom)
                            .frame(height: FormalLetterPaperMetrics.fadeBottom)
                    }
                )
                .offset(y: viewport.lowerBound)
            }
        }
        .frame(width: layout.width, height: layout.height, alignment: .topLeading)
    }

    /// While she scrolls, the kitten keeps still: a peek due to start within a moment is skipped (one
    /// already under way finishes).
    private func scrolled() {
        guard let restSince else { return }
        let t = Date().timeIntervalSince(restSince)
        let next = FormalLetterPeek.next(after: t)
        if FormalLetterPeek.start(next) - t < 1.2, !veto.contains(next) { veto.insert(next) }
    }
}

struct FormalLetterScrollOffset: PreferenceKey {
    static var defaultValue: CGFloat { 0 }
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

/// The scrolling words: the window's content in strips, made only as they scroll into view. Each
/// strip draws every line that touches it, so a line split between two strips joins seamlessly.
struct FormalLetterScrollBody: View, Equatable {
    let layout: FormalLetterPaperLayout
    static let strip: CGFloat = 240

    /// Every strip is the same whole number of points tall (a lazy stack sizes the strips it
    /// hasn't made yet from the ones it has, so a shorter last strip would throw its estimate off).
    static func strips(_ layout: FormalLetterPaperLayout) -> (count: Int, height: CGFloat) {
        let count = max(1, Int((layout.scrollContentHeight / strip).rounded(.up)))
        return (count, (layout.scrollContentHeight / CGFloat(count)).rounded(.up))
    }

    var body: some View {
        let (count, height) = Self.strips(layout)
        return LazyVStack(spacing: 0) {
            ForEach(0..<count, id: \.self) { index in
                FormalLetterScrollStrip(layout: layout, stripTop: CGFloat(index) * height, height: height).equatable()
            }
        }
        .frame(width: layout.width, alignment: .topLeading)
    }
}

struct FormalLetterScrollStrip: View, Equatable {
    let layout: FormalLetterPaperLayout
    let stripTop: CGFloat
    let height: CGFloat

    var body: some View {
        Canvas { ctx, _ in
            guard let viewport = layout.viewport else { return }
            // Paper y of this strip's top edge.
            let paperTop = viewport.lowerBound + stripTop
            let dy = -paperTop
            let range = (paperTop - 50)...(paperTop + height + 50)
            if range.contains(layout.ornamentY), layout.ornamentY > viewport.lowerBound {
                FormalLetterOrnament.rule(ctx, center: CGPoint(x: layout.width / 2, y: layout.ornamentY + dy), width: min(150, layout.width * 0.44))
            }
            if let y = layout.dividerY, range.contains(y) {
                FormalLetterOrnament.rule(ctx, center: CGPoint(x: layout.width / 2, y: y + dy), width: min(190, layout.width * 0.56))
            }
            for line in layout.lines where line.baseline > viewport.lowerBound && range.contains(line.baseline) {
                FormalLetterInk.draw(ctx, line, layout: layout, dy: dy)
            }
        }
        .frame(width: layout.width, height: height)
    }
}
