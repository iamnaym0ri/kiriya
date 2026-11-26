import SwiftUI

/// What the little note says (from the push: NoteCardModel.load).
struct LetterContent: Equatable {
    var heading: String      // e.g. "a little note for you ✉︎"
    var title: String?       // the note's title, may be nil
    var text: String         // the whole note: one line up to ~1500 characters, paragraphs and emoji welcome
    var byline: String       // e.g. "— Josh"; may be empty
    var truncated: Bool      // true → a small "the rest is waiting in the app ❤️"

    init(heading: String, title: String? = nil, text: String, byline: String = "", truncated: Bool = false) {
        self.heading = heading
        self.title = title
        self.text = text
        self.byline = byline
        self.truncated = truncated
    }
}

/// The little note's card: a sealed, lace-trimmed envelope tied with a bow that breathes while it
/// waits; once `isOpen` turns true it opens itself (2.8 seconds) and the note comes to rest on top
/// of the open envelope. It draws its own background and has a definite height for any width
/// (sealed ≈ 306–334pt, open up to `maxHeight`), so the host can size the notification from it.
///
/// - `isOpen`: false while sealed. Flip it to true (on `onTapSealed`, or the notification's "Open
///   note" button) and the opening plays once, then rests open. A card that appears already open
///   shows the note at rest; one flipped back to false (a new notification in a reused extension)
///   is sealed again.
/// - `onTapSealed`: a tap anywhere on the sealed card (VoiceOver: the "Open the note" button).
struct LetterCard: View {
    let content: LetterContent
    let isOpen: Bool
    var onTapSealed: () -> Void = {}
    /// The open card's tallest (long notes stop short with "the rest is waiting in the app").
    /// Lower it if the host stacks anything under the card within its 720pt.
    var maxHeight: CGFloat = LetterGeometry.defaultMaxHeight

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var clockStart = Date()
    @State private var phase = Phase.sealed

    private enum Phase: Equatable {
        case sealed
        /// Opening since `start`, carrying on from where the idle loop was at that moment.
        case opening(start: Date, idle: Double)
        case open
    }

    var body: some View {
        // The size follows `isOpen` at once (one change for the host to follow); what is drawn
        // follows `phase`, which starts the opening (or, with Reduce Motion, a short crossfade).
        LetterSizer(content: content, open: isOpen, maxHeight: maxHeight) {
            GeometryReader { proxy in
                stage(width: proxy.size.width)
            }
        }
        // Even if the host flips `isOpen` inside withAnimation, the size changes in one step (the
        // envelope's glide is the animation), so the host sees one height, not a stream of them.
        .animation(nil, value: isOpen)
        .background(LetterPalette.background)
        .contentShape(Rectangle())
        // The whole sealed card is the tap target; once open it leaves taps alone.
        .gesture(TapGesture().onEnded { if !isOpen { onTapSealed() } }, including: isOpen ? .subviews : .all)
        .onAppear {
            LetterFonts.registerIfNeeded()
            if isOpen { phase = .open }
        }
        .onChange(of: isOpen) { _, open in
            guard open else {
                phase = .sealed
                clockStart = Date()
                return
            }
            guard phase == .sealed else { return }
            if reduceMotion {
                withAnimation(.easeInOut(duration: 0.35)) { phase = .open }
                return
            }
            let now = Date()
            phase = .opening(start: now, idle: now.timeIntervalSince(clockStart))
            // Only to stop the clock once the opening is over; the motion itself is all in LetterGeometry.
            DispatchQueue.main.asyncAfter(deadline: .now() + LetterGeometry.duration + 0.1) {
                if case .opening = phase { phase = .open }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(isOpen ? spokenNote : "Open the note"))
        .accessibilityHint(Text(isOpen ? "" : content.heading))
        .accessibilityAddTraits(isOpen ? [] : .isButton)
        .accessibilityAction { if !isOpen { onTapSealed() } }
    }

    @ViewBuilder
    private func stage(width: CGFloat) -> some View {
        switch phase {
        case .sealed:
            if reduceMotion {
                LetterScene(content: content, time: nil, idle: 0, width: width, maxHeight: maxHeight)
                    .transition(.opacity)
            } else {
                // The idle loop is gentle, so 30 frames a second is plenty.
                TimelineView(.animation(minimumInterval: 1.0 / 30)) { timeline in
                    LetterScene(content: content, time: nil, idle: timeline.date.timeIntervalSince(clockStart), width: width, maxHeight: maxHeight)
                }
            }
        case .opening(let start, let idle):
            TimelineView(.animation) { timeline in
                LetterScene(content: content, time: max(0, timeline.date.timeIntervalSince(start)), idle: idle, width: width, maxHeight: maxHeight)
            }
        case .open:
            LetterScene(content: content, time: LetterGeometry.duration, width: width, maxHeight: maxHeight)
                .transition(.opacity)
        }
    }

    private var spokenNote: String {
        var parts: [String] = []
        if let title = content.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty { parts.append(title) }
        parts.append(content.text)
        let byline = content.byline.trimmingCharacters(in: .whitespacesAndNewlines)
        if !byline.isEmpty { parts.append(byline) }
        // VoiceOver reads the whole note even where the paper had to stop short.
        if content.truncated { parts.append("The rest is waiting in the app.") }
        return parts.joined(separator: ". ")
    }
}

/// Gives the card its natural size: all the width it is offered, and the height the letter needs at
/// that width (sealed or open), worked out up front so the host can measure it in one pass.
struct LetterSizer: Layout {
    let content: LetterContent
    let open: Bool
    var maxHeight: CGFloat = LetterGeometry.defaultMaxHeight

    private func width(_ proposal: ProposedViewSize) -> CGFloat {
        guard let w = proposal.width, w.isFinite, w > 0 else { return 343 }
        return w
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = width(proposal)
        return CGSize(width: w, height: LetterGeometry.height(content: content, width: w, open: open, maxHeight: maxHeight))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for subview in subviews {
            subview.place(at: bounds.origin, anchor: .topLeading, proposal: ProposedViewSize(bounds.size))
        }
    }
}
