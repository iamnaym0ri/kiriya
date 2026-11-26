import SwiftUI

/// What a letter says (from its push; see the host notes in ios/CardLab/FormalLetter/PROGRESS.md).
struct FormalLetterContent: Equatable {
    var heading: String          // the push title, e.g. "a new letter for you ✉"
    var title: String            // the letter's title ("" for none)
    var text: String             // the body (paragraphs separated by blank lines), may be long
    var from: String             // "Josh" / "Maomao" (signature; "" for none)
    var kind: String?            // "birthday" | "open_when" | "note"
    var openWhen: String?        // e.g. "you miss me"
    var date: Date?              // when it was written / sent
    var lockedUntil: Date?       // non-nil and in the future → locked
    var truncated: Bool          // the push carried only part of the text

    init(heading: String = "a new letter for you \u{2709}", title: String = "", text: String, from: String = "Josh",
         kind: String? = nil, openWhen: String? = nil, date: Date? = nil, lockedUntil: Date? = nil, truncated: Bool = false) {
        self.heading = heading
        self.title = title
        self.text = text
        self.from = from
        self.kind = kind
        self.openWhen = openWhen
        self.date = date
        self.lockedUntil = lockedUntil
        self.truncated = truncated
    }
}

/// A letter's card: the keepsake sibling of the little note. A blush, gilt-edged envelope with a
/// plum liner, addressed in script and sealed with claret wax pressed with a K, waits with a slow
/// breath and a glint on the wax. Once `isOpen` turns true it opens itself (3.2 seconds): the seal
/// breaks, the flap lifts, the letter (ivory cotton, deckled and gilded, folded in thirds) rises
/// out, comes forward, unfolds and settles, hiding the envelope behind it. The card draws its own
/// background and margins and has a definite height for any width, so the host can size the
/// notification from it; the height changes once, when `isOpen` does.
///
/// - `isOpen`: false while sealed. Flip it to true (on `onTapSealed`, or the notification's "Open
///   letter 💌" button) and the opening plays once, then rests open. A card that appears already
///   open shows the letter at rest; flipped back to false (a new notification in a reused
///   extension), it's sealed again.
/// - `onTapSealed`: a tap anywhere on the sealed card (VoiceOver: the "Open the letter" button).
///   Never called for a locked letter: a tap on one just gives a small "not yet" shake.
/// - `scrollable`: a letter too long for the card scrolls inside its paper (true), or stops with
///   "the rest is waiting in the app ❤️" (false).
/// - `maxHeight`: the open card's tallest (the host caps the notification at 720pt).
struct FormalLetterCard: View {
    let content: FormalLetterContent
    let isOpen: Bool
    var onTapSealed: () -> Void = {}
    var scrollable: Bool = true
    var maxHeight: CGFloat = FormalLetterGeometry.defaultMaxHeight

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var clockStart = Date()
    @State private var phase = Phase.sealed
    @State private var wiggleStart: Date?
    @State private var nudged = false

    private enum Phase: Equatable {
        case sealed
        /// Opening since `start`, carrying on from where the idle loop was at that moment.
        case opening(start: Date, idle: Double)
        case open
    }

    var body: some View {
        let locked = content.isLocked()
        // The size follows `isOpen` at once (one change for the host to follow); what is drawn
        // follows `phase`, which starts the opening (or, with Reduce Motion, a short crossfade).
        FormalLetterSizer(content: content, open: isOpen && !locked, maxHeight: maxHeight, scrollable: scrollable, locked: locked) {
            GeometryReader { proxy in
                stage(width: proxy.size.width, locked: locked)
            }
        }
        // Even if the host flips `isOpen` inside withAnimation, the size changes in one step (the
        // letter's own choreography is the animation), so the host sees one height, not a stream.
        .animation(nil, value: isOpen)
        .background(FormalLetterPalette.background)
        .contentShape(Rectangle())
        // The whole sealed card is the tap target; once open it leaves touches (scrolling) alone.
        .gesture(TapGesture().onEnded { tapped() }, including: isOpen && !locked ? .subviews : .all)
        .onAppear {
            FormalLetterFonts.loadIfNeeded()
            if isOpen && !locked { phase = .open }
        }
        .onChange(of: isOpen) { _, open in
            guard open else {
                phase = .sealed
                clockStart = Date()
                return
            }
            if content.isLocked() {
                notYet()
                return
            }
            guard phase == .sealed else { return }
            if reduceMotion {
                // A separate transaction from the host's, so its animation can't change this one.
                DispatchQueue.main.async {
                    withAnimation(.easeInOut(duration: 0.35)) { phase = .open }
                }
                return
            }
            let now = Date()
            var transaction = Transaction(animation: nil)
            transaction.disablesAnimations = true
            withTransaction(transaction) {
                phase = .opening(start: now, idle: now.timeIntervalSince(clockStart))
            }
            // Only to stop the clock once the opening is over; the motion itself is all in FormalLetterGeometry.
            DispatchQueue.main.asyncAfter(deadline: .now() + FormalLetterGeometry.duration + 0.05) {
                if case .opening = phase {
                    withTransaction(transaction) { phase = .open }
                }
            }
        }
        .onChange(of: content) { _, _ in
            if !isOpen { clockStart = Date() }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(accessibilityLabel(locked: locked)))
        .accessibilityHint(Text(isOpen || locked ? "" : spokenEnvelope))
        .accessibilityAddTraits(isOpen || locked ? [] : .isButton)
        .accessibilityAction { tapped() }
    }

    private func tapped() {
        if content.isLocked() {
            notYet()
        } else if !isOpen {
            onTapSealed()
        }
    }

    /// A locked letter answers a tap with a small shake (with Reduce Motion, its date line darkens a moment).
    private func notYet() {
        if reduceMotion {
            withAnimation(.easeInOut(duration: 0.2)) { nudged = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
                withAnimation(.easeInOut(duration: 0.3)) { nudged = false }
            }
            return
        }
        let start = Date()
        wiggleStart = start
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.85) {
            if wiggleStart == start { wiggleStart = nil }
        }
    }

    @ViewBuilder
    private func stage(width: CGFloat, locked: Bool) -> some View {
        let sealed = locked || phase == .sealed
        if reduceMotion {
            // No idle motion; the opening is a short crossfade between the two still scenes. The
            // open one is there (all but transparent) from the start, so the fade begins at once.
            ZStack(alignment: .topLeading) {
                if !locked {
                    scene(width: width, time: FormalLetterGeometry.duration, locked: false, interactive: true)
                        .opacity(sealed ? FormalLetterScene.unseen : 1)
                        .allowsHitTesting(!sealed)
                }
                scene(width: width, time: nil, locked: locked, interactive: true)
                    .opacity(sealed ? 1 : 0)
                    .allowsHitTesting(sealed)
            }
        } else {
            // One clock and one scene for the whole life of the card (sealed, opening, open), so
            // nothing is rebuilt as it moves from one to the next. The idle loop is slow, so 30
            // frames a second is plenty; the opening and a "not yet" shake run at the display's
            // rate; at rest the clock stops.
            let opening: Bool = { if case .opening = phase { return true } else { return false } }()
            let fast = (!locked && opening) || wiggleStart != nil
            TimelineView(.animation(minimumInterval: fast ? nil : 1.0 / 30, paused: !locked && phase == .open)) { timeline in
                let clock = self.clock(at: timeline.date, locked: locked)
                scene(width: width, time: clock.time, idle: clock.idle, wiggle: clock.wiggle, locked: locked, interactive: true)
            }
        }
    }

    private func clock(at date: Date, locked: Bool) -> (time: Double?, idle: Double, wiggle: Double?) {
        let wiggle = wiggleStart.map { date.timeIntervalSince($0) }
        if locked { return (nil, date.timeIntervalSince(clockStart), wiggle) }
        switch phase {
        case .sealed: return (nil, date.timeIntervalSince(clockStart), wiggle)
        case .opening(let start, let idle): return (max(0, date.timeIntervalSince(start)), idle, nil)
        case .open: return (FormalLetterGeometry.duration, 0, nil)
        }
    }

    private func scene(width: CGFloat, time: Double?, idle: Double = 0, wiggle: Double? = nil, locked: Bool, interactive: Bool = false) -> some View {
        FormalLetterScene(content: content, time: time, idle: idle, wiggle: wiggle, width: width, maxHeight: maxHeight,
                          scrollable: scrollable, locked: locked, interactive: interactive, emphasis: nudged ? 1 : 0)
    }

    // MARK: VoiceOver

    private func accessibilityLabel(locked: Bool) -> String {
        if locked { return content.spokenLocked }
        return isOpen ? content.spokenLetter : "Open the letter"
    }

    private var spokenEnvelope: String { content.spokenEnvelope }
}

extension FormalLetterContent {
    /// What VoiceOver says about the sealed envelope (the hint under "Open the letter").
    var spokenEnvelope: String {
        let lines = envelopeLines
        return Self.spoken([heading, lines.primary, lines.secondary ?? ""])
    }

    var spokenLocked: String {
        Self.spoken(["A sealed letter. It \(lockedLine() ?? "opens later")", spokenEnvelope])
    }

    /// The whole letter, in reading order (even where the paper had to stop short).
    var spokenLetter: String {
        var parts: [String] = []
        if let label = fanLabel { parts.append(label) }
        if let title = cleanTitle { parts.append(title) }
        if let openWhen = openWhenLine { parts.append(openWhen) }
        if let date { parts.append(Self.formatted(date, withYear: true)) }
        let split = salutationAndBody
        if let salutation = split.salutation { parts.append(salutation) }
        parts.append(split.body)
        if truncated {
            parts.append("The rest is waiting in the app.")
        } else {
            parts.append(closing.replacingOccurrences(of: " \u{2014}", with: ","))
            if !signature.isEmpty { parts.append(signature) }
        }
        return Self.spoken(parts)
    }

    /// Joins spoken parts into sentences, without doubling up punctuation ("Dear Kiriya,." → "Dear Kiriya,").
    static func spoken(_ parts: [String]) -> String {
        parts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map { part in
                guard let last = part.last else { return part }
                return ".,!?:;\u{2026}\u{2014}".contains(last) ? part : part + "."
            }
            .joined(separator: " ")
    }
}

/// Gives the card its natural size: all the width it is offered, and the height the letter needs at
/// that width (sealed or open), worked out up front so the host can measure it in one pass.
struct FormalLetterSizer: Layout {
    let content: FormalLetterContent
    let open: Bool
    var maxHeight: CGFloat = FormalLetterGeometry.defaultMaxHeight
    var scrollable: Bool = true
    var locked: Bool = false

    private func width(_ proposal: ProposedViewSize) -> CGFloat {
        guard let w = proposal.width, w.isFinite, w > 0 else { return 343 }
        return w
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let w = width(proposal)
        return CGSize(width: w, height: FormalLetterGeometry.height(content: content, width: w, open: open, maxHeight: maxHeight,
                                                                    scrollable: scrollable, locked: locked))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for subview in subviews {
            subview.place(at: bounds.origin, anchor: .topLeading, proposal: ProposedViewSize(bounds.size))
        }
    }
}

extension FormalLetterContent {
    /// Reads a letter from its push, given the push title and the `letter` dictionary of the payload
    /// (the same shape as a note's: server/push/apns.js notePayload, plus the letter's own fields):
    /// `title`, `text` (or `body`), `from`, `kind`, `openWhen`, `createdAt`/`date` and `unlockAt` as
    /// ISO 8601 strings or seconds since 1970, and `truncated`. Nil if there's no text.
    init?(heading: String, payload: [String: Any]) {
        guard let text = (payload["text"] as? String) ?? (payload["body"] as? String) else { return nil }
        func date(_ key: String) -> Date? {
            if let seconds = payload[key] as? Double { return Date(timeIntervalSince1970: seconds > 1e11 ? seconds / 1000 : seconds) }
            guard let string = payload[key] as? String else { return nil }
            let withFraction = ISO8601DateFormatter()
            withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return withFraction.date(from: string) ?? ISO8601DateFormatter().date(from: string)
        }
        func string(_ key: String) -> String? {
            guard let value = payload[key] as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
            return value
        }
        self.init(heading: heading,
                  title: string("title") ?? "",
                  text: text,
                  from: string("from") ?? "",
                  kind: string("kind"),
                  openWhen: string("openWhen"),
                  date: date("createdAt") ?? date("date"),
                  lockedUntil: date("unlockAt"),
                  truncated: (payload["truncated"] as? Bool) ?? false)
    }
}
