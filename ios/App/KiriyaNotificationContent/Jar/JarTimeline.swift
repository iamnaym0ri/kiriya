import CoreText
import SwiftUI

// The card's motion as a pure function of time. JarCard records *when* each state began (JarStory);
// JarTimeline turns (story, now) into a JarFrame, which JarScene draws. Nothing here keeps state, so
// the lab renders any instant exactly as the phone will show it.
//
// The pull, from the big jar (seconds after the note arrives; the "finding" loop blends into it):
//   0.00 the jar squashes …  0.20 the lid pops (as the app's jar-lid-lift) and the jar springs up
//   0.24 a note rises from behind the others, out through the neck (little red hearts puff out)
//   0.60 the jar shrinks and settles underneath, the lid drops back on, the "new" count ticks down
//   0.68 the note floats up to the top of the card and grows into a folded letter
//   1.26 it unfolds downward, panel by panel; the tape presses it down; red hearts float up  (~2.4 s)
// Pulling another: the read note is swept aside, the small jar does the same, the new note flies up.

// MARK: - Story

struct JarStep: Equatable {
    enum Phase: Equatable { case waiting, pulling, pulled, failed }
    var phase: Phase
    var since: Double
    /// The note on the paper (nil: the big jar, nothing pulled yet).
    var note: JarPulledNote?
    /// For a pull: the note it replaces (nil: it came out of the big jar).
    var previous: JarPulledNote?
    var message: String?
    /// Notes taken out for real so far (previews don't count): the red heart shows newCount - pulls.
    var pulls: Int = 0
    var pullsBefore: Int = 0
}

struct JarStory: Equatable {
    var step: JarStep
    var before: JarStep?

    /// A card that appears already in `state` shows it settled (no replay of a pull it didn't see).
    init(initial state: JarCardState) {
        var step = JarStep(phase: .waiting, since: 0)
        switch state {
        case .waiting: break
        case .pulling: step.phase = .pulling
        case .pulled(let note):
            step.phase = .pulled
            step.note = note
            step.pulls = note.isPreview ? 0 : 1
            step.pullsBefore = step.pulls
        case .failed(let message):
            step.phase = .failed
            step.message = message
        }
        self.step = step
    }

    init(step: JarStep, before: JarStep?) {
        self.step = step
        self.before = before
    }

    mutating func advance(to state: JarCardState, at now: Double) {
        let old = step
        var next = JarStep(phase: .waiting, since: now, note: old.note, pulls: old.pulls, pullsBefore: old.pulls)
        switch state {
        case .waiting:
            next.note = nil
        case .pulling:
            next.phase = .pulling
        case .pulled(let note):
            next.phase = .pulled
            next.previous = old.note
            next.note = note
            next.pulls = old.pulls + (note.isPreview ? 0 : 1)
        case .failed(let message):
            next.phase = .failed
            next.message = message
        }
        before = old
        step = next
    }
}

// MARK: - Frame

struct JarAttachedNote {
    /// Art-space centre, size scale and tilt of the note rising inside the jar.
    var center: CGPoint
    var scale: CGFloat
    var rotation: Double
}

struct JarFlyingNote {
    var center: CGPoint
    var size: CGSize
    var rotation: Double
    /// Shadow opacity, and how far it lifts (1 = the resting paper's shadow).
    var shadow: Double
    var lift: Double
}

struct JarPaperFrame {
    var layout: JarPaperLayout
    var origin: CGPoint
    /// Degrees: 180 folded up, 0 open.
    var fold1: Double = 0
    var fold2: Double = 0
    var tape: Double = 1
    /// The second sheet peeking out underneath (the app's 4px 4px offset shadow).
    var sheet: Double = 1
    var rotation: Double = JarTimeline.restTilt
    var offset: CGSize = .zero
    var opacity: Double = 1
    var flat: Bool { fold1 <= 0.0001 && fold2 <= 0.0001 }
}

struct JarParticle {
    var center: CGPoint
    var height: CGFloat
    var rotation: Double
    var opacity: Double
}

struct JarFrame {
    var layout: JarLayout
    var height: CGFloat
    var tagOpacity: Double = 0
    var captions: [(JarCaptionLayout, Double)] = []
    var placement: JarArtist.Placement
    var pose: JarPose
    var charmsOpacity: Double = 1
    var shadowOpacity: Double = 1
    var labelLine: CTLine?
    var countLine: CTLine?
    var attached: JarAttachedNote?
    var flying: JarFlyingNote?
    var paper: JarPaperFrame?
    var oldPaper: JarPaperFrame?
    var particles: [JarParticle] = []
    var jarHit: CGRect
    var isPulling = false
    var hint: String = ""
    var note: JarPulledNote?
    var width: CGFloat { layout.width }
}

// MARK: - Timeline

enum JarTimeline {
    static let restTilt: Double = 0.8
    static let blendIn: Double = 0.3

    struct Input {
        var heading: String
        var newCount: Int?
        var story: JarStory
        var now: Double
        var reduceMotion: Bool
        var width: CGFloat
    }

    /// The frames to draw, bottom first, with their opacities (two while crossfading).
    static func frames(_ input: Input) -> [(JarFrame, Double)] {
        let story = input.story
        let current = frame(input, step: story.step, before: story.before)
        guard let before = story.before else { return [(current, 1)] }
        let elapsed = input.now - story.step.since
        let rearranged = (before.note == nil) != (story.step.note == nil) || before.note != story.step.note
        let crossfade = input.reduceMotion ? (before.phase != story.step.phase || rearranged) : (story.step.phase == .waiting && before.note != nil)
        let duration = 0.4
        guard crossfade, elapsed < duration, elapsed >= 0 else { return [(current, 1)] }
        var old = input
        old.now = story.step.since
        let from = frame(old, step: before, before: nil)
        return [(from, 1), (current, smooth(elapsed / duration))]
    }

    static func height(_ input: Input) -> CGFloat {
        frames(input).map(\.0.height).max() ?? 300
    }

    /// Whether anything still moves (otherwise the card's timeline can pause).
    static func isStill(_ input: Input) -> Bool {
        let step = input.story.step
        if input.reduceMotion { return input.now - step.since > 0.5 }
        guard step.phase == .pulled || (step.phase == .failed && step.note != nil) else { return false }
        if badge(input.newCount, pulls: step.pulls) != nil { return false }
        let times = PullTimes(fromBig: step.previous == nil, panels: 3)
        return input.now - step.since > times.end + 0.2
    }

    // MARK: per state

    private static func frame(_ input: Input, step: JarStep, before: JarStep?) -> JarFrame {
        let fresh = (input.newCount ?? 1) > 0
        let layout = JarLayout(width: input.width, heading: input.heading, fresh: fresh)
        let now = input.now
        let reduce = input.reduceMotion
        switch step.phase {
        case .waiting:
            var frame = bigFrame(input, layout: layout, pulls: step.pulls, caption: waitingCaption(input.newCount, pulls: step.pulls), color: JarPalette.muted)
            if !reduce, let before, before.phase == .pulling, before.note == nil {
                frame.pose = mix(pullingPose(input, step: before, pulls: step.pulls), frame.pose, smooth((now - step.since) / 0.4))
            }
            return frame
        case .failed:
            let message = step.message ?? "the jar got a little stuck. try again?"
            var frame: JarFrame
            if let note = step.note {
                frame = restFrame(input, layout: layout, note: note, pulls: step.pulls, status: (message, JarPalette.freshInk))
            } else {
                frame = bigFrame(input, layout: layout, pulls: step.pulls, caption: message, color: JarPalette.freshInk)
            }
            if !reduce, let before, before.phase == .pulling {
                let w = smooth((now - step.since) / 0.4)
                frame.pose = mix(pullingPose(input, step: before, pulls: step.pulls), frame.pose, w)
                frame.captions = crossfadeCaptions(from: pullingCaptions(input, layout: layout, step: before), to: frame.captions, w: smooth((now - step.since) / 0.3))
            }
            return frame
        case .pulling:
            var frame: JarFrame
            if let note = step.note {
                // Keep finishing a pull that was still unfolding, then let the small jar rattle.
                if let before, before.phase == .pulled, !reduce {
                    frame = pulledFrame(input, layout: layout, step: before)
                } else {
                    frame = restFrame(input, layout: layout, note: note, pulls: step.pulls, status: nil)
                }
                frame.captions = pullingCaptions(input, layout: layout, step: step)
                if !reduce {
                    let w = smooth((now - step.since) / 0.3)
                    let previous = restCaptions(input, layout: layout, note: note, pulls: step.pulls, status: before?.phase == .failed ? before?.message.map { ($0, JarPalette.freshInk) } : nil)
                    frame.captions = crossfadeCaptions(from: previous, to: frame.captions, w: w)
                }
            } else {
                frame = bigFrame(input, layout: layout, pulls: step.pulls, caption: "finding a little note for u…", color: JarPalette.muted)
                if !reduce {
                    let previous = before?.phase == .failed ? (before?.message ?? "", JarPalette.freshInk) : (waitingCaption(input.newCount, pulls: step.pulls), JarPalette.muted)
                    frame.captions = crossfadeCaptions(from: [(bigCaption(layout, previous.0, previous.1), 1)], to: frame.captions,
                                                       w: smooth((now - step.since) / 0.3))
                }
            }
            frame.pose = pullingPose(input, step: step, pulls: step.pulls)
            frame.isPulling = true
            frame.hint = "finding a little note"
            return frame
        case .pulled:
            if reduce || before == nil && step.since == 0 {
                return restFrame(input, layout: layout, note: step.note!, pulls: step.pulls, status: nil)
            }
            return pulledFrame(input, layout: layout, step: step, before: before)
        }
    }

    private static func waitingCaption(_ newCount: Int?, pulls: Int) -> String {
        "tap the jar to pull one ❤️"
    }

    /// A big-jar caption: a trailing heart in a message becomes the card's own red heart.
    private static func bigCaption(_ layout: JarLayout, _ text: String, _ color: JarRGB) -> JarCaptionLayout {
        let hearts = JarText.headingWithoutHearts(text) != text.trimmingCharacters(in: .whitespacesAndNewlines)
        return layout.bigCaption(text, color: color, heart: hearts)
    }

    static func badge(_ newCount: Int?, pulls: Int) -> String? {
        guard let newCount else { return nil }
        let left = newCount - pulls
        guard left > 0 else { return nil }
        return left > 9 ? "9+" : "\(left)"
    }

    private static func countLine(_ text: String?) -> CTLine? {
        text.map { JarText.line($0, font: JarFonts.rounded(text!.count > 1 ? 13 : 15.5, .heavy), color: JarRGB(0xffffff)) }
    }

    /// "little bits of love", sized to sit inside the label's dashed border (the site's 19px spills over it).
    private static var labelLine: CTLine {
        let natural = JarText.line("little bits of love", font: JarFonts.hand(19), color: JarPalette.labelInk)
        let width = JarText.inkWidth(natural)
        guard width > 112 else { return natural }
        return JarText.line("little bits of love", font: JarFonts.hand((19 * 112 / width * 10).rounded(.down) / 10), color: JarPalette.labelInk)
    }

    // MARK: the big jar

    private static func bigFrame(_ input: Input, layout: JarLayout, pulls: Int, caption: String, color: JarRGB) -> JarFrame {
        let badge = badge(input.newCount, pulls: pulls)
        let wiggle: Double = input.reduceMotion ? 0 : (badge != nil ? 1 : (input.newCount == nil ? 0.6 : 0))
        let pose = idlePose(input.now, lively: !input.reduceMotion, wiggle: wiggle, badge: badge)
        let caption = bigCaption(layout, caption, color)
        return JarFrame(layout: layout, height: layout.bigHeight(caption: caption), tagOpacity: 1, captions: [(caption, 1)],
                        placement: layout.bigPlacement, pose: pose, labelLine: labelLine, countLine: countLine(badge),
                        jarHit: layout.bigJarRect, hint: badge.map { $0 == "1" ? "1 new note" : "\($0) new notes" } ?? "")
    }

    // MARK: a note, resting

    private static func restCaptions(_ input: Input, layout: JarLayout, note: JarPulledNote, pulls: Int, status: (String, JarRGB)?) -> [(JarCaptionLayout, Double)] {
        let paper = layout.paper(for: note)
        let line: (String, JarRGB, Bool)
        if let status {
            line = (status.0, status.1, false)
        } else if let left = input.newCount.map({ $0 - pulls }), left > 0 {
            // Spelled out: Gaegu's "1" reads as an "I".
            let words = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
            let count = left <= 9 ? words[left - 1] : "\(min(left, 99))"
            line = (left == 1 ? "one more new note inside" : "\(count) more new notes inside", JarPalette.freshInk, true)
        } else {
            line = ("tap the jar for another", JarPalette.muted, true)
        }
        return layout.restCaptions(line.0, color: line.1, heart: line.2, preview: note.isPreview, paper: paper).map { ($0, 1) }
    }

    private static func pullingCaptions(_ input: Input, layout: JarLayout, step: JarStep) -> [(JarCaptionLayout, Double)] {
        guard let note = step.note else {
            return [(bigCaption(layout, "finding a little note for u…", JarPalette.muted), 1)]
        }
        return restCaptions(input, layout: layout, note: note, pulls: step.pulls, status: ("finding another…", JarPalette.muted))
    }

    private static func restFrame(_ input: Input, layout: JarLayout, note: JarPulledNote, pulls: Int, status: (String, JarRGB)?) -> JarFrame {
        let paper = layout.paper(for: note)
        let badge = badge(input.newCount, pulls: pulls)
        let lively = !input.reduceMotion && badge != nil
        let pose = idlePose(input.now, lively: lively, wiggle: lively ? 1 : 0, badge: badge)
        return JarFrame(layout: layout, height: layout.restHeight(paper), captions: restCaptions(input, layout: layout, note: note, pulls: pulls, status: status),
                        placement: layout.restPlacement(paper), pose: pose, labelLine: labelLine, countLine: countLine(badge),
                        paper: JarPaperFrame(layout: paper, origin: layout.paperRect(paper).origin),
                        jarHit: layout.restJarRect(paper), hint: badge.map { $0 == "1" ? "1 new note" : "\($0) new notes" } ?? "", note: note)
    }

    // MARK: poses

    /// The app's idle loops (NoteJar.css): papers settle (6 s), charms float (5 s), the new-notes heart
    /// beats (1.6 s) with its sparks (2.4 s), and the whole jar wiggles every 4.5 s while there's something new.
    static func idlePose(_ now: Double, lively: Bool, wiggle: Double, badge: String?) -> JarPose {
        var pose = JarPose()
        pose.badgeText = badge
        guard lively else {
            pose.charmOpacity = [0.8, 0.8, 0.8, 0.8]
            pose.sparkOpacity = [0.8, 0.8]
            return pose
        }
        for index in 0..<8 {
            let p = frac((now + 0.8 * Double(index)) / 6)
            pose.notes[index] = CGVector(dx: 0, dy: keyframes(p, [(0, 0), (0.5, -1.5), (1, 0)]))
        }
        for index in 0..<4 {
            let p = frac((now + 1.2 * Double(index)) / 5)
            pose.charmLift[index] = keyframes(p, [(0, 0), (0.5, -7), (1, 0)])
            pose.charmOpacity[index] = keyframes(p, [(0, 0.6), (0.5, 0.95), (1, 0.6)])
        }
        if badge != nil {
            pose.badgeScale = keyframes(frac(now / 1.6), [(0, 1), (0.12, 1.16), (0.24, 0.98), (0.36, 1.1), (0.5, 1), (1, 1)])
            for index in 0..<2 {
                let p = frac((now + 1.1 * Double(index)) / 2.4)
                pose.sparkLift[index] = keyframes(p, [(0, 0), (0.5, -7), (1, 0)])
                pose.sparkOpacity[index] = keyframes(p, [(0, 0.6), (0.5, 0.95), (1, 0.6)])
            }
        }
        if wiggle > 0 {
            let r = keyframes(frac(now / 4.5), [(0, 0), (0.7, 0), (0.75, -2.5), (0.8, 2.5), (0.85, -1.5), (0.9, 1), (1, 0)]) * wiggle
            pose.rotation = r
            pose.lidRotation = r * 0.35
        }
        return pose
    }

    /// "Finding a little note": the jar gives a little hop, the lid rattles, the notes jump, and
    /// sparkles blink at the mouth. One beat every 1.25 s; it blends in from the idle pose.
    static func anticipation(_ u: Double, base: JarPose, amplitude k: CGFloat = 1) -> JarPose {
        var pose = base
        let c = frac(u / 1.25) * 1.25
        let squash = smooth(seg(c, 0, 0.14)) * (1 - smooth(seg(c, 0.14, 0.24)))
        let up = outCubic(seg(c, 0.14, 0.31)) * (1 - inCubic(seg(c, 0.31, 0.47)))
        let stretch = sin(.pi * seg(c, 0.14, 0.40))
        let land = sin(.pi * seg(c, 0.46, 0.60))
        pose.hop = -8 * up * k
        pose.squashY = 1 - 0.04 * squash + 0.035 * stretch - 0.035 * land
        pose.squashX = 1 + 0.025 * squash - 0.015 * stretch + 0.025 * land
        let shiver = seg(c, 0.47, 0.95)
        pose.rotation = base.rotation + 1.6 * sin(2 * .pi * 3 * shiver) * pow(1 - shiver, 2)
        let lid = outCubic(seg(c, 0.18, 0.34)) * (1 - inCubic(seg(c, 0.34, 0.50)))
        let rattle = seg(c, 0.50, 0.78)
        pose.lidOffset = CGSize(width: 2 * lid * k, height: -8 * lid * k)
        pose.lidRotation = base.lidRotation - 6 * lid + 3.5 * sin(2 * .pi * 1.5 * rattle) * (1 - rattle)
        for index in 0..<8 {
            let cc = c - 0.03 * Double(index % 4)
            let jump = outCubic(seg(cc, 0.16, 0.33)) * (1 - inCubic(seg(cc, 0.33, 0.52)))
            pose.notes[index].dy += -8 * jump * (0.7 + 0.12 * Double(index % 3)) * k
            pose.noteTilts[index] = (index.isMultiple(of: 2) ? -1 : 1) * 7 * jump
        }
        // Sparkles blink around the lid, one after another, in the badge's red and the charms' lilac.
        let spots: [(CGPoint, CGFloat, Bool)] = [(CGPoint(x: 96, y: 96), 9, true), (CGPoint(x: 226, y: 72), 10, true), (CGPoint(x: 150, y: 66), 7.5, false), (CGPoint(x: 274, y: 132), 8, true)]
        pose.twinkles = spots.enumerated().map { index, spot in
            let t = seg(c, 0.12 + 0.24 * Double(index), 0.12 + 0.24 * Double(index) + 0.46)
            let s = sin(.pi * t)
            return JarTwinkle(center: spot.0, radius: spot.1 * 1.4 * CGFloat(0.3 + 0.7 * s) * min(1.5, k), opacity: s, filled: spot.2, red: index.isMultiple(of: 2))
        }
        return pose
    }

    /// The pose while a step is `pulling` (blended in from the idle pose).
    private static func pullingPose(_ input: Input, step: JarStep, pulls: Int) -> JarPose {
        let badge = badge(input.newCount, pulls: pulls)
        let small = step.note != nil
        if input.reduceMotion {
            var pose = idlePose(input.now, lively: false, wiggle: 0, badge: badge)
            pose.lidOffset = CGSize(width: 6, height: -12)
            pose.lidRotation = 9
            pose.twinkles = [JarTwinkle(center: CGPoint(x: 96, y: 96), radius: 9, opacity: 1, filled: true, red: true),
                             JarTwinkle(center: CGPoint(x: 226, y: 72), radius: 10, opacity: 0.9, filled: true, red: false)]
            return pose
        }
        let wiggle: Double = badge != nil ? 1 : (input.newCount == nil && !small ? 0.6 : 0)
        let base = idlePose(input.now, lively: !small || badge != nil, wiggle: wiggle, badge: badge)
        let u = input.now - step.since
        return mix(base, anticipation(u, base: base, amplitude: small ? 1.7 : 1), smooth(u / 0.25))
    }

    // MARK: the pull

    struct PullTimes {
        var squash = (0.0, 0.22), lidPop = (0.20, 0.46), rise = (0.24, 0.68), move = (0.60, 1.20), lidBack = (0.64, 0.98)
        var flightEnd = 1.20, unfold1 = (1.20, 1.62), unfold2 = (1.54, 1.96), exit = (0.0, 0.0)
        /// Pulling another: the small jar first steps up to the middle of the card while the read note is swept aside.
        var stage: (Double, Double)?
        var panels = 2
        init(fromBig: Bool, panels: Int) {
            self.panels = panels
            if !fromBig {
                exit = (0.0, 0.42)
                stage = (0.10, 0.56)
                squash = (0.42, 0.60); lidPop = (0.58, 0.82); rise = (0.62, 1.04); move = (1.0, 1.54); lidBack = (1.02, 1.34)
                flightEnd = 1.52; unfold1 = (1.52, 1.94); unfold2 = (1.86, 2.28)
            }
        }
        var unfoldEnd: Double { panels == 3 ? unfold2.1 : unfold1.1 }
        var tape: (Double, Double) { (unfoldEnd - 0.08, unfoldEnd + 0.24) }
        /// The heart seal pops into little hearts as the letter opens.
        var hearts: Double { flightEnd + 0.04 }
        var end: Double { max(hearts + 1.25, tape.1 + 0.45) }
    }

    private static func pulledFrame(_ input: Input, layout: JarLayout, step: JarStep, before: JarStep? = nil) -> JarFrame {
        let note = step.note!
        let τ = input.now - step.since
        let fromBig = step.previous == nil
        let paper = layout.paper(for: note)
        let times = PullTimes(fromBig: fromBig, panels: paper.panels)
        var frame = restFrame(input, layout: layout, note: note, pulls: step.pulls, status: nil)
        guard τ < times.end else { return frame }

        // Where the jar comes from and goes to (by way of the middle of the card, when pulling another).
        let oldPaper = step.previous.map { layout.paper(for: $0) }
        let origin = oldPaper.map { layout.restPlacement($0) } ?? layout.bigPlacement
        let target = layout.restPlacement(paper)
        let originHeight: CGFloat
        if let oldPaper {
            originHeight = layout.restHeight(oldPaper)
        } else {
            originHeight = layout.bigHeight(caption: bigCaption(layout, "finding a little note for u…", JarPalette.muted))
        }
        let stageScale: CGFloat = layout.width >= 375 ? 0.5 : 0.47
        let stageSpot = JarArtist.Placement(base: CGPoint(x: (layout.width / 2).rounded(), y: originHeight * 0.53 + (350 - 222) * stageScale), scale: stageScale)
        func placement(at t: Double) -> JarArtist.Placement {
            var from = origin
            if let stage = times.stage {
                let up = inOutCubic(seg(t, stage.0, stage.1))
                from = JarArtist.Placement(base: lerp(origin.base, stageSpot.base, up), scale: lerp(origin.scale, stageSpot.scale, up))
            }
            let move = inOutCubic(seg(t, times.move.0, times.move.1))
            return JarArtist.Placement(base: lerp(from.base, target.base, move), scale: lerp(from.scale, target.scale, move))
        }
        frame.placement = placement(at: τ)
        // The card makes room as the jar starts to settle (not before: no empty space under the big jar).
        let restHeight = layout.restHeight(paper)
        frame.height = τ < times.move.0 - 0.04 ? originHeight : (τ < times.move.1 + 0.05 ? max(originHeight, restHeight) : restHeight)
        frame.jarHit = τ < times.move.1 ? (fromBig ? layout.bigJarRect : layout.restJarRect(oldPaper!)) : layout.restJarRect(paper)
        if !fromBig { frame.charmsOpacity = 1 }
        frame.isPulling = τ < times.unfoldEnd

        // The jar: blended in from the "finding" loop, then the pull's own squash, spring and lid pop.
        let badgeBefore = badge(input.newCount, pulls: step.pullsBefore)
        let badgeAfter = badge(input.newCount, pulls: step.pulls)
        // The idle loops keep going underneath and ease into the resting jar's (still, or wiggling if more are new).
        let lively = idlePose(input.now, lively: true, wiggle: 0, badge: badgeBefore ?? badgeAfter)
        let base = mix(lively, frame.pose, smooth(seg(τ, times.end - 1.3, times.end - 0.2)))
        var pose = pullPose(τ, times: times, base: base)
        badgeChange(&pose, τ: τ, at: times.rise.1 - 0.12, before: badgeBefore, after: badgeAfter)
        frame.countLine = countLine(pose.badgeText)
        if let before, before.phase == .pulling, τ < blendIn {
            pose = mix(pullingPose(input, step: before, pulls: step.pullsBefore), pose, smooth(τ / blendIn))
        }
        frame.pose = pose
        frame.charmsOpacity = 1

        // Big-jar words fade as the note comes out; the small jar's captions return once it's settled.
        if fromBig {
            frame.tagOpacity = 1 - smooth(seg(τ, 0.05, 0.32))
            let big = bigCaption(layout, before?.phase == .pulling ? "finding a little note for u…" : waitingCaption(input.newCount, pulls: step.pullsBefore), JarPalette.muted)
            let rest = frame.captions.map { ($0.0, $0.1 * smooth(seg(τ, times.move.1 + 0.2, times.move.1 + 0.6))) }
            frame.captions = [(big, 1 - smooth(seg(τ, 0.05, 0.3)))] + rest
        } else if let previous = step.previous {
            let old = restCaptions(input, layout: layout, note: previous, pulls: step.pullsBefore, status: ("finding another…", JarPalette.muted))
            let fadeOut = 1 - smooth(seg(τ, 0, 0.22))
            let fadeIn = smooth(seg(τ, times.move.1 + 0.2, times.move.1 + 0.6))
            frame.captions = old.map { ($0.0, $0.1 * fadeOut) } + frame.captions.map { ($0.0, $0.1 * fadeIn) }
        }

        // The note it replaces is swept aside.
        if let previous = step.previous, let oldPaper, τ < times.exit.1 {
            let q = seg(τ, times.exit.0, times.exit.1)
            let e = q * q
            var old = JarPaperFrame(layout: oldPaper, origin: layout.paperRect(oldPaper).origin)
            old.offset = CGSize(width: layout.width * 0.85 * e, height: -26 * e)
            old.rotation = restTilt + 9 * e
            old.opacity = 1 - smooth(seg(τ, times.exit.1 * 0.3, times.exit.1))
            _ = previous
            frame.oldPaper = old
        }

        // The note: rising inside the jar, then floating free, then unfolding.
        let start = CGPoint(x: 180, y: 262), top = CGPoint(x: 178, y: 34)
        let packet = CGSize(width: 58, height: 43)
        func attached(_ t: Double) -> JarAttachedNote {
            let q = seg(t, times.rise.0, times.rise.1)
            let y = inOutSine(q)
            return JarAttachedNote(center: CGPoint(x: lerp(start.x, top.x, y) + 3 * CGFloat(sin(.pi * q)), y: lerp(start.y, top.y, y)),
                                   scale: lerp(0.62, 1.0, outCubic(q)), rotation: -8 + 14 * inOutSine(q))
        }
        frame.paper = nil
        if τ >= times.rise.0 && τ < times.rise.1 {
            frame.attached = attached(τ)
        } else if τ >= times.rise.1 && τ < times.flightEnd {
            let exit = attached(times.rise.1)
            let exitPlacement = placement(at: times.rise.1)
            let exitPose = pullPose(times.rise.1, times: times, base: JarPose())
            let toScene = JarArtist.vesselTransform(exitPose).concatenating(exitPlacement.transform)
            let e0 = exit.center.applying(toScene)
            let s0 = CGSize(width: packet.width * exit.scale * exitPlacement.scale, height: packet.height * exit.scale * exitPlacement.scale)
            let r0 = exit.rotation + exitPose.rotation
            let rect = layout.paperRect(paper)
            let c1 = CGPoint(x: rect.midX, y: rect.minY + paper.panelHeight / 2)
            let s1 = CGSize(width: rect.width, height: paper.panelHeight)
            let q = seg(τ, times.rise.1, times.flightEnd)
            let t = inOutCubic(q)
            let lift = fromBig ? min(16, e0.y - s0.height / 2 - 6) : 70
            let c0 = CGPoint(x: e0.x, y: e0.y - max(0, lift))
            let c2 = CGPoint(x: c1.x, y: c1.y + (fromBig ? -6 : 36))
            frame.flying = JarFlyingNote(center: bezier(e0, c0, c2, c1, t),
                                         size: CGSize(width: lerp(s0.width, s1.width, t), height: lerp(s0.height, s1.height, t)),
                                         rotation: r0 * (1 - outCubic(q)) - 2.5 * sin(.pi * t) * (1 - t),
                                         shadow: lerp(0.08, JarPaperView.shadowOpacity, t) + 0.06 * sin(.pi * t), lift: lerp(0.5, 1, t) + 0.6 * sin(.pi * t))
        } else if τ >= times.flightEnd {
            var sheet = JarPaperFrame(layout: paper, origin: layout.paperRect(paper).origin)
            sheet.fold1 = 180 * (1 - inOutSine(seg(τ, times.unfold1.0, times.unfold1.1)))
            sheet.fold2 = paper.panels == 3 ? 180 * (1 - inOutSine(seg(τ, times.unfold2.0, times.unfold2.1))) : 0
            sheet.tape = seg(τ, times.tape.0, times.tape.1)
            sheet.sheet = smooth(seg(τ, times.unfoldEnd - 0.25, times.unfoldEnd + 0.1))
            sheet.rotation = restTilt * inOutCubic(seg(τ, times.tape.0, times.tape.0 + 0.4))
            frame.paper = sheet
        }

        // Little red hearts: a few spill from the mouth as the lid pops, and the seal bursts into hearts as the letter opens.
        var particles: [JarParticle] = []
        let popPlacement = placement(at: times.lidPop.0)
        let mouth = CGPoint(x: 180, y: 112).applying(popPlacement.transform)
        let puff = max(0.6, popPlacement.scale / 0.72)
        let puffs: [(CGFloat, CGFloat, CGFloat, Double)] = [(-62, -34, 11, 0), (-30, -58, 8.5, 0.07), (56, -44, 10, 0.04)]
        for (index, spec) in puffs.enumerated() {
            let t = (τ - times.lidPop.0 - 0.04 - spec.3) / 0.8
            guard t > 0, t < 1 else { continue }
            let p = outCubic(t)
            particles.append(JarParticle(center: CGPoint(x: mouth.x + spec.0 * puff * CGFloat(p), y: mouth.y + spec.1 * puff * CGFloat(p) + 10 * CGFloat(t * t)),
                                         height: spec.2 * puff * CGFloat(0.4 + 0.6 * outBack(min(1, t * 3.5))),
                                         rotation: (index.isMultiple(of: 2) ? -16 : 14) * (1 - t),
                                         opacity: min(1, t * 9) * (1 - smooth(seg(t, 0.45, 1)))))
        }
        let rect = layout.paperRect(paper)
        let seal = CGPoint(x: rect.midX, y: rect.minY + paper.panelHeight * 0.5)
        let burst: [(CGFloat, CGFloat, CGFloat, Double)] = [(-128, -22, 11, 0), (-70, -50, 13, 0.03), (8, -62, 10, 0.07), (78, -46, 13, 0.02), (134, -18, 10, 0.06)]
        for (index, spec) in burst.enumerated() {
            let t = (τ - times.hearts - spec.3) / 1.1
            guard t > 0, t < 1 else { continue }
            let p = outCubic(min(1, t * 1.15))
            particles.append(JarParticle(center: CGPoint(x: seal.x + spec.0 * CGFloat(p), y: seal.y + spec.1 * CGFloat(p) - 14 * CGFloat(t)),
                                         height: spec.2 * CGFloat(0.35 + 0.65 * outBack(min(1, t * 3))),
                                         rotation: (index.isMultiple(of: 2) ? 12 : -12) * (1 - t),
                                         opacity: min(1, t * 10) * (1 - smooth(seg(t, 0.5, 1)))))
        }
        frame.particles = particles
        frame.hint = frame.isPulling ? "a note is coming out" : frame.hint
        return frame
    }

    /// The jar's own movement during a pull (art units).
    private static func pullPose(_ τ: Double, times: PullTimes, base: JarPose) -> JarPose {
        var pose = base
        let end = times.squash.1
        let a = seg(τ, times.squash.0, end)
        let b = seg(τ, end, end + 0.14)
        let c = seg(τ, end + 0.14, end + 0.34)
        let d = seg(τ, end + 0.34, end + 0.52)
        var sy = 1 - 0.06 * inOutSine(a)
        sy += 0.11 * outCubic(b)
        sy -= 0.065 * inOutSine(c)
        sy += 0.015 * outCubic(d)
        // Settling into its new place, it lands with a little squash.
        let landing = seg(τ, times.move.1 - 0.06, times.move.1 + 0.26)
        sy -= 0.05 * CGFloat(sin(.pi * min(1, landing * 1.6)) * (1 - landing))
        if let stage = times.stage {
            let arrive = seg(τ, stage.1 - 0.06, stage.1 + 0.2)
            sy -= 0.035 * CGFloat(sin(.pi * min(1, arrive * 1.6)) * (1 - arrive))
        }
        pose.squashY = base.squashY * sy
        pose.squashX = base.squashX * (1 + (1 - sy) * 0.6)
        pose.hop = base.hop - 8 * outCubic(b) * (1 - inCubic(c))
        let pop = outBack(seg(τ, times.lidPop.0, times.lidPop.1), 1.5)
        let back = inOutCubic(seg(τ, times.lidBack.0, times.lidBack.1))
        let open = pop * (1 - back)
        let clunk = sin(.pi * seg(τ, times.lidBack.1, times.lidBack.1 + 0.16))
        pose.lidOffset = CGSize(width: base.lidOffset.width + 16 * open, height: base.lidOffset.height - 46 * open + 2.5 * clunk)
        pose.lidRotation = base.lidRotation + 14 * open - 2 * clunk
        let tumble = seg(τ, end, end + 0.55)
        for index in 0..<8 {
            let sign: Double = index.isMultiple(of: 2) ? 1 : -1
            pose.noteTilts[index] += keyframes(tumble, [(0, 0), (0.3, -6), (0.65, 4), (1, 0)]) * sign
            pose.notes[index].dy += keyframes(tumble, [(0, 0), (0.3, -4), (0.65, -1), (1, 0)])
        }
        return pose
    }

    /// The red heart's count ticks down as the note leaves the jar (it pops, or it goes when none are left).
    private static func badgeChange(_ pose: inout JarPose, τ: Double, at time: Double, before: String?, after: String?) {
        guard before != after else { return }
        let t = seg(τ, time, time + 0.34)
        if let after {
            pose.badgeText = t < 0.32 ? before : after
            pose.badgePop = 1 + 0.32 * CGFloat(sin(.pi * t))
        } else {
            pose.badgeText = before
            pose.badgePop = 1 + 0.25 * CGFloat(sin(.pi * min(1, t * 2.2))) - CGFloat(inCubic(seg(t, 0.25, 1)))
            pose.badgeOpacity = 1 - smooth(seg(t, 0.45, 1))
            if t >= 1 { pose.badgeText = nil }
        }
    }

    // MARK: blending

    static func mix(_ a: JarPose, _ b: JarPose, _ w: Double) -> JarPose {
        if w <= 0 { return a }
        if w >= 1 { return b }
        var pose = b
        pose.rotation = lerp(a.rotation, b.rotation, w)
        pose.squashX = lerp(a.squashX, b.squashX, w)
        pose.squashY = lerp(a.squashY, b.squashY, w)
        pose.hop = lerp(a.hop, b.hop, w)
        pose.lidOffset = CGSize(width: lerp(a.lidOffset.width, b.lidOffset.width, w), height: lerp(a.lidOffset.height, b.lidOffset.height, w))
        pose.lidRotation = lerp(a.lidRotation, b.lidRotation, w)
        for index in 0..<8 {
            pose.notes[index] = CGVector(dx: lerp(a.notes[index].dx, b.notes[index].dx, w), dy: lerp(a.notes[index].dy, b.notes[index].dy, w))
            pose.noteTilts[index] = lerp(a.noteTilts[index], b.noteTilts[index], w)
        }
        for index in 0..<4 {
            pose.charmLift[index] = lerp(a.charmLift[index], b.charmLift[index], w)
            pose.charmOpacity[index] = lerp(a.charmOpacity[index], b.charmOpacity[index], w)
        }
        pose.badgeScale = lerp(a.badgeScale, b.badgeScale, w)
        pose.badgePop = lerp(a.badgePop, b.badgePop, w)
        pose.badgeOpacity = lerp(a.badgeOpacity, b.badgeOpacity, w)
        pose.twinkles = a.twinkles.map { var t = $0; t.opacity *= 1 - w; return t } + b.twinkles.map { var t = $0; t.opacity *= w; return t }
        return pose
    }

    /// The old words fade out, then the new ones fade in (never two lines of words on top of each other).
    private static func crossfadeCaptions(from: [(JarCaptionLayout, Double)], to: [(JarCaptionLayout, Double)], w: Double) -> [(JarCaptionLayout, Double)] {
        if w >= 1 { return to }
        let out = 1 - smooth(w / 0.45), into = smooth((w - 0.45) / 0.55)
        return from.map { ($0.0, $0.1 * out) } + to.map { ($0.0, $0.1 * into) }
    }

    // MARK: easing

    static func frac(_ x: Double) -> Double { x - floor(x) }
    static func seg(_ t: Double, _ a: Double, _ b: Double) -> Double { b <= a ? (t >= b ? 1 : 0) : min(1, max(0, (t - a) / (b - a))) }
    static func smooth(_ x: Double) -> Double { let x = min(1, max(0, x)); return x * x * (3 - 2 * x) }
    static func inOutSine(_ x: Double) -> Double { 0.5 - 0.5 * cos(.pi * min(1, max(0, x))) }
    static func inOutCubic(_ x: Double) -> Double { let x = min(1, max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2 }
    static func outCubic(_ x: Double) -> Double { let x = min(1, max(0, x)); return 1 - pow(1 - x, 3) }
    static func inCubic(_ x: Double) -> Double { let x = min(1, max(0, x)); return x * x * x }
    static func outBack(_ x: Double, _ s: Double = 1.70158) -> Double {
        let x = min(1, max(0, x)) - 1
        return 1 + (s + 1) * x * x * x + s * x * x
    }
    /// CSS "ease-in-out" (cubic-bezier(.42, 0, .58, 1)), the app's keyframe easing.
    static func cssEaseInOut(_ x: Double) -> Double {
        let x = min(1, max(0, x))
        var t = x
        for _ in 0..<6 {
            let bx = 3 * (1 - t) * (1 - t) * t * 0.42 + 3 * (1 - t) * t * t * 0.58 + t * t * t
            let dx = 3 * (1 - t) * (1 - t) * 0.42 + 6 * (1 - t) * t * (0.58 - 0.42) + 3 * t * t * (1 - 0.58)
            if abs(dx) < 1e-6 { break }
            t = min(1, max(0, t - (bx - x) / dx))
        }
        return 3 * (1 - t) * t * t + t * t * t
    }
    /// CSS @keyframes with the same easing on every segment.
    static func keyframes(_ p: Double, _ frames: [(Double, Double)]) -> Double {
        guard let first = frames.first else { return 0 }
        if p <= first.0 { return first.1 }
        for index in 1..<frames.count where p <= frames[index].0 {
            let a = frames[index - 1], b = frames[index]
            return a.1 + (b.1 - a.1) * cssEaseInOut((p - a.0) / max(1e-9, b.0 - a.0))
        }
        return frames[frames.count - 1].1
    }
    static func lerp(_ a: CGFloat, _ b: CGFloat, _ t: Double) -> CGFloat { a + (b - a) * CGFloat(t) }
    static func lerp(_ a: Double, _ b: Double, _ t: Double) -> Double { a + (b - a) * t }
    static func lerp(_ a: CGPoint, _ b: CGPoint, _ t: Double) -> CGPoint { CGPoint(x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t)) }
    static func bezier(_ p0: CGPoint, _ p1: CGPoint, _ p2: CGPoint, _ p3: CGPoint, _ t: Double) -> CGPoint {
        let t = CGFloat(t), u = 1 - t
        let a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
        return CGPoint(x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y)
    }
}
