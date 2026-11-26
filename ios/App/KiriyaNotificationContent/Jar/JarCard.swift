import SwiftUI

// The note jar card for the jar's notifications (the 08:00 "new little notes" push and the evening
// reminder), pressed and held. It is the app's own jar (src/world/today/NoteJar.jsx): same glass,
// lid, ribbon and bow, the same folded notes inside, the red heart with the count of new notes and
// the little wiggle. Tapping the jar (or the "Pull one ✨" button) makes the host pull a note; while
// that's on its way the jar hops and rattles; then the note rises out of the jar, flies up, unfolds
// into the app's paper, and rests there with the small jar underneath for another.
//
// Files: JarCard (this: the public types and the live clock), JarTimeline (the motion, a pure
// function of time), JarScene (drawing), JarLayout (geometry), JarArt (the jar's paths and colours,
// from NoteJar.jsx), JarText (Gaegu + CoreText). Resource: JarGaegu-Regular.ttf (SIL OFL).

/// A note pulled from the jar (server/lib/noteJar.js jarNote + pullNote).
struct JarPulledNote: Equatable {
    /// The note itself: one line, up to ~600 characters.
    var text: String
    /// "— Josh <3"; may be empty.
    var byline: String
    /// The line at the top of the paper, e.g. "for the 47-tabs-open days"; may be nil.
    var label: String?
    /// On Josh's test phone: a preview that leaves her jar as it is.
    var isPreview: Bool

    init(text: String, byline: String = "", label: String? = nil, isPreview: Bool = false) {
        self.text = text
        self.byline = byline
        self.label = label
        self.isPreview = isPreview
    }
}

enum JarCardState: Equatable {
    /// The sealed jar, idling as it does in the app.
    case waiting
    /// The pull is on its way (0.2–3 s): the jar hops and rattles until the note arrives.
    case pulling
    /// The note comes out and rests.
    case pulled(JarPulledNote)
    /// A gentle message; the jar goes back to waiting and a tap tries again.
    case failed(String)
}

struct JarCard: View {
    /// The notification's title, e.g. "2 new little notes in your jar ❤️" or the evening reminder.
    let heading: String
    /// New notes in the jar, parsed from the push when known (nil = unknown): the red heart's count.
    let newCount: Int?
    let state: JarCardState
    /// A tap on the jar. The "Pull one/another" button outside the card does the same in the host.
    var onPull: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var story: JarStory
    @State private var still = false

    init(heading: String, newCount: Int?, state: JarCardState, onPull: @escaping () -> Void = {}) {
        self.heading = heading
        self.newCount = newCount
        self.state = state
        self.onPull = onPull
        _story = State(initialValue: JarStory(initial: state))
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: still)) { timeline in
            JarCardMoment(heading: heading, newCount: newCount, story: story,
                          time: timeline.date.timeIntervalSinceReferenceDate, reduceMotion: reduceMotion, onPull: onPull)
                // The clock drives every movement; a host's withAnimation around a state change must not add its own.
                .transaction { $0.animation = nil }
        }
        .onChange(of: state) { _, next in
            story.advance(to: next, at: Date().timeIntervalSinceReferenceDate)
            still = false
        }
        // Once nothing moves any more (a note resting, nothing new left), the clock stops.
        .task(id: StillKey(story: story, reduceMotion: reduceMotion, newCount: newCount)) {
            still = false
            while !Task.isCancelled {
                let input = JarTimeline.Input(heading: heading, newCount: newCount, story: story,
                                              now: Date().timeIntervalSinceReferenceDate, reduceMotion: reduceMotion, width: 375)
                if JarTimeline.isStill(input) {
                    still = true
                    return
                }
                try? await Task.sleep(nanoseconds: 400_000_000)
            }
        }
        .environment(\.colorScheme, .light)
    }

    private struct StillKey: Equatable {
        var story: JarStory
        var reduceMotion: Bool
        var newCount: Int?
    }

    /// The count of new notes in a jar push title ("2 new little notes in your jar ❤️" → 2,
    /// "a little note has been waiting since this morning ♡" → 1), or nil when it doesn't say.
    static func newCount(fromTitle title: String) -> Int? {
        let lower = title.lowercased()
        let digits = lower.split(whereSeparator: { !$0.isNumber }).first.flatMap { Int($0) }
        if let digits, lower.contains("note") { return digits }
        if lower.contains("a new little note") || lower.contains("a little note") || lower.contains("a new note") { return 1 }
        return nil
    }
}

/// The card at one instant: a pure function of its inputs. JarCard feeds it the clock; the lab feeds it
/// exact times to render frames.
struct JarCardMoment: View {
    let heading: String
    let newCount: Int?
    let story: JarStory
    let time: Double
    var reduceMotion = false
    var onPull: () -> Void = {}

    private func input(_ width: CGFloat) -> JarTimeline.Input {
        JarTimeline.Input(heading: heading, newCount: newCount, story: story, now: time, reduceMotion: reduceMotion, width: width)
    }

    var body: some View {
        JarHeightLayout(height: { JarTimeline.height(input($0)) }) {
            GeometryReader { proxy in
                let frames = JarTimeline.frames(input(proxy.size.width))
                ZStack(alignment: .topLeading) {
                    ForEach(frames.indices, id: \.self) { index in
                        JarScene(frame: frames[index].0, heading: heading, interactive: index == frames.count - 1, onPull: onPull)
                            .opacity(frames[index].1)
                    }
                }
            }
        }
    }
}

/// Takes the width it's offered and answers with the card's natural height for that width, so the
/// host's measuring (fixedSize + a height preference) gets a real, finite height in every state.
struct JarHeightLayout: Layout {
    var height: (CGFloat) -> CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        var width = proposal.width ?? 375
        if !width.isFinite || width <= 0 { width = 375 }
        return CGSize(width: width, height: height(width))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for subview in subviews {
            subview.place(at: bounds.origin, proposal: ProposedViewSize(width: bounds.width, height: bounds.height))
        }
    }
}
