import SwiftUI
import WidgetKit

// The "Thinking of you" widget, laid out per size:
//   small   four little buttons (or two, or one big one: Edit Widget)
//   medium  a header and four tall buttons
//   large   all seven: the ♡ across the top, then hug & kiss, morning & night, miss & water
//   Lock Screen: one round button, or two side by side.
// After a send, the tapped button says "sent ♡", the header says "sent to Josh ♡", and three little
// hearts pop out of the button's picture and float up into its corner (WidgetKit animates the change
// between timeline entries, max 2 s; they rest inside the button, since a view resting off the widget
// is dropped).

enum SignalsWidgetFamily: Hashable {
    case small, medium, large, circular, rectangular
}

// MARK: - The widget's view (reads the environment, then draws the face)

struct SignalsWidgetView: View {
    @Environment(\.widgetFamily) private var widgetFamily
    @Environment(\.widgetRenderingMode) private var renderingMode
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.showsWidgetContainerBackground) private var showsBackground
    #if os(iOS)
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced
    #endif

    let entry: SignalsWidgetEntry

    private var family: SignalsWidgetFamily {
        switch widgetFamily {
        case .systemMedium: return .medium
        case .systemLarge, .systemExtraLarge: return .large
        #if os(iOS)
        case .accessoryCircular: return .circular
        case .accessoryRectangular, .accessoryInline: return .rectangular
        #endif
        default: return .small
        }
    }

    private var look: SignalsWidgetLook {
        var look = SignalsWidgetLook()
        if renderingMode == .accented {
            look.ink = .accented
        } else if renderingMode == .fullColor {
            look.ink = .color
        } else {
            look.ink = .vibrant
        }
        if family == .circular || family == .rectangular { look.ink = .vibrant }
        look.dark = colorScheme == .dark
        look.showsBackground = showsBackground
        #if os(iOS)
        look.dimmed = isLuminanceReduced
        #endif
        return look
    }

    var body: some View {
        let look = self.look
        SignalsWidgetFace(entry: entry, family: family, look: look)
            .containerBackground(for: .widget) {
                if look.ink == .color { look.background } else { Color.clear }
            }
            .widgetURL(KiriyaLink.url(nil, fallback: "/world/chat"))
    }
}

// MARK: - The face (pure: entry + family + look → view), also what the render lab draws

struct SignalsWidgetFace: View {
    let entry: SignalsWidgetEntry
    let family: SignalsWidgetFamily
    let look: SignalsWidgetLook
    /// Lab only: show this signal's tile in the "sending…" state the system flips to on a tap.
    var labSending: SignalsWidgetSignal? = nil

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let tiles = SignalsWidgetLayout.tiles(family: family, entry: entry, size: size)
            ZStack(alignment: .topLeading) {
                if family == .medium || family == .large {
                    SignalsWidgetHeader(entry: entry, family: family, look: look,
                                        rect: SignalsWidgetLayout.header(family: family, size: size))
                }
                if family == .rectangular {
                    SignalsWidgetLockHeader(entry: entry, rect: SignalsWidgetLayout.header(family: family, size: size))
                }
                ForEach(tiles, id: \.signal) { tile in
                    SignalsWidgetTileButton(spec: spec(tile, among: tiles), isSetUp: entry.isSetUp, forceSending: labSending == tile.signal)
                        .position(x: tile.rect.midX, y: tile.rect.midY)
                }
                if !entry.isSetUp && family != .medium && family != .large && family != .circular && family != .rectangular {
                    SignalsWidgetSetUpNote(look: look, otherName: entry.otherName)
                        .frame(width: size.width, height: size.height)
                        .allowsHitTesting(false)
                }
            }
            .frame(width: size.width, height: size.height, alignment: .topLeading)
        }
    }

    private func spec(_ tile: SignalsWidgetLayout.Tile, among tiles: [SignalsWidgetLayout.Tile]) -> SignalsWidgetTileSpec {
        var state = SignalsWidgetTileState.idle
        if let moment = entry.moment, moment.signal == tile.signal {
            state = moment.isSent ? .sent(test: moment.outcome == .test) : .failed(moment.problem ?? .server)
        }
        return SignalsWidgetTileSpec(signal: tile.signal, variant: tile.variant, size: tile.rect.size,
                                     look: look, state: state, otherName: entry.otherName,
                                     labelSize: SignalsWidgetLayout.sharedLabelSize(for: tile, among: tiles))
    }
}

// MARK: - Layout (fixed geometry per size, so the hearts know where they leave from)

enum SignalsWidgetLayout {
    struct Tile: Hashable {
        var signal: SignalsWidgetSignal
        var variant: SignalsWidgetTileVariant
        var rect: CGRect
    }

    /// One label size for every tile of the same kind (the size the longest of their idle labels fits),
    /// so a row of buttons reads as a set. Sent / try-again words only ever get smaller than this.
    static func sharedLabelSize(for tile: Tile, among tiles: [Tile]) -> CGFloat {
        let group = tiles.filter { $0.variant == tile.variant && $0.rect.size == tile.rect.size }
        return group.map { member in
            SignalsWidgetTileMetrics(variant: member.variant, size: member.rect.size)
                .fit(SignalsWidgetTile.idleWords(member.signal, variant: member.variant, size: member.rect.size))
        }.min() ?? 17
    }

    static func header(family: SignalsWidgetFamily, size: CGSize) -> CGRect {
        switch family {
        case .medium: return CGRect(x: 14, y: 8, width: size.width - 28, height: 24)
        case .large: return CGRect(x: 16, y: 9, width: size.width - 32, height: 38)
        case .rectangular: return CGRect(x: 0, y: 0, width: size.width, height: size.height * 0.3)
        default: return .zero
        }
    }

    static func tiles(family: SignalsWidgetFamily, entry: SignalsWidgetEntry, size: CGSize) -> [Tile] {
        let W = size.width, H = size.height
        switch family {
        case .small:
            let pad: CGFloat = 10, gap: CGFloat = 7
            let signals = Array(entry.signals.prefix(entry.smallStyle.count))
            switch entry.smallStyle {
            case .one:
                return [Tile(signal: signals[0], variant: .hero, rect: CGRect(x: pad, y: pad, width: W - pad * 2, height: H - pad * 2))]
            case .two:
                let h = (H - pad * 2 - gap) / 2
                return signals.enumerated().map { index, signal in
                    Tile(signal: signal, variant: .row, rect: CGRect(x: pad, y: pad + CGFloat(index) * (h + gap), width: W - pad * 2, height: h))
                }
            case .four:
                let side = (W - pad * 2 - gap) / 2
                let sideY = (H - pad * 2 - gap) / 2
                return signals.enumerated().map { index, signal in
                    Tile(signal: signal, variant: .stack,
                         rect: CGRect(x: pad + CGFloat(index % 2) * (side + gap), y: pad + CGFloat(index / 2) * (sideY + gap),
                                      width: side, height: sideY))
                }
            }

        case .medium:
            let padX: CGFloat = 12, gap: CGFloat = 8
            let top = header(family: .medium, size: size).maxY + 5
            let w = (W - padX * 2 - gap * 3) / 4
            let h = H - top - 12
            return entry.signals.prefix(4).enumerated().map { index, signal in
                Tile(signal: signal, variant: .stack, rect: CGRect(x: padX + CGFloat(index) * (w + gap), y: top, width: w, height: h))
            }

        case .large:
            let pad: CGFloat = 14, gap: CGFloat = 8
            let top = header(family: .large, size: size).maxY + 4
            let bannerH: CGFloat = min(80, (H - top - pad) * 0.25)
            var tiles = [Tile(signal: .thinking, variant: .banner, rect: CGRect(x: pad, y: top, width: W - pad * 2, height: bannerH))]
            let rowTop = top + bannerH + gap
            let rowH = (H - rowTop - pad - gap * 2) / 3
            let w = (W - pad * 2 - gap) / 2
            for (index, signal) in SignalsWidgetSignal.largeOrder.dropFirst().enumerated() {
                tiles.append(Tile(signal: signal, variant: .row,
                                  rect: CGRect(x: pad + CGFloat(index % 2) * (w + gap), y: rowTop + CGFloat(index / 2) * (rowH + gap), width: w, height: rowH)))
            }
            return tiles

        case .circular:
            return [Tile(signal: entry.signals[0], variant: .circle, rect: CGRect(x: 0, y: 0, width: W, height: H))]

        case .rectangular:
            let top = header(family: .rectangular, size: size).maxY + 2
            let gap: CGFloat = 6
            let w = (W - gap) / 2
            return entry.signals.prefix(2).enumerated().map { index, signal in
                Tile(signal: signal, variant: .capsule, rect: CGRect(x: CGFloat(index) * (w + gap), y: top, width: w, height: H - top))
            }
        }
    }
}

// MARK: - Header (medium and large)

struct SignalsWidgetHeader: View {
    let entry: SignalsWidgetEntry
    let family: SignalsWidgetFamily
    let look: SignalsWidgetLook
    let rect: CGRect

    /// News for the header: the outcome of the last tap, or the set-up hint. Nil when there's none.
    private var message: String? {
        if !entry.isSetUp { return "open kiriya.love once ♡" }
        guard let moment = entry.moment else { return nil }
        switch moment.outcome {
        case .sent: return "sent to \(entry.otherName) ♡"
        case .test: return "test mode ✓ \(entry.otherName) didn’t get it"
        case .failed:
            switch moment.problem ?? .server {
            case .offline: return "no connection · tap to try again"
            case .notSetUp: return "open kiriya.love once ♡"
            case .locked: return "open kiriya.love to reconnect ♡"
            case .slowDown: return moment.message.map(Self.soften) ?? "that’s a lot of love for one hour ♡"
            case .server: return "didn’t send · tap to try again"
            }
        }
    }

    /// "That's a lot of love for one hour ♡ try again in a bit." → lower case, no full stop, one line.
    static func soften(_ text: String) -> String {
        var out = text.trimmingCharacters(in: .whitespaces)
        if let first = out.first { out = first.lowercased() + out.dropFirst() }
        if out.hasSuffix(".") { out.removeLast() }
        return out
    }

    private var newsColor: Color {
        entry.moment?.isSent == true || !entry.isSetUp || entry.moment?.outcome == .failed ? look.heartText : look.label
    }

    var body: some View {
        Group {
            if family == .large { large } else { medium }
        }
        .frame(width: rect.width, height: rect.height, alignment: family == .large ? .bottomLeading : .leading)
        .position(x: rect.midX, y: rect.midY)
        .invalidatableContent()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text((message ?? "Little signals to \(entry.otherName)").replacingOccurrences(of: " ♡", with: "")))
        .accessibilityAddTraits(.isHeader)
    }

    /// Medium: "to Josh ♡ … kiriya ✦", the left side swapping for news.
    private var medium: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Group {
                if let message {
                    SignalsWidgetFonts.hand(message, size: 17).foregroundStyle(newsColor)
                } else {
                    SignalsWidgetFonts.hand("to \(entry.otherName) ", size: 18).foregroundStyle(look.label)
                        + Text("♡").font(SignalsWidgetFonts.kaomoji(size: 15)).foregroundStyle(look.heartText)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .id(message ?? "idle")
            .transition(.push(from: .bottom).combined(with: .opacity))
            Spacer(minLength: 0)
            if message == nil {
                (Text("kiriya ").font(SignalsWidgetFonts.font(.script, size: 16)) + Text("✦").font(.system(size: 10)))
                    .foregroundStyle(look.quiet)
                    .lineLimit(1)
                    .transition(.opacity)
            }
        }
    }

    /// Large: "to Josh ♡" in script stays put; the hint on the right swaps for news.
    private var large: some View {
        HStack(alignment: .lastTextBaseline, spacing: 8) {
            (Text("to \(entry.otherName) ").font(SignalsWidgetFonts.font(.script, size: 30)).foregroundStyle(look.label)
                + Text("♡").font(SignalsWidgetFonts.kaomoji(size: 20)).foregroundStyle(look.heartText))
                .lineLimit(1)
                .layoutPriority(1)
            Spacer(minLength: 6)
            Group {
                if let message {
                    SignalsWidgetFonts.hand(message, size: 16).foregroundStyle(newsColor)
                } else {
                    SignalsWidgetFonts.hand("tap one to send ♡", size: 15).foregroundStyle(look.quiet)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .padding(.bottom, 3)
            .id(message ?? "hint")
            .transition(.push(from: .bottom).combined(with: .opacity))
        }
    }
}

struct SignalsWidgetLockHeader: View {
    let entry: SignalsWidgetEntry
    let rect: CGRect

    private var text: String {
        if !entry.isSetUp { return "open kiriya.love once" }
        guard let moment = entry.moment else { return "to \(entry.otherName) ♡" }
        switch moment.outcome {
        case .sent: return "sent to \(entry.otherName) ♡"
        case .test: return "test mode ✓"
        case .failed: return moment.problem == .slowDown ? "in a little bit ♡" : "didn’t send · try again"
        }
    }

    var body: some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundStyle(Color.white)
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .frame(width: rect.width, height: rect.height, alignment: .leading)
            .position(x: rect.midX, y: rect.midY)
            .widgetAccentable()
    }
}

// MARK: - The sent hearts (see SignalsWidgetTile.sentHearts)

struct SignalsWidgetFlyingHeart: View {
    var look: SignalsWidgetLook

    var body: some View {
        if look.isMono {
            SignalsWidgetHeart().fill(Color.white)
        } else {
            SignalsWidgetGlossyHeart(look: look)
                .shadow(color: SignalsWidgetPalette.heart.opacity(0.35), radius: 3, y: 1)
        }
    }
}

// MARK: - Before the app has handed over its key (small widget)

struct SignalsWidgetSetUpNote: View {
    var look: SignalsWidgetLook
    var otherName: String

    var body: some View {
        VStack(spacing: 2) {
            SignalsWidgetFonts.hand("open kiriya.love ♡", size: 16)
                .foregroundStyle(look.isMono ? Color.white : SignalsWidgetPalette.plum)
            SignalsWidgetFonts.hand("just once, then these go straight to \(otherName)", size: 13)
                .foregroundStyle(look.isMono ? Color.white.opacity(0.8) : SignalsWidgetPalette.softInk)
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(look.isMono ? Color.white.opacity(0.2) : SignalsWidgetPalette.cream)
                .shadow(color: look.isMono ? .clear : SignalsWidgetPalette.rgb(0x632bb5, 0.25), radius: 5, y: 2)
        )
        .overlay(alignment: .top) {
            // A strip of lilac washi tape holding the note on.
            Rectangle()
                .fill(look.isMono ? Color.white.opacity(0.35) : SignalsWidgetPalette.rgb(0xd9c6ec, 0.85))
                .frame(width: 44, height: 12)
                .rotationEffect(.degrees(-4))
                .offset(y: -6)
        }
        .rotationEffect(.degrees(-2))
        .padding(.horizontal, 8)
    }
}

// MARK: - The widget

struct SignalsWidget: Widget {
    /// The same kind as the old "Thinking of you" widget, so one already on a Home Screen becomes this one.
    static let kind = "ThinkingOfYouWidget"

    init() {
        SignalsWidgetFonts.loadIfNeeded()
    }

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: Self.kind, intent: SignalsWidgetConfigurationIntent.self, provider: SignalsWidgetProvider()) { entry in
            SignalsWidgetView(entry: entry)
        }
        .configurationDisplayName("Thinking of you")
        .description("One tap sends a ♡, a hug or a kiss, straight to their phone.")
        .contentMarginsDisabled()
        #if os(iOS)
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular])
        #else
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        #endif
    }
}
