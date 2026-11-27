import AppIntents
import SwiftUI
import WidgetKit

// The little-note widget, drawn: a note passed to her and taped down on a lilac desk.
//
//   sealed   a new note, folded shut with a strip of washi tape: "for Kiriya · open me ♡". Tapping it
//            peels the tape (NotesWidgetPeelIntent) and the note opens right there.
//   open     the page, torn from a notepad, taped at the top, the words in Josh's handwriting on
//            its rules, signed "— Josh ♡", with when it came.
//   letter   a letter's announcement, folded: tapping opens the letter in the app.
//   sent     Josh's phone: his last note to her, with a "she opened it ♡" stamp once she has.
//   empty / not set up   a blank page saying so, sweetly.

// MARK: - Where things go

struct NotesWidgetGeometry {
    var look: NotesWidgetLook

    private var w: CGFloat { look.canvas.width }
    private var h: CGFloat { look.canvas.height }

    var page: CGRect {
        switch look.size {
        case .small: return CGRect(x: 10, y: 15, width: w - 20, height: h - 25)
        case .medium: return CGRect(x: 11, y: 15, width: w - 22, height: h - 25)
        case .large, .rectangular: return CGRect(x: 12, y: 17, width: w - 24, height: h - 29)
        }
    }

    var pageTilt: Double {
        switch look.size {
        case .small: return -1.4
        case .medium: return -0.7
        case .large, .rectangular: return -0.9
        }
    }

    var pageTape: CGSize {
        switch look.size {
        case .small: return CGSize(width: (w * 0.36).rounded(), height: 17)
        case .medium: return CGSize(width: (w * 0.2).rounded(), height: 18)
        case .large, .rectangular: return CGSize(width: (w * 0.24).rounded(), height: 20)
        }
    }

    var folded: CGRect {
        switch look.size {
        case .small: return CGRect(x: 17, y: 47, width: w - 34, height: h - 62)
        case .medium: return CGRect(x: 20, y: 24, width: (w * 0.43).rounded(), height: h - 46)
        case .large, .rectangular: return CGRect(x: (w * 0.11).rounded(), y: (h * 0.25).rounded(), width: (w * 0.78).rounded(), height: (h * 0.55).rounded())
        }
    }

    var foldedTilt: Double {
        switch look.size {
        case .small: return 2.6
        case .medium: return -3.2
        case .large, .rectangular: return 2.2
        }
    }

    var flapDepth: CGFloat { 0.4 }

    /// The sealing strip: short, across the flap's free edge.
    var sealTape: CGSize {
        switch look.size {
        case .small: return CGSize(width: 46, height: 16)
        case .medium: return CGSize(width: 52, height: 17)
        case .large, .rectangular: return CGSize(width: 70, height: 21)
        }
    }
}

// MARK: - The whole widget

struct NotesWidgetCanvas: View {
    var entry: NotesWidgetEntry
    var look: NotesWidgetLook

    var body: some View {
        let palette = NotesWidgetPalette.make(look)
        ZStack(alignment: .topLeading) {
            if look.size == .rectangular {
                NotesWidgetLockScreen(entry: entry)
            } else {
                NotesWidgetDeskDecor(look: look, scene: entry.scene)
                NotesWidgetDeskWords(entry: entry, look: look, palette: palette)
                    .id("desk-\(entry.scene.paperKey)-\(entry.scene.isSealed)")
                    .transition(NotesWidgetMotion.deskWords)
                NotesWidgetSheet(entry: entry, look: look, palette: palette)
                    .id(entry.scene.paperKey)
                    .transition(NotesWidgetMotion.pass)
            }
        }
        .frame(width: look.canvas.width, height: look.canvas.height, alignment: .topLeading)
        .animation(NotesWidgetMotion.animation, value: entry.scene.paperKey)
        .animation(NotesWidgetMotion.animation, value: entry.scene.isSealed)
    }
}

/// Sparkles on the desk, kept clear of the paper. Not in StandBy or when tinted.
struct NotesWidgetDeskDecor: View {
    var look: NotesWidgetLook
    var scene: NotesWidgetScene

    var body: some View {
        if look.background && !look.tinted {
            NotesWidgetSparkles(spots: spots, color: NotesWidgetPalette.make(look).sparkle, stars: look.dark)
                .frame(width: look.canvas.width, height: look.canvas.height)
        }
    }

    private var spots: [NotesWidgetSparkles.Spot] {
        typealias S = NotesWidgetSparkles.Spot
        let sealed = scene.isSealed
        switch look.size {
        case .small:
            return sealed ? [S(x: 0.9, y: 0.12, size: 5), S(x: 0.07, y: 0.9, size: 3.5), S(x: 0.95, y: 0.95, size: 2)]
                          : [S(x: 0.955, y: 0.06, size: 4), S(x: 0.04, y: 0.95, size: 2.2)]
        case .medium:
            return sealed ? [S(x: 0.95, y: 0.4, size: 5), S(x: 0.52, y: 0.93, size: 3), S(x: 0.97, y: 0.9, size: 2.2), S(x: 0.03, y: 0.08, size: 2.4)]
                          : [S(x: 0.975, y: 0.06, size: 4.5), S(x: 0.02, y: 0.95, size: 2.4)]
        case .large, .rectangular:
            return sealed ? [S(x: 0.1, y: 0.08, size: 6), S(x: 0.92, y: 0.17, size: 4), S(x: 0.07, y: 0.62, size: 3), S(x: 0.93, y: 0.8, size: 6),
                             S(x: 0.16, y: 0.93, size: 2.4)]
                          : [S(x: 0.975, y: 0.035, size: 5), S(x: 0.025, y: 0.97, size: 2.6)]
        }
    }
}

// MARK: - Words written straight on the desk (beside or above a folded note)

struct NotesWidgetDeskWords: View {
    var entry: NotesWidgetEntry
    var look: NotesWidgetLook
    var palette: NotesWidgetPalette

    var body: some View {
        switch entry.scene {
        case .sealed(let note): words(headline: "a new note", from: note.from, note: note, hint: "open me ♡")
        case .letter(let note): words(headline: "a letter", from: note.from, note: note, hint: "tap to open it ✉")
        default: EmptyView()
        }
    }

    private func when(_ note: NotesWidgetNote) -> String? { NotesWidgetDates.phrase(note.at, now: entry.date) }

    @ViewBuilder
    private func words(headline: String, from: String, note: NotesWidgetNote, hint: String) -> some View {
        let w = look.canvas.width
        switch look.size {
        case .small:
            VStack(alignment: .leading, spacing: 1) {
                (Text("\(headline) from ").font(NotesWidgetFonts.font(.hand, size: 15))
                    + Text(from).font(NotesWidgetFonts.font(.handBold, size: 15)))
                    .foregroundStyle(palette.deskInk)
                if let when = when(note) {
                    Text(when).font(NotesWidgetFonts.font(.hand, size: 13)).foregroundStyle(palette.deskSoft)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.leading, 15)
            .padding(.top, 9)
            .frame(width: w * 0.86, alignment: .leading)
        case .medium:
            let left = NotesWidgetGeometry(look: look).folded.maxX + 20
            VStack(alignment: .leading, spacing: 0) {
                Text(headline + (note.kind == .letter ? "" : " ♡"))
                    .font(NotesWidgetFonts.font(.handBold, size: 26)).foregroundStyle(palette.deskInk)
                Text("from \(from)").font(NotesWidgetFonts.font(.script, size: 30)).foregroundStyle(palette.deskInk)
                    .padding(.top, -3)
                if let when = when(note) {
                    Text(when).font(NotesWidgetFonts.font(.hand, size: 15)).foregroundStyle(palette.deskSoft)
                        .padding(.top, 2)
                }
                Spacer(minLength: 0)
                Text(note.kind == .letter ? "tap to open it ✉" : "tap to peel the tape ♡")
                    .font(NotesWidgetFonts.font(.hand, size: 14)).foregroundStyle(palette.deskSoft)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .padding(.top, 22)
            .padding(.bottom, 17)
            .frame(width: w - left - 12, height: look.canvas.height, alignment: .topLeading)
            .offset(x: left)
        case .large, .rectangular:
            VStack(spacing: 2) {
                (Text("\(headline) from ").font(NotesWidgetFonts.font(.hand, size: 24))
                    + Text(from).font(NotesWidgetFonts.font(.handBold, size: 24)))
                    .foregroundStyle(palette.deskInk)
                if let when = when(note) {
                    Text(when).font(NotesWidgetFonts.font(.hand, size: 16)).foregroundStyle(palette.deskSoft)
                }
                Spacer(minLength: 0)
                Text(note.kind == .letter ? "tap to open it in your letters ✉" : "tap to peel the tape ♡")
                    .font(NotesWidgetFonts.font(.hand, size: 16)).foregroundStyle(palette.deskSoft)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.top, 22)
            .padding(.bottom, 18)
            .frame(width: w, height: look.canvas.height)
        }
    }
}

// MARK: - The paper: folded shut, or open on the desk
//
// Four layers, each as big as the widget so they can come and go on their own: the folded note,
// the open page, the sealing tape and the page's tape. Opening a note swaps them with their own
// transitions (the tape peels, the page unfolds, a new strip is pressed down); a different note
// replaces the whole sheet (NotesWidgetCanvas slides it in).

struct NotesWidgetSheet: View {
    var entry: NotesWidgetEntry
    var look: NotesWidgetLook
    var palette: NotesWidgetPalette
    /// The render lab only: draw the peel this many seconds after the tap, each piece where its
    /// transition has it, instead of either state.
    var labPeel: Double? = nil

    private var geometry: NotesWidgetGeometry { NotesWidgetGeometry(look: look) }
    private var canvas: CGSize { look.canvas }

    private var sealedNote: NotesWidgetNote? { if case .sealed(let note) = entry.scene { return note } else { return nil } }
    private var openNote: NotesWidgetNote? { if case .open(let note) = entry.scene { return note } else { return nil } }

    var body: some View {
        ZStack(alignment: .topLeading) {
            if let labPeel, let note = sealedNote {
                peeling(note, progress: labPeel)
            } else {
                if let note = sealedNote {
                    Button(intent: NotesWidgetPeelIntent(noteID: note.openID)) {
                        foldedLayer(note, letter: false)
                    }
                    .buttonStyle(.plain)
                    .invalidatableContent()
                    .accessibilityLabel(Text("A new note from \(note.from). Open it."))
                    .transition(NotesWidgetMotion.letGo(anchor: unit(geometry.folded.center)))
                }
                if let note = openNote {
                    pageLayer(openContent(note), seed: note.key, sent: nil)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(Text(spoken(note)))
                        .transition(NotesWidgetMotion.unfold(anchor: unit(CGPoint(x: geometry.page.midX, y: geometry.page.minY))))
                }
                if let note = sealedNote {
                    Button(intent: NotesWidgetPeelIntent(noteID: note.openID)) {
                        sealTapeLayer(note.key)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHidden(true)
                    .transition(NotesWidgetMotion.peel(anchor: unit(sealTapeEnd)))
                }
                if let note = openNote {
                    pageTapeLayer(note.key)
                        .transition(NotesWidgetMotion.press(anchor: unit(CGPoint(x: geometry.page.midX, y: geometry.page.minY))))
                }
                switch entry.scene {
                case .letter(let note):
                    foldedLayer(note, letter: true)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(Text("A letter from \(note.from)\(note.letterTitle.map { ", \u{201C}\($0)\u{201D}" } ?? ""). Open it in your letters."))
                    sealTapeLayer(note.key)
                case .sent(let note):
                    pageLayer(sentContent(note), seed: note.key, sent: note)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(Text(spokenSent(note)))
                    pageTapeLayer(note.key)
                case .empty:
                    pageLayer(emptyContent, seed: "empty", sent: nil)
                    pageTapeLayer("empty")
                case .notSetUp:
                    pageLayer(NotesWidgetPageContent(title: "open kiriya.love ♡", body: "just once, and your notes find their way here.", sticker: true),
                              seed: "setup", sent: nil)
                    pageTapeLayer("setup")
                case .sealed, .open:
                    EmptyView()
                }
            }
        }
        .frame(width: canvas.width, height: canvas.height, alignment: .topLeading)
    }

    // MARK: placing a piece on the desk

    private func unit(_ point: CGPoint) -> UnitPoint {
        UnitPoint(x: point.x / max(1, canvas.width), y: point.y / max(1, canvas.height))
    }

    /// A piece drawn in `rect`, turned about the centre of `pivot`, in a layer the size of the widget.
    private func place<V: View>(_ view: V, in rect: CGRect, tilt: Double, pivot: CGRect) -> some View {
        ZStack(alignment: .topLeading) {
            view
                .frame(width: rect.width, height: rect.height, alignment: .topLeading)
                .offset(x: rect.minX, y: rect.minY)
        }
        .frame(width: canvas.width, height: canvas.height, alignment: .topLeading)
        .rotationEffect(.degrees(tilt), anchor: unit(pivot.center))
    }

    // MARK: the open page

    private func pageLayer(_ content: NotesWidgetPageContent, seed: String, sent: NotesWidgetNote?) -> some View {
        let rect = geometry.page
        let layout = NotesWidgetPageLayout.make(content, page: rect.size, size: look.size)
        return place(ZStack(alignment: .topLeading) {
            NotesWidgetPage(size: rect.size, palette: palette, seed: seed, rules: layout.rules, marginX: layout.marginX,
                            curl: look.size == .large ? 16 : 13)
            NotesWidgetPageWords(layout: layout, palette: palette)
                .privacySensitive()
            if let sent { stamp(for: sent, page: rect.size) }
            if look.size == .large && (content.sticker || (layout.roomy && sent == nil)) {
                // An empty page gets a heart sticker and a doodle, so it never looks forgotten.
                NotesWidgetHeartMark(size: 40, palette: palette)
                    .rotationEffect(.degrees(12))
                    .offset(x: rect.width - 92, y: rect.height - 96)
                NotesWidgetHeart.path(in: CGRect(x: 0, y: 0, width: 18, height: 16.5))
                    .stroke(palette.wave, style: StrokeStyle(lineWidth: 1.4, lineCap: .round, lineJoin: .round))
                    .frame(width: 18, height: 16.5)
                    .rotationEffect(.degrees(-16))
                    .offset(x: rect.width - 120, y: rect.height - 62)
                    .widgetAccentable()
            }
        }, in: rect, tilt: geometry.pageTilt, pivot: rect)
    }

    private func pageTapeLayer(_ seed: String) -> some View {
        let rect = geometry.page
        let tape = geometry.pageTape
        let spot = CGRect(x: rect.midX - tape.width / 2, y: rect.minY - tape.height * 0.55, width: tape.width, height: tape.height)
        return place(NotesWidgetTape(width: tape.width, height: tape.height, pattern: NotesWidgetTape.pattern(for: seed),
                                     tinted: palette.tinted, dark: look.dark)
                        .widgetAccentable()
                        .rotationEffect(.degrees(-4)),
                     in: spot, tilt: geometry.pageTilt, pivot: rect)
    }

    private func openContent(_ note: NotesWidgetNote) -> NotesWidgetPageContent {
        let when = NotesWidgetDates.phrase(note.at, now: entry.date)
        return NotesWidgetPageContent(
            title: note.title, scriptHeading: note.title == nil && look.size == .large ? "for \(entry.me)" : nil,
            body: note.text, signature: "— \(note.from)", when: when, continues: note.truncated)
    }

    private var isAdmin: Bool { entry.other == "Kiriya" && entry.me != "Kiriya" }

    private var emptyContent: NotesWidgetPageContent {
        if isAdmin {
            return NotesWidgetPageContent(title: "no notes sent yet", body: look.size == .small
                ? "the next one you send her lands here ♡"
                : "the next note you send her shows up here, with a little stamp once she's opened it ♡", sticker: true)
        }
        return NotesWidgetPageContent(title: "no notes yet ♡", body: look.size == .small
            ? "the first one will land right here."
            : "the first little note from \(entry.other) will land right here, taped down just for you.", sticker: true)
    }

    private func sentContent(_ note: NotesWidgetNote) -> NotesWidgetPageContent {
        let when = NotesWidgetDates.phrase(note.at, now: entry.date)
        let to = "to \(entry.other)" + (look.size == .small ? "" : (when.map { " · \($0)" } ?? ""))
        return NotesWidgetPageContent(title: note.title, body: note.text, signature: nil, when: to, continues: note.truncated,
                                      stampRoom: stampSize(note).width * 0.85)
    }

    // MARK: Josh's stamp

    private func stampLines(_ note: NotesWidgetNote) -> [String] {
        guard note.opened else { return ["not opened yet"] }
        let time = NotesWidgetDates.clock(note.openedAt) ?? NotesWidgetDates.phrase(note.openedAt, now: entry.date)
        let first = note.reaction == "heart" ? "she loved it ♡" : "she opened it ♡"
        return [first] + (look.size == .small ? [] : time.map { [$0] } ?? [])
    }

    private var stampFont: CGFloat {
        switch look.size {
        case .small: return 13
        case .medium: return 15
        case .large, .rectangular: return 17
        }
    }

    private func stampSize(_ note: NotesWidgetNote) -> CGSize {
        let size = stampFont
        let lines = stampLines(note)
        let widths = lines.enumerated().map { NotesWidgetWrap.width($1, $0 == 0 ? .handBold : .hand, $0 == 0 ? size : size * 0.8) }
        return CGSize(width: (widths.max() ?? 40) + size * 1.1, height: CGFloat(lines.count) * size * 1.15 + size * 0.5)
    }

    private func stamp(for note: NotesWidgetNote, page: CGSize) -> some View {
        let size = stampSize(note)
        let emoji = note.reaction.flatMap { $0 == "heart" ? nil : $0 }
        return ZStack(alignment: .topLeading) {
            if let emoji {
                Text(emoji)
                    .font(.system(size: stampFont * 1.45))
                    .rotationEffect(.degrees(10))
                    .offset(x: page.width - size.width - stampFont * 2.3, y: page.height - size.height - stampFont * 1.2)
            }
            NotesWidgetStamp(lines: stampLines(note), palette: palette, size: stampFont, faded: !note.opened)
                .rotationEffect(.degrees(-7))
                .offset(x: page.width - size.width - 12, y: page.height - size.height - 9)
        }
    }

    // MARK: folded shut

    private var sealTapeEnd: CGPoint {
        let rect = geometry.folded
        return CGPoint(x: rect.midX, y: rect.minY + rect.height * geometry.flapDepth - geometry.sealTape.width / 2)
    }

    private func foldedLayer(_ note: NotesWidgetNote, letter: Bool) -> some View {
        let rect = geometry.folded
        let flapY = rect.height * geometry.flapDepth
        return place(ZStack(alignment: .topLeading) {
            NotesWidgetFolded(size: rect.size, palette: palette, flapDepth: geometry.flapDepth)
            foldedWriting(note, letter: letter, size: rect.size, flapY: flapY)
            // A little doodled heart on the flap.
            NotesWidgetHeart.path(in: CGRect(x: 0, y: 0, width: doodle, height: doodle * 0.92))
                .stroke(palette.wave, style: StrokeStyle(lineWidth: 1.3, lineCap: .round, lineJoin: .round))
                .frame(width: doodle, height: doodle * 0.92)
                .rotationEffect(.degrees(-12))
                .offset(x: rect.width * 0.76, y: flapY * 0.34)
                .widgetAccentable()
            if look.size != .small {
                // Taped to her Home Screen at one corner, scrapbook style.
                let corner = CGSize(width: look.size == .large ? 54 : 40, height: look.size == .large ? 17 : 14)
                NotesWidgetTape(width: corner.width, height: corner.height, pattern: .stripes, tinted: palette.tinted, dark: look.dark)
                    .widgetAccentable()
                    .rotationEffect(.degrees(-38))
                    .offset(x: -corner.width * 0.36, y: -corner.height * 0.1)
            }
        }, in: rect, tilt: geometry.foldedTilt, pivot: rect)
    }

    private func sealTapeLayer(_ seed: String) -> some View {
        let rect = geometry.folded
        let tape = geometry.sealTape
        let flapY = rect.minY + rect.height * geometry.flapDepth
        let spot = CGRect(x: rect.midX - tape.width / 2, y: flapY - tape.height / 2, width: tape.width, height: tape.height)
        return place(NotesWidgetTape(width: tape.width, height: tape.height, pattern: NotesWidgetTape.pattern(for: seed),
                                     tinted: palette.tinted, dark: look.dark)
                        .widgetAccentable()
                        .rotationEffect(.degrees(72)),
                     in: spot, tilt: geometry.foldedTilt, pivot: rect)
    }

    private var doodle: CGFloat { look.size == .large ? 20 : 14 }

    private func foldedWriting(_ note: NotesWidgetNote, letter: Bool, size: CGSize, flapY: CGFloat) -> some View {
        let big: CGFloat
        let small: CGFloat
        switch look.size {
        case .small: big = 23; small = 14
        case .medium: big = 26; small = 15
        case .large, .rectangular: big = 38; small = 19
        }
        let top = flapY + geometry.sealTape.width * 0.42 + (look.size == .large ? 8 : 2)
        return VStack(spacing: look.size == .large ? 4 : 1) {
            if letter {
                Text("a letter for you").font(NotesWidgetFonts.font(.script, size: big * 0.9)).foregroundStyle(palette.title)
                if let title = note.letterTitle {
                    Text("\u{201C}\(title)\u{201D}").font(NotesWidgetFonts.font(.handBold, size: small)).foregroundStyle(palette.ink)
                }
            } else {
                Text("for \(entry.me)").font(NotesWidgetFonts.font(.script, size: big)).foregroundStyle(palette.title)
                if look.size != .medium {
                    Text("open me ♡").font(NotesWidgetFonts.font(.hand, size: small)).foregroundStyle(palette.soft)
                }
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .frame(width: size.width - 16, height: max(10, size.height - top - 4), alignment: .center)
        .offset(x: 8, y: top)
    }

    // MARK: the lab's peel frames (the same four layers, each at its transition's point)

    @ViewBuilder
    private func peeling(_ note: NotesWidgetNote, progress t: Double) -> some View {
        let opened = NotesWidgetNote.opened(note)
        let top = unit(CGPoint(x: geometry.page.midX, y: geometry.page.minY))
        let p = NotesWidgetMotion.progress(t)
        let q = NotesWidgetMotion.progress(t, delay: NotesWidgetMotion.unfoldDelay)
        foldedLayer(note, letter: false).modifier(NotesWidgetLetGo(progress: min(1, p), anchor: unit(geometry.folded.center)))
        if q > 0 {
            pageLayer(openContent(opened), seed: note.key, sent: nil).modifier(NotesWidgetUnfold(progress: q, anchor: top))
        }
        sealTapeLayer(note.key).modifier(NotesWidgetPeel(progress: min(1, p), anchor: unit(sealTapeEnd)))
        if q > 0 {
            pageTapeLayer(note.key).modifier(NotesWidgetPress(progress: q, anchor: top))
        }
    }

    // MARK: VoiceOver

    private func spoken(_ note: NotesWidgetNote) -> String {
        let when = NotesWidgetDates.phrase(note.at, now: entry.date).map { ", \($0)" } ?? ""
        return "A little note from \(note.from)\(when). \(note.title.map { "\($0). " } ?? "")\(note.text)"
    }

    private func spokenSent(_ note: NotesWidgetNote) -> String {
        let state = note.opened ? (note.reaction == "heart" ? "She loved it." : "She opened it.") : "Not opened yet."
        return "Your note to \(entry.other). \(note.title.map { "\($0). " } ?? "")\(note.text). \(state)"
    }
}

private extension CGRect {
    var center: CGPoint { CGPoint(x: midX, y: midY) }
}

// MARK: - Lock Screen (accessoryRectangular): the system's own lettering, tinted by the system

struct NotesWidgetLockScreen: View {
    var entry: NotesWidgetEntry

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            NotesWidgetGlyph(sealed: entry.scene.isSealed)
                .frame(width: 15, height: 17)
                .padding(.top, 2)
                .widgetAccentable()
            VStack(alignment: .leading, spacing: 0) {
                Text(headline)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .widgetAccentable()
                    .lineLimit(1)
                lines
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var when: String? { entry.scene.note.flatMap { NotesWidgetDates.phrase($0.at, now: entry.date) } }

    private var headline: String {
        switch entry.scene {
        case .sealed(let note): return "a note from \(note.from)"
        case .letter: return "a letter for you"
        case .open(let note): return note.title ?? "from \(note.from)"
        case .sent(let note): return note.opened ? (note.reaction == "heart" ? "she loved it ♡" : "she opened it ♡") : "sent to \(entry.other)"
        case .empty: return entry.other == "Kiriya" ? "no notes sent yet" : "no notes yet ♡"
        case .notSetUp: return "open kiriya.love ♡"
        }
    }

    @ViewBuilder
    private var lines: some View {
        let small = Font.system(size: 13, weight: .regular, design: .rounded)
        switch entry.scene {
        case .sealed:
            if let when { Text(when).font(small).foregroundStyle(.secondary).lineLimit(1) }
            Text("tap to open ♡").font(small).foregroundStyle(.secondary).lineLimit(1)
        case .letter(let note):
            Text(note.letterTitle.map { "\u{201C}\($0)\u{201D}" } ?? "from \(note.from)")
                .font(small).lineLimit(1).privacySensitive()
            if let when { Text(when).font(small).foregroundStyle(.secondary).lineLimit(1) }
        case .open(let note), .sent(let note):
            Text(note.text.replacingOccurrences(of: "\n", with: " "))
                .font(small).lineLimit(2).privacySensitive()
        case .empty, .notSetUp:
            Text(entry.other == "Kiriya" ? "they show up here" : "they'll show up here")
                .font(small).foregroundStyle(.secondary).lineLimit(1)
        }
    }
}

/// A tiny note with tape (folded with a heart when it's new), for the Lock Screen.
struct NotesWidgetGlyph: View {
    var sealed: Bool

    var body: some View {
        Canvas { ctx, size in
            let paper = CGRect(x: 1, y: 3, width: size.width - 2, height: size.height - 4)
            ctx.stroke(Path(roundedRect: paper, cornerRadius: 1.8), with: .foreground, lineWidth: 1.4)
            if sealed {
                var flap = Path()
                flap.move(to: CGPoint(x: paper.minX + 1, y: paper.minY + paper.height * 0.42))
                flap.addLine(to: CGPoint(x: paper.maxX - 1, y: paper.minY + paper.height * 0.42))
                ctx.stroke(flap, with: .foreground, lineWidth: 1.1)
                let heart = CGRect(x: paper.midX - 3.2, y: paper.minY + paper.height * 0.55, width: 6.4, height: 5.8)
                ctx.fill(NotesWidgetHeart.path(in: heart), with: .foreground)
            } else {
                for k in 0..<3 {
                    let y = paper.minY + 5 + CGFloat(k) * 3.4
                    ctx.fill(Path(CGRect(x: paper.minX + 2.5, y: y, width: paper.width - (k == 2 ? 7 : 5), height: 1.1)), with: .foreground)
                }
            }
            var tape = Path(CGRect(x: size.width / 2 - 4.5, y: 0.5, width: 9, height: 4.5))
            tape = tape.applying(CGAffineTransform(translationX: -size.width / 2, y: -2.75)
                .concatenating(CGAffineTransform(rotationAngle: -0.2))
                .concatenating(CGAffineTransform(translationX: size.width / 2, y: 2.75)))
            ctx.fill(tape, with: .foreground)
        }
    }
}
