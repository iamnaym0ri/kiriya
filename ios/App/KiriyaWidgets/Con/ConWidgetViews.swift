import SwiftUI
import WidgetKit

// The "Next con" widget's faces. Every family is a con ticket: cream paper with a plum outline, a
// dotted tear line between the ticket and its stub, a barcode, and a red heart seal on her picks.
// The countdown changes with the distance (see ConWidgetCountdown) and the parts that move on
// their own (the hours clock, a doors-open clock, a long exhibition's progress) are system timers,
// so they stay live between timeline entries.

// MARK: - Entry point

struct ConWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    @Environment(\.widgetRenderingMode) private var rendering
    @Environment(\.showsWidgetContainerBackground) private var showsBackground
    let entry: ConWidgetEntry

    var body: some View {
        let look = ConWidgetLook.resolve(scheme: scheme, rendering: rendering)
        let moment = ConWidgetMoment(events: entry.feed.events, at: entry.date)
        ConWidgetFace(family: family, entry: entry, moment: moment, look: look, framed: showsBackground)
            .widgetURL(entry.feed.link(for: moment.event))
            .containerBackground(for: .widget) { ConWidgetBackdrop(family: family, look: look) }
    }
}

/// The widget's background: the lilac sky on the Home Screen, nothing on the Lock Screen.
struct ConWidgetBackdrop: View {
    let family: WidgetFamily
    let look: ConWidgetLook

    var body: some View {
        switch family {
        case .systemSmall: ConWidgetSky(look: look, confetti: ConWidgetConfetto.small)
        case .systemMedium: ConWidgetSky(look: look, confetti: ConWidgetConfetto.medium)
        case .systemLarge, .systemExtraLarge: ConWidgetSky(look: look, confetti: ConWidgetConfetto.large)
        default: Color.clear
        }
    }
}

/// One face for a family, with everything passed in (the render lab draws these directly).
struct ConWidgetFace: View {
    let family: WidgetFamily
    let entry: ConWidgetEntry
    let moment: ConWidgetMoment
    let look: ConWidgetLook
    /// False in StandBy and wherever the system hides the background: the ticket then fills the space.
    var framed: Bool = true

    var body: some View {
        switch family {
        case .accessoryCircular: ConWidgetCircular(entry: entry, moment: moment)
        case .accessoryRectangular: ConWidgetRectangular(entry: entry, moment: moment)
        case .accessoryInline: ConWidgetInline(entry: entry, moment: moment)
        case .systemMedium: ConWidgetMedium(entry: entry, moment: moment, look: look, framed: framed)
        case .systemLarge, .systemExtraLarge: ConWidgetLarge(entry: entry, moment: moment, look: look, framed: framed)
        default: ConWidgetSmall(entry: entry, moment: moment, look: look, framed: framed)
        }
    }
}

// MARK: - Pieces

/// "NEXT CON · SINGAPORE": small, heavy, tracked out.
struct ConWidgetMicro: View {
    let text: String
    let look: ConWidgetLook
    var size: CGFloat = 8.5
    var color: Color?

    var body: some View {
        Text(text.uppercased())
            .font(ConWidgetFonts.micro(size))
            .tracking(size * 0.16)
            .foregroundStyle(color ?? look.faint)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }
}

/// The header: a sparkle and "next con · singapore", or the day after a con, "AFA was lovely ♡".
struct ConWidgetHeader: View {
    let moment: ConWidgetMoment
    let look: ConWidgetLook
    var place: String?
    var compact = false
    /// The small widget says "happening now" / "last day" up here (no room below).
    var stateLabel = false

    var body: some View {
        HStack(spacing: 4) {
            ConWidgetSparkle()
                .fill(look.heart)
                .frame(width: 8, height: 8)
                .widgetAccentable()
            if let ended = moment.justEnded {
                let name = ConWidgetWords.shortTitle(ended, max: compact ? 12 : 22)
                let lovely = name.map { "\($0) was lovely ♡" } ?? "that was lovely ♡"
                if compact || moment.event == nil {
                    ConWidgetMicro(text: lovely, look: look, color: look.heart)
                } else {
                    ViewThatFits(in: .horizontal) {
                        ConWidgetMicro(text: lovely + " · next up", look: look, color: look.heart).fixedSize()
                        ConWidgetMicro(text: lovely, look: look, color: look.heart)
                    }
                }
            } else if stateLabel, case .on = moment.countdown {
                ConWidgetMicro(text: moment.isLastDay ? "last day!" : "happening now", look: look, color: look.heart)
            } else {
                ConWidgetMicro(text: ["next con", place].compactMap { $0 }.joined(separator: " · "), look: look)
            }
        }
    }
}

/// The big day count, printed in plum over a pink offset (a two-colour poster print).
struct ConWidgetBigNumber: View {
    let value: Int
    let size: CGFloat
    let look: ConWidgetLook

    var body: some View {
        let text = Text(verbatim: "\(value)")
            .font(.system(size: size, weight: .black, design: .rounded))
        ZStack {
            if !look.isMono {
                text.foregroundStyle(look.print).offset(x: size * 0.045, y: size * 0.045)
            }
            text.foregroundStyle(look.ink)
        }
        .lineLimit(1)
        .fixedSize()
        .contentTransition(.numericText(value: Double(value)))
        .widgetAccentable()
    }
}

/// A live clock counting down to `until` ("37:41:12"), drawn by the system every second.
struct ConWidgetClock: View {
    @Environment(\.conWidgetFrozenClock) private var frozen
    let from: Date
    let until: Date
    let size: CGFloat
    let look: ConWidgetLook
    var alignment: TextAlignment = .leading

    var body: some View {
        conWidgetTimerText(from: from, until: until, frozen: frozen)
            .font(.system(size: size, weight: .heavy, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(look.ink)
            .multilineTextAlignment(alignment)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .widgetAccentable()
    }
}

/// One dot per day of a con on now: days gone, today (red), days to come.
struct ConWidgetDayDots: View {
    let day: Int
    let total: Int
    let look: ConWidgetLook
    var dot: CGFloat = 7

    var body: some View {
        HStack(spacing: dot * 0.5) {
            ForEach(1...max(1, total), id: \.self) { index in
                Circle()
                    .fill(index < day ? look.dotDone : index == day ? look.dotToday : look.dotAhead)
                    .frame(width: index == day ? dot * 1.25 : dot, height: index == day ? dot * 1.25 : dot)
                    .widgetAccentable(index == day)
            }
        }
    }
}

/// A long exhibition's run, filling live from its first day to its last.
struct ConWidgetRunBar: View {
    @Environment(\.conWidgetFrozenClock) private var frozen
    let event: ConWidgetEvent
    let at: Date
    let look: ConWidgetLook

    @ViewBuilder
    var body: some View {
        if frozen {
            // The lab's still pictures (ImageRenderer runs this on the real clock).
            let done = min(1, max(0, at.timeIntervalSince(event.start) / event.end.timeIntervalSince(event.start)))
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(look.dotAhead)
                    Capsule().fill(look.heart).frame(width: max(4, geo.size.width * done))
                }
            }
            .frame(height: 4)
        } else {
            ProgressView(timerInterval: event.start...event.end, countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .progressViewStyle(.linear)
            .tint(look.heart)
            .labelsHidden()
            .widgetAccentable()
        }
    }
}

/// "happening now!" over a big "day 2 of 3": a festival wristband's DAY 2. Sized to fit `width`.
struct ConWidgetDayOf: View {
    let day: Int
    let total: Int
    let lastDay: Bool
    let look: ConWidgetLook
    let width: CGFloat
    var number: CGFloat = 50
    var label: CGFloat = 19
    var centered = false
    /// False where the header already says it ("HAPPENING NOW").
    var showsTitle = true

    var body: some View {
        let title = lastDay ? "last day!" : "happening now!"
        let need = ConWidgetFonts.handWidth("day", size: label * 0.95) + ConWidgetFonts.handWidth("of \(total)", size: label * 0.95)
            + ConWidgetFonts.roundedWidth("\(day)", size: number, weight: .black) + 12
        let k = min(1, width / need)
        VStack(alignment: centered ? .center : .leading, spacing: -2) {
            if showsTitle {
                Text(title)
                    .hand(ConWidgetFonts.handFit(title, size: label, width: width))
                    .foregroundStyle(look.heart)
                    .lineLimit(1)
                    .widgetAccentable()
            }
            HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text("day").hand(label * 0.95 * k).foregroundStyle(look.ink)
                ConWidgetBigNumber(value: day, size: number * k, look: look)
                Text("of \(total)").hand(label * 0.95 * k).foregroundStyle(look.soft)
            }
            .lineLimit(1)
        }
    }
}

struct ConWidgetChip: View {
    let text: String
    let look: ConWidgetLook
    var size: CGFloat = 9

    var body: some View {
        Text(text)
            .font(ConWidgetFonts.rounded(size, .bold))
            .foregroundStyle(look.chipInk)
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, size * 0.62)
            .padding(.vertical, size * 0.22)
            .background(Capsule().fill(look.chipFill))
    }
}

/// "anime" "cosplay" "music": as many as fit on one line.
struct ConWidgetTags: View {
    let event: ConWidgetEvent
    let look: ConWidgetLook
    var size: CGFloat = 9

    var body: some View {
        let tags = ConWidgetWords.tags(event, limit: 4)
        ViewThatFits(in: .horizontal) {
            ForEach((1...max(1, tags.count)).reversed(), id: \.self) { count in
                HStack(spacing: 4) {
                    ForEach(Array(tags.prefix(count).enumerated()), id: \.offset) { _, tag in
                        ConWidgetChip(text: tag, look: look, size: size)
                    }
                }
            }
        }
    }
}

/// A fact line: a small symbol and a line of text.
struct ConWidgetFact: View {
    let symbol: String
    let text: String
    let look: ConWidgetLook
    var size: CGFloat = 12
    var strong = false

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: symbol)
                .font(.system(size: size * 0.82, weight: .bold))
                .foregroundStyle(look.faint)
                .frame(width: size * 1.05)
            Text(text)
                .font(ConWidgetFonts.rounded(size, strong ? .bold : .semibold))
                .foregroundStyle(strong ? look.ink : look.soft)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}

/// The barcode and the ticket number ("N° 271126": the con's first day).
struct ConWidgetBarcodeBlock: View {
    let event: ConWidgetEvent?
    let look: ConWidgetLook
    var width: CGFloat = 70
    var height: CGFloat = 13

    var body: some View {
        VStack(spacing: 2) {
            ConWidgetBarcode(seed: event?.id ?? "kiriya")
                .fill(look.barcode)
                .frame(width: width, height: height)
            Text(verbatim: serial)
                .font(.system(size: 6.5, weight: .semibold, design: .monospaced))
                .tracking(0.8)
                .foregroundStyle(look.faint)
        }
    }

    private var serial: String {
        guard let event else { return "N° TBA" }
        let c = event.first.civil
        return String(format: "N° %02d%02d%02d", c.day, c.month, c.year % 100)
    }
}

/// The words under a con's name: dates and the venue ("27–29 Nov · Suntec"), or while it's on,
/// when it ends ("till Sun 29 · Suntec").
func conWidgetWhenWhere(_ moment: ConWidgetMoment, _ event: ConWidgetEvent, hall: Bool = true) -> String {
    var when = ConWidgetWords.shortRange(event)
    if moment.today >= event.first && event.dayCount > 1 {
        let c = event.last.civil
        when = moment.today == event.last ? "ends today" : "till \(ConWidgetWords.weekday(event.last)) \(c.day)"
    }
    return [when, ConWidgetWords.shortVenue(event.venue, hall: hall)].compactMap { $0 }.joined(separator: " · ")
}

/// "in 11 days" with the number in SF Rounded (Gaegu's 1 reads as an I), else the site's words.
func conWidgetPhrase(_ event: ConWidgetEvent, today: ConWidgetDay, size: CGFloat) -> Text {
    let away = today.days(to: event.first)
    if away > 1 {
        return Text("in ").hand(size) + Text(verbatim: "\(away)").font(ConWidgetFonts.rounded(size * 0.82, .heavy)) + Text(" days").hand(size)
    }
    return Text(ConWidgetWords.phrase(event, today: today)).hand(size)
}

// MARK: - Small

struct ConWidgetSmall: View {
    let entry: ConWidgetEntry
    let moment: ConWidgetMoment
    let look: ConWidgetLook
    var framed = true

    var body: some View {
        GeometryReader { geo in
            let inset: CGFloat = framed ? 8 : 5
            let size = CGSize(width: geo.size.width - inset * 2, height: geo.size.height - inset * 2)
            let inner = size.width - 24
            let twoLines = moment.event.map { ConWidgetFonts.roundedWidth($0.title, size: 15, weight: .bold) > inner } ?? false
            let cut: CGFloat = twoLines ? 0.6 : 0.655
            ZStack(alignment: .topLeading) {
                ConWidgetTicket(look: look, tear: .across, cut: cut, corner: 15, notch: 6.5)
                VStack(spacing: 0) {
                    top(width: inner, height: size.height * cut)
                        .frame(height: size.height * cut)
                    stub(twoLines: twoLines)
                        .frame(height: size.height * (1 - cut))
                }
            }
            .frame(width: size.width, height: size.height)
            .overlay(alignment: .topTrailing) {
                if moment.event?.hers == true {
                    ConWidgetHeartSeal(look: look, size: 23).offset(x: 6, y: -6)
                }
            }
            .position(x: geo.size.width / 2, y: geo.size.height / 2)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(entry.state == .ready ? ConWidgetWords.spoken(moment) : ConWidgetBlank.spoken(entry.state)))
    }

    @ViewBuilder
    private func top(width: CGFloat, height: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ConWidgetHeader(moment: moment, look: look, compact: true, stateLabel: true)
                .padding(.trailing, moment.event?.hers == true ? 12 : 0)
            Spacer(minLength: 0)
            countdown(roomy: height > 92, width: width)
            Spacer(minLength: 0)
        }
        .padding(.leading, 12)
        .padding(.trailing, 10)
        .padding(.top, 11)
        .padding(.bottom, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func countdown(roomy: Bool, width: CGFloat) -> some View {
        if entry.state != .ready || moment.event == nil {
            ConWidgetBlank.smallTop(state: entry.state, look: look)
        } else if let countdown = moment.countdown, let event = moment.event {
            switch countdown {
            case .days(let days):
                HStack(alignment: .lastTextBaseline, spacing: 5) {
                    ConWidgetBigNumber(value: days, size: (roomy ? 54 : 46) * (days >= 100 ? 0.78 : 1), look: look)
                    VStack(alignment: .leading, spacing: -5) {
                        Text("days").hand(roomy ? 21 : 19).foregroundStyle(look.ink)
                        Text("to go!").hand(roomy ? 17 : 15.5).foregroundStyle(look.soft)
                    }
                    .padding(.bottom, 1)
                }
            case .hours(let days, let until):
                VStack(alignment: .leading, spacing: 0) {
                    Text(days == 1 ? "tomorrow!" : "in 2 days!")
                        .hand(roomy ? 20 : 18)
                        .foregroundStyle(look.heart)
                        .widgetAccentable()
                    ConWidgetClock(from: moment.date, until: until, size: roomy ? 26 : 24, look: look)
                    ConWidgetMicro(text: "hrs · min · sec", look: look, size: 6.5)
                        .padding(.top, 1)
                }
            case .today(let doors):
                VStack(alignment: .leading, spacing: 0) {
                    Text("today!!")
                        .hand(ConWidgetFonts.handFit("today!!", size: roomy ? 46 : 40, width: width))
                        .foregroundStyle(look.heart)
                        .lineLimit(1)
                        .widgetAccentable()
                        .padding(.bottom, -3)
                    if let doors {
                        HStack(spacing: 3) {
                            Text("doors in").font(ConWidgetFonts.rounded(11, .bold)).foregroundStyle(look.soft)
                            ConWidgetClock(from: moment.date, until: doors, size: 12, look: look)
                        }
                    } else if event.dayCount > 1 {
                        HStack(spacing: 6) {
                            if event.dayCount <= 7 { ConWidgetDayDots(day: 1, total: event.dayCount, look: look, dot: 6) }
                            Text("day 1 of \(event.dayCount)").font(ConWidgetFonts.rounded(11, .bold)).foregroundStyle(look.soft)
                        }
                    } else {
                        Text("all day, have fun ♡").font(ConWidgetFonts.rounded(11, .bold)).foregroundStyle(look.soft)
                    }
                }
            case .on(let day, let total):
                VStack(alignment: .leading, spacing: 3) {
                    ConWidgetDayOf(day: day, total: total, lastDay: moment.isLastDay, look: look, width: width,
                                   number: roomy ? 54 : 46, label: roomy ? 21 : 19, showsTitle: false)
                    if total <= 7 {
                        ConWidgetDayDots(day: day, total: total, look: look, dot: 6)
                    } else {
                        ConWidgetRunBar(event: event, at: moment.date, look: look).frame(width: width * 0.8)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func stub(twoLines: Bool) -> some View {
        if entry.state == .ready, let event = moment.event {
            VStack(alignment: .leading, spacing: 1.5) {
                Text(event.title)
                    .font(ConWidgetFonts.rounded(twoLines ? 13.5 : 15, .bold))
                    .foregroundStyle(look.ink)
                    .lineLimit(twoLines ? 2 : 1)
                    .minimumScaleFactor(0.8)
                    .fixedSize(horizontal: false, vertical: true)
                Text(conWidgetWhenWhere(moment, event))
                    .font(ConWidgetFonts.rounded(10.5, .semibold))
                    .foregroundStyle(look.soft)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.top, 2)
            .id(event.id)
            .transition(.push(from: .bottom))
        } else {
            ConWidgetBlank.smallStub(state: entry.state, after: moment.justEnded, look: look)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
        }
    }
}

// MARK: - Medium

struct ConWidgetMedium: View {
    let entry: ConWidgetEntry
    let moment: ConWidgetMoment
    let look: ConWidgetLook
    var framed = true

    var body: some View {
        GeometryReader { geo in
            let inset: CGFloat = framed ? 8 : 5
            let size = CGSize(width: geo.size.width - inset * 2, height: geo.size.height - inset * 2)
            ConWidgetHeroTicket(entry: entry, moment: moment, look: look, size: size, scale: .medium)
                .position(x: geo.size.width / 2, y: geo.size.height / 2)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(entry.state == .ready ? ConWidgetWords.spoken(moment) : ConWidgetBlank.spoken(entry.state)))
    }
}

/// The wide ticket (medium, and the top of large): the con on the left, the countdown on the stub.
struct ConWidgetHeroTicket: View {
    enum Scale { case medium, large }
    let entry: ConWidgetEntry
    let moment: ConWidgetMoment
    let look: ConWidgetLook
    let size: CGSize
    let scale: Scale

    private var stubWidth: CGFloat { scale == .large ? 126 : 122 }

    var body: some View {
        let cut = (size.width - stubWidth) / size.width
        ZStack(alignment: .topLeading) {
            ConWidgetTicket(look: look, tear: .down, cut: cut, corner: 16, notch: 7)
            HStack(spacing: 0) {
                main(width: size.width * cut)
                    .frame(width: size.width * cut, height: size.height)
                stub
                    .frame(width: stubWidth, height: size.height)
            }
        }
        .frame(width: size.width, height: size.height)
        .overlay(alignment: .topTrailing) {
            if moment.event?.hers == true {
                ConWidgetHeartSeal(look: look, size: 25).offset(x: 7, y: -7)
            }
        }
    }

    // The con itself.
    @ViewBuilder
    private func main(width: CGFloat) -> some View {
        let inner = width - 28
        if entry.state == .ready, let event = moment.event {
            let big: CGFloat = scale == .large ? 25 : 23
            let oneLine = ConWidgetFonts.roundedWidth(event.title, size: big, weight: .heavy) <= inner
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    ConWidgetHeader(moment: moment, look: look, place: moment.justEnded == nil ? ConWidgetWords.city(event) : nil)
                    Spacer(minLength: 0)
                    if event.hers && moment.justEnded == nil {
                        Text("ur pick!")
                            .hand(15)
                            .foregroundStyle(look.heart)
                            .padding(.top, -4)
                            .widgetAccentable()
                    }
                }
                Spacer(minLength: 3)
                Text(event.title)
                    .font(ConWidgetFonts.rounded(oneLine ? big : big - 4, .heavy))
                    .foregroundStyle(look.ink)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: scale == .large ? 8 : 5)
                VStack(alignment: .leading, spacing: scale == .large ? 4 : 3) {
                    ConWidgetFact(symbol: "calendar", text: ConWidgetWords.longRange(event), look: look,
                                  size: scale == .large ? 12.5 : 12, strong: true)
                    if let venue = ConWidgetWords.shortVenue(event.venue) {
                        ConWidgetFact(symbol: "mappin", text: venue, look: look, size: scale == .large ? 12.5 : 12)
                    }
                    if !event.tags.isEmpty && (oneLine || scale == .large) {
                        ConWidgetTags(event: event, look: look, size: scale == .large ? 9.5 : 9)
                            .padding(.top, 2)
                    }
                }
            }
            .padding(.leading, 14)
            .padding(.trailing, 12)
            .padding(.top, 12)
            .padding(.bottom, scale == .large ? 14 : 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .id(event.id)
            .transition(.push(from: .bottom))
        } else {
            ConWidgetBlank.wideMain(state: entry.state, after: moment.justEnded, look: look)
                .padding(.leading, 14)
                .padding(.trailing, 12)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    // The stub: ADMIT ONE, the countdown, the barcode.
    private var stub: some View {
        VStack(spacing: 0) {
            ConWidgetMicro(text: "admit one ♡", look: look, size: 7)
                .padding(.top, moment.event?.hers == true ? 13 : 0)
            Spacer(minLength: 2)
            countdown
            Spacer(minLength: 2)
            ConWidgetBarcodeBlock(event: moment.event, look: look, width: stubWidth - 40, height: scale == .large ? 15 : 13)
        }
        .padding(.top, 12)
        .padding(.bottom, 11)
        .padding(.horizontal, 6)
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var countdown: some View {
        if entry.state != .ready || moment.event == nil {
            ConWidgetBlank.stubCountdown(state: entry.state, look: look)
        } else if let countdown = moment.countdown, let event = moment.event {
            switch countdown {
            case .days(let days):
                VStack(spacing: -4) {
                    ConWidgetBigNumber(value: days, size: (scale == .large ? 52 : 48) * (days >= 100 ? 0.75 : 1), look: look)
                    Text("days to go!")
                        .hand(15.5)
                        .foregroundStyle(look.soft)
                }
            case .hours(let days, let until):
                VStack(spacing: 1) {
                    Text(days == 1 ? "tomorrow!" : "in 2 days!")
                        .hand(17)
                        .foregroundStyle(look.heart)
                        .widgetAccentable()
                    ConWidgetClock(from: moment.date, until: until, size: scale == .large ? 21 : 20, look: look, alignment: .center)
                        .frame(maxWidth: .infinity)
                    ConWidgetMicro(text: "hrs · min · sec", look: look, size: 6)
                }
            case .today(let doors):
                VStack(spacing: 1) {
                    Text("today!!")
                        .hand(ConWidgetFonts.handFit("today!!", size: scale == .large ? 36 : 33, width: stubWidth - 14))
                        .foregroundStyle(look.heart)
                        .lineLimit(1)
                        .widgetAccentable()
                    if let doors {
                        Text("doors in").font(ConWidgetFonts.rounded(9.5, .bold)).foregroundStyle(look.soft)
                        ConWidgetClock(from: moment.date, until: doors, size: 13, look: look, alignment: .center)
                            .frame(maxWidth: .infinity)
                    } else if event.dayCount > 1 {
                        if event.dayCount <= 7 { ConWidgetDayDots(day: 1, total: event.dayCount, look: look, dot: 6).padding(.vertical, 1) }
                        Text("day 1 of \(event.dayCount)").font(ConWidgetFonts.rounded(10, .bold)).foregroundStyle(look.soft)
                    } else {
                        Text("have fun ♡").font(ConWidgetFonts.rounded(10, .bold)).foregroundStyle(look.soft)
                    }
                }
            case .on(let day, let total):
                VStack(spacing: 3) {
                    ConWidgetDayOf(day: day, total: total, lastDay: moment.isLastDay, look: look, width: stubWidth - 12,
                                   number: scale == .large ? 44 : 40, label: 15.5, centered: true)
                    if total <= 7 {
                        ConWidgetDayDots(day: day, total: total, look: look, dot: 5.5)
                    } else {
                        ConWidgetRunBar(event: event, at: moment.date, look: look).frame(width: stubWidth - 34)
                    }
                }
            }
        }
    }
}

// MARK: - Large

struct ConWidgetLarge: View {
    let entry: ConWidgetEntry
    let moment: ConWidgetMoment
    let look: ConWidgetLook
    var framed = true

    var body: some View {
        GeometryReader { geo in
            let inset: CGFloat = framed ? 8 : 5
            let width = geo.size.width - inset * 2
            let height = geo.size.height - inset * 2
            let heroHeight = (height - 8) * 0.5
            VStack(spacing: 8) {
                ConWidgetHeroTicket(entry: entry, moment: moment, look: look, size: CGSize(width: width, height: heroHeight), scale: .large)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(Text(entry.state == .ready ? ConWidgetWords.spoken(moment) : ConWidgetBlank.spoken(entry.state)))
                ConWidgetProgram(entry: entry, moment: moment, look: look)
                    .frame(width: width, height: height - heroHeight - 8)
            }
            .position(x: geo.size.width / 2, y: geo.size.height / 2)
        }
    }
}

/// "coming up": the cons after the next one, each a row you can tap.
struct ConWidgetProgram: View {
    let entry: ConWidgetEntry
    let moment: ConWidgetMoment
    let look: ConWidgetLook

    var body: some View {
        let rows = entry.state == .ready ? Array(moment.later.prefix(3)) : []
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(LinearGradient(colors: [look.paperTop, look.paperBottom], startPoint: .top, endPoint: .bottom))
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .strokeBorder(look.perforation.opacity(0.7), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                .padding(5)
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(look.outline, lineWidth: look.outlineWidth)
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text("coming up")
                        .hand(19)
                        .foregroundStyle(look.ink)
                    ConWidgetSparkle().fill(look.heart).frame(width: 8, height: 8).widgetAccentable()
                    Spacer(minLength: 0)
                    ConWidgetMicro(text: "after this one", look: look, size: 7.5)
                }
                .padding(.bottom, 4)
                if rows.isEmpty {
                    Spacer(minLength: 0)
                    ConWidgetBlank.programEmpty(state: entry.state, look: look)
                        .frame(maxWidth: .infinity)
                    Spacer(minLength: 0)
                } else {
                    // Three slots: the cons, then "TBA" stubs for the rest, so the card keeps its rhythm.
                    ForEach(0..<3, id: \.self) { index in
                        if index > 0 {
                            ConWidgetTearLine(tear: .across, cut: 0.5, inset: 0)
                                .stroke(look.perforation.opacity(0.6), style: StrokeStyle(lineWidth: 1, lineCap: .round, dash: [0.1, 3.5]))
                                .frame(height: 1)
                        }
                        if index < rows.count {
                            Link(destination: entry.feed.link(for: rows[index])) {
                                ConWidgetProgramRow(event: rows[index], today: moment.today, look: look)
                            }
                            .frame(maxHeight: .infinity)
                        } else {
                            ConWidgetProgramPlaceholder(look: look, first: index == rows.count)
                                .frame(maxHeight: .infinity)
                        }
                    }
                }
            }
            .padding(.horizontal, 15)
            .padding(.top, 11)
            .padding(.bottom, 9)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .compositingGroup()
        .shadow(color: look.shadow, radius: look.isMono ? 0 : 5, x: 0, y: look.isMono ? 0 : 2.5)
    }
}

/// An empty slot in the programme: a dashed date block and, on the first, a quiet "TBA".
struct ConWidgetProgramPlaceholder: View {
    let look: ConWidgetLook
    let first: Bool

    var body: some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 7, style: .continuous)
                .strokeBorder(look.perforation.opacity(0.8), style: StrokeStyle(lineWidth: 1, dash: [3, 2.5]))
                .frame(width: 34, height: 36)
                .overlay(ConWidgetSparkle().fill(look.sparkle).frame(width: 10, height: 10))
            if first {
                VStack(alignment: .leading, spacing: 1) {
                    Text("TBA")
                        .font(ConWidgetFonts.rounded(13.5, .bold))
                        .foregroundStyle(look.faint)
                    Text("more cons land here once they're confirmed")
                        .font(ConWidgetFonts.rounded(10.5, .medium))
                        .foregroundStyle(look.faint)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
            }
            Spacer(minLength: 0)
        }
        .opacity(first ? 1 : 0.6)
        .accessibilityHidden(true)
    }
}

struct ConWidgetProgramRow: View {
    let event: ConWidgetEvent
    let today: ConWidgetDay
    let look: ConWidgetLook

    var body: some View {
        HStack(spacing: 10) {
            ConWidgetDateBlock(day: event.first, look: look)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    if event.hers {
                        ConWidgetHeartShape().fill(look.heart).frame(width: 9, height: 8.5).widgetAccentable()
                    }
                    Text(event.title)
                        .font(ConWidgetFonts.rounded(13.5, .bold))
                        .foregroundStyle(look.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                Text([ConWidgetWords.longRange(event), ConWidgetWords.shortVenue(event.venue, hall: false)].compactMap { $0 }.joined(separator: " · "))
                    .font(ConWidgetFonts.rounded(10.5, .medium))
                    .foregroundStyle(look.soft)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            Spacer(minLength: 4)
            conWidgetPhrase(event, today: today, size: 16)
                .foregroundStyle(today.days(to: event.first) <= 2 ? look.heart : look.soft)
                .lineLimit(1)
                .fixedSize()
        }
        .frame(maxHeight: .infinity)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("\(event.title)\(event.hers ? ", your pick" : ""), \(ConWidgetWords.phrase(event, today: today).replacingOccurrences(of: "!!", with: "")), \(ConWidgetWords.spokenRange(event))\(event.venue.map { ", at \($0)" } ?? "")"))
    }
}

/// A little tear-off calendar page: the month on a red band, the day under it.
struct ConWidgetDateBlock: View {
    let day: ConWidgetDay
    let look: ConWidgetLook

    var body: some View {
        VStack(spacing: 0) {
            Text(ConWidgetWords.month(day).uppercased())
                .font(.system(size: 7.5, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundStyle(look.isMono ? Color.white : look.waxHeart)
                .frame(maxWidth: .infinity)
                .frame(height: 12)
                .background(look.isMono ? Color.white.opacity(0.25) : look.heart)
                .widgetAccentable()
            Text(verbatim: "\(day.civil.day)")
                .font(.system(size: 16, weight: .heavy, design: .rounded))
                .foregroundStyle(look.ink)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(width: 34, height: 36)
        .background(look.isMono ? Color.white.opacity(0.1) : (look.mode == .dark ? Color.white.opacity(0.08) : Color.white))
        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).stroke(look.outline.opacity(look.mode == .light ? 0.55 : 0.8), lineWidth: 1))
    }
}

// MARK: - Empty, waiting and not-set-up states

enum ConWidgetBlank {
    static func spoken(_ state: ConWidgetEntry.State) -> String {
        switch state {
        case .notSetUp: return "Next con. Open kiriya.love once, then your next con shows up here."
        case .waiting: return "Next con. Checking the calendar."
        case .ready: return "Next con: nothing on the calendar yet."
        }
    }

    private static func title(_ state: ConWidgetEntry.State) -> String {
        switch state {
        case .notSetUp: return "open kiriya.love once"
        case .waiting: return "checking the calendar…"
        case .ready: return "nothing booked yet"
        }
    }

    private static func line(_ state: ConWidgetEntry.State) -> String {
        switch state {
        case .notSetUp: return "then it fills in"
        case .waiting: return "one sec"
        case .ready: return "I'll keep watch"
        }
    }

    /// Small, upper part: a big sparkle and "TBA".
    @ViewBuilder
    static func smallTop(state: ConWidgetEntry.State, look: ConWidgetLook) -> some View {
        HStack(alignment: .center, spacing: 7) {
            ZStack {
                ConWidgetSparkle().fill(look.isMono ? Color.white.opacity(0.35) : look.sparkle).frame(width: 34, height: 34)
                ConWidgetSparkle().fill(look.heart).frame(width: 11, height: 11).offset(x: 14, y: -12)
            }
            .widgetAccentable()
            Text(state == .notSetUp ? "hi!" : "TBA")
                .font(.system(size: 36, weight: .black, design: .rounded))
                .foregroundStyle(look.ink)
        }
    }

    @ViewBuilder
    static func smallStub(state: ConWidgetEntry.State, after ended: ConWidgetEvent?, look: ConWidgetLook) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title(state))
                .font(ConWidgetFonts.rounded(13.5, .bold))
                .foregroundStyle(look.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            (Text(line(state)) + Text(state == .ready ? " " : "") + (state == .ready ? Text(Image(systemName: "sparkle")) : Text("")))
                .hand(15)
                .foregroundStyle(look.soft)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }

    @ViewBuilder
    static func wideMain(state: ConWidgetEntry.State, after ended: ConWidgetEvent?, look: ConWidgetLook) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let ended, state == .ready {
                HStack(spacing: 4) {
                    ConWidgetSparkle().fill(look.heart).frame(width: 8, height: 8).widgetAccentable()
                    ConWidgetMicro(text: "\(ended.title) was lovely ♡", look: look, color: look.heart)
                }
            } else {
                HStack(spacing: 4) {
                    ConWidgetSparkle().fill(look.heart).frame(width: 8, height: 8).widgetAccentable()
                    ConWidgetMicro(text: "next con · singapore", look: look)
                }
            }
            Spacer(minLength: 4)
            Text(state == .ready ? "nothing on the calendar yet" : title(state))
                .font(ConWidgetFonts.rounded(20, .heavy))
                .foregroundStyle(look.ink)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 6)
            Text(state == .ready ? "new cons land here as soon as they're confirmed." : state == .notSetUp ? "then ur next con shows up right here, counting down." : "the next con will be here in a moment.")
                .font(ConWidgetFonts.rounded(11.5, .semibold))
                .foregroundStyle(look.soft)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    static func stubCountdown(state: ConWidgetEntry.State, look: ConWidgetLook) -> some View {
        VStack(spacing: 0) {
            ZStack {
                ConWidgetSparkle().fill(look.isMono ? Color.white.opacity(0.35) : look.sparkle).frame(width: 30, height: 30)
                ConWidgetSparkle().fill(look.heart).frame(width: 10, height: 10).offset(x: 13, y: -11)
            }
            .widgetAccentable()
            Text(state == .notSetUp ? "soon!" : "TBA")
                .font(.system(size: 24, weight: .black, design: .rounded))
                .foregroundStyle(look.ink)
            if state == .ready {
                Text("I'll keep watch")
                    .hand(14)
                    .foregroundStyle(look.soft)
            }
        }
    }

    @ViewBuilder
    static func programEmpty(state: ConWidgetEntry.State, look: ConWidgetLook) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 6) {
                ConWidgetSparkle().fill(look.sparkle).frame(width: 12, height: 12)
                ConWidgetSparkle().fill(look.sparkleWarm).frame(width: 8, height: 8)
                ConWidgetSparkle().fill(look.sparkle).frame(width: 12, height: 12)
            }
            Text(state == .ready ? "nothing else on the calendar yet" : "the schedule shows up here")
                .font(ConWidgetFonts.rounded(12.5, .bold))
                .foregroundStyle(look.soft)
            Text(state == .ready ? "I'll keep watch for the next one" : "after the app's first open")
                .hand(15)
                .foregroundStyle(look.faint)
        }
    }
}

// MARK: - Lock Screen

struct ConWidgetRectangular: View {
    @Environment(\.conWidgetFrozenClock) private var frozen
    let entry: ConWidgetEntry
    let moment: ConWidgetMoment

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if entry.state == .ready, let event = moment.event, let countdown = moment.countdown {
                HStack(spacing: 4) {
                    Image(systemName: "ticket.fill").font(.system(size: 12, weight: .bold))
                    Text(event.title).font(.system(size: 15, weight: .bold, design: .rounded)).lineLimit(1)
                }
                .widgetAccentable()
                line(for: countdown, event: event)
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .lineLimit(1)
                Text(conWidgetWhenWhere(moment, event, hall: false))
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            } else {
                HStack(spacing: 4) {
                    Image(systemName: "ticket").font(.system(size: 12, weight: .bold))
                    Text("next con").font(.system(size: 15, weight: .bold, design: .rounded))
                }
                .widgetAccentable()
                Text(entry.state == .notSetUp ? "open kiriya.love once" : moment.justEnded.map { "\($0.title) was lovely ♡" } ?? "nothing booked yet")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .lineLimit(1)
                Text(entry.state == .notSetUp ? "then it counts down here" : "I'll keep watch")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(entry.state == .ready ? ConWidgetWords.spoken(moment) : ConWidgetBlank.spoken(entry.state)))
    }

    private func line(for countdown: ConWidgetCountdown, event: ConWidgetEvent) -> Text {
        switch countdown {
        case .days(let days):
            return Text("in \(days) days")
        case .hours(_, let until):
            return Text("starts in ") + conWidgetTimerText(from: moment.date, until: until, frozen: frozen)
        case .today(let doors):
            if let doors { return Text("today!! doors in ") + conWidgetTimerText(from: moment.date, until: doors, frozen: frozen) }
            return Text(event.dayCount > 1 ? "today!! · day 1 of \(event.dayCount)" : "today!! · have fun ♡")
        case .on(let day, let total):
            return Text("\(moment.isLastDay ? "last day!" : "on now") · day \(day) of \(total)")
        }
    }
}

struct ConWidgetCircular: View {
    @Environment(\.conWidgetFrozenClock) private var frozen
    let entry: ConWidgetEntry
    let moment: ConWidgetMoment

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            ring.padding(3.5)
            center
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(entry.state == .ready ? ConWidgetWords.spoken(moment) : ConWidgetBlank.spoken(entry.state)))
    }

    /// How full the ring is: the last 30 days fill it, the last two days fill it hour by hour.
    private var progress: Double {
        guard entry.state == .ready, let countdown = moment.countdown else { return 0 }
        switch countdown {
        case .days(let days): return max(0.05, min(1, 1 - Double(days) / 30))
        case .hours(_, let until): return max(0.05, min(1, 1 - until.timeIntervalSince(moment.date) / (48 * 3600)))
        case .today, .on: return 1
        }
    }

    @ViewBuilder
    private var ring: some View {
        if case .on(let day, let total) = moment.countdown, entry.state == .ready, total <= 7 {
            // One arc per day: days gone, today (accent), days to come.
            ZStack {
                ForEach(1...total, id: \.self) { index in
                    let gap = total > 1 ? 0.035 : 0
                    let from = Double(index - 1) / Double(total) + gap / 2
                    let to = Double(index) / Double(total) - gap / 2
                    Circle()
                        .trim(from: from, to: to)
                        .stroke(style: StrokeStyle(lineWidth: 4.5, lineCap: .butt))
                        .opacity(index < day ? 0.55 : index == day ? 1 : 0.22)
                        .widgetAccentable(index == day)
                }
            }
            .rotationEffect(.degrees(-90))
        } else {
            ZStack {
                Circle().stroke(lineWidth: 4.5).opacity(0.22)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(style: StrokeStyle(lineWidth: 4.5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .widgetAccentable()
            }
        }
    }

    @ViewBuilder
    private var center: some View {
        if entry.state == .ready, let countdown = moment.countdown {
            switch countdown {
            case .days(let days):
                VStack(spacing: -3) {
                    Text(verbatim: "\(days)").font(.system(size: days >= 100 ? 18 : 22, weight: .heavy, design: .rounded))
                    Text("days").font(.system(size: 9, weight: .bold, design: .rounded))
                }
            case .hours(let days, let until):
                VStack(spacing: -1) {
                    Text(days == 1 ? "tmrw" : "in 2d").font(.system(size: 9, weight: .bold, design: .rounded))
                    conWidgetTimerText(from: moment.date, until: until, frozen: frozen)
                        .font(.system(size: until.timeIntervalSince(moment.date) >= 36_000 ? 11.5 : 13, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .multilineTextAlignment(.center)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(width: 52)
                }
            case .today:
                VStack(spacing: -1) {
                    Image(systemName: "sparkles").font(.system(size: 13, weight: .bold))
                    Text("today").font(.system(size: 12, weight: .heavy, design: .rounded))
                }
            case .on(let day, let total):
                VStack(spacing: -3) {
                    Text("day").font(.system(size: 8.5, weight: .bold, design: .rounded))
                    Text(verbatim: "\(day)").font(.system(size: 21, weight: .heavy, design: .rounded))
                    Text("of \(total)").font(.system(size: 8.5, weight: .bold, design: .rounded))
                }
            }
        } else {
            VStack(spacing: -1) {
                Image(systemName: "sparkles").font(.system(size: 13, weight: .bold))
                Text(entry.state == .notSetUp ? "open" : "soon").font(.system(size: 11, weight: .heavy, design: .rounded))
            }
        }
    }
}

struct ConWidgetInline: View {
    let entry: ConWidgetEntry
    let moment: ConWidgetMoment

    var body: some View {
        if entry.state == .ready, let event = moment.event {
            let phrase = ConWidgetWords.phrase(event, today: moment.today)
            let short = ConWidgetWords.shortTitle(event, max: 14)
            ViewThatFits {
                Label("\(event.title) · \(phrase)", systemImage: "ticket.fill")
                if let short { Label("\(short) · \(phrase)", systemImage: "ticket.fill") }
                Label("\(phrase) · \(event.title)", systemImage: "ticket.fill")
            }
        } else {
            Label("next con · soon", systemImage: "ticket")
        }
    }
}
