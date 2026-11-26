import AppIntents
import SwiftUI
import WidgetKit

// One signal's button: a pastel tile with a stitched edge (the site's dashed tap card), the signal's
// emoji, its kaomoji and its words, and a couple of tiny doodles in the corner. It is a Toggle so the
// system can show "sending…" the instant she taps (a widget toggle flips before its intent runs; a
// button would sit still until the request is done), and the timeline that follows shows the result.

/// What a tile is showing.
enum SignalsWidgetTileState: Hashable {
    case idle
    case sent(test: Bool)
    case failed(SignalsWidgetMoment.Problem)
}

/// How a tile arranges itself.
enum SignalsWidgetTileVariant: Hashable {
    /// Picture over kaomoji over words (the small widget's four, the medium's row).
    case stack
    /// Picture beside words and kaomoji (the small widget's two, the large widget's pairs).
    case row
    /// One big signal filling the small widget.
    case hero
    /// The large widget's wide ♡ across the top.
    case banner
    /// Lock Screen: round.
    case circle
    /// Lock Screen: a half of the rectangular widget.
    case capsule
}

struct SignalsWidgetTileSpec: Hashable {
    var signal: SignalsWidgetSignal
    var variant: SignalsWidgetTileVariant
    var size: CGSize
    var look: SignalsWidgetLook
    var state: SignalsWidgetTileState = .idle
    var otherName: String = "Josh"
    /// The size every label in this tile's group shares (the layout fits the longest one); nil = fit alone.
    var labelSize: CGFloat? = nil

    var metrics: SignalsWidgetTileMetrics { SignalsWidgetTileMetrics(variant: variant, size: size) }
}

/// Every size inside a tile, from its variant and box. The tile draws with these, and the layout uses
/// them to fit a whole group's labels to one size.
struct SignalsWidgetTileMetrics {
    var picture: CGFloat
    var kaomoji: CGFloat
    var label: ClosedRange<CGFloat>
    var labelWidth: CGFloat
    var lines: Int
    var tracking: CGFloat
    // Row and banner spacing
    var leading: CGFloat = 0
    var gap: CGFloat = 0
    var trailing: CGFloat = 0

    init(variant: SignalsWidgetTileVariant, size: CGSize) {
        let w = size.width, h = size.height
        switch variant {
        case .stack where h > 100:
            picture = min(w * 0.5, h * 0.34)
            kaomoji = min(12, max(9, w * 0.128))
            label = 14...min(17.5, max(14.5, w * 0.205))
            labelWidth = w - 8
            lines = 2
            tracking = 0
        case .stack:
            picture = min(w * 0.46, h * 0.4)
            kaomoji = min(12, max(9, w * 0.128))
            // Gaegu sets loosely: the little buttons close it up a touch.
            label = 12.5...min(15, max(13.5, w * 0.2))
            labelWidth = w - 5
            lines = 1
            tracking = -0.45
        case .row:
            picture = min(h * 0.6, w * 0.28)
            kaomoji = min(13, max(10, h * 0.18))
            label = 14...min(20, max(15, h * 0.28))
            leading = h * 0.2
            gap = w * 0.045
            trailing = h * 0.16
            labelWidth = w - leading - picture - gap - trailing
            lines = 1
            tracking = 0
        case .hero:
            picture = min(h * 0.4, 66)
            kaomoji = 14
            label = 16...23
            labelWidth = w - 26
            lines = 1
            tracking = 0
        case .banner:
            picture = h * 0.62
            kaomoji = min(14, h * 0.19)
            label = 18...min(24, h * 0.31)
            leading = h * 0.24
            gap = 14
            trailing = h * 0.22 + picture * 1.1 + 8
            labelWidth = w - leading - picture - gap - trailing
            lines = 1
            tracking = 0
        case .circle:
            picture = w * 0.44
            kaomoji = 0
            label = 8...w * 0.15
            labelWidth = w * 0.8
            lines = 1
            tracking = 0
        case .capsule:
            // Icon over word, so even "thinking" gets the button's whole width.
            picture = h * 0.44
            kaomoji = 0
            label = 9...min(12, h * 0.24)
            labelWidth = w - 8
            lines = 1
            tracking = 0
        }
    }

    /// The size `text` gets on its own.
    func fit(_ text: String) -> CGFloat {
        SignalsWidgetFonts.handFit(text, width: labelWidth, lines: lines, range: label, tracking: tracking)
    }
}

// MARK: - The interactive wrapper

struct SignalsWidgetTileButton: View {
    /// True: a Toggle, so "sending…" shows the instant she taps. False: a plain Button (the fallback if a
    /// device ever shows a toggle quirk; everything else is the same).
    static let showsSendingAtOnce = true

    let spec: SignalsWidgetTileSpec
    var isSetUp: Bool
    /// Lab only: draw the "sending…" look the system shows between the tap and the reload.
    var forceSending = false

    var body: some View {
        Group {
            if !isSetUp {
                // Before the app has handed over its key, a press anywhere opens the app (the widget's
                // URL), which sets it up. (Small widgets can't hold links, so no Link here.)
                SignalsWidgetTile(spec: spec, sending: false)
            } else if forceSending {
                SignalsWidgetTile(spec: spec, sending: true)
            } else if Self.showsSendingAtOnce {
                Toggle(isOn: false, intent: SignalsWidgetSendIntent(signal: spec.signal)) {
                    Text(spec.signal.label)
                }
                .toggleStyle(SignalsWidgetTileToggleStyle(spec: spec))
            } else {
                // A plain button: nothing changes until the reload ("sent ♡" / "try again"); the system
                // dims the header (invalidatableContent) while the request runs.
                Button(intent: SignalsWidgetSendIntent(signal: spec.signal)) {
                    SignalsWidgetTile(spec: spec, sending: false)
                }
                .buttonStyle(.plain)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(spec.signal.spoken(to: spec.otherName)))
        .accessibilityAddTraits(.isButton)
        .accessibilityRemoveTraits(.isToggle)
    }
}

struct SignalsWidgetTileToggleStyle: ToggleStyle {
    let spec: SignalsWidgetTileSpec

    func makeBody(configuration: Configuration) -> some View {
        SignalsWidgetTile(spec: spec, sending: configuration.isOn)
    }
}

// MARK: - The tile itself

struct SignalsWidgetTile: View {
    let spec: SignalsWidgetTileSpec
    var sending: Bool

    private var signal: SignalsWidgetSignal { spec.signal }
    private var look: SignalsWidgetLook { spec.look }
    private var w: CGFloat { spec.size.width }
    private var h: CGFloat { spec.size.height }
    private var metrics: SignalsWidgetTileMetrics { spec.metrics }

    private var isSent: Bool { if case .sent = spec.state { return true } else { return false } }
    private var isFailed: Bool { if case .failed = spec.state { return true } else { return false } }

    var body: some View {
        content
            .frame(width: w, height: h)
            .background(chrome)
            .overlay(alignment: .topLeading) { sentHearts }
            .contentShape(shape)
            .scaleEffect(sending ? 0.965 : 1)
    }

    // MARK: The sent moment: three little hearts pop out of the picture and float up to the corner

    /// Where the picture's centre sits in this tile (where the hearts start from).
    private var pictureCenter: CGPoint {
        let m = metrics
        switch spec.variant {
        case .stack: return CGPoint(x: w / 2, y: h * (m.lines > 1 ? 0.3 : 0.33))
        case .row, .banner: return CGPoint(x: m.leading + m.picture / 2, y: h / 2)
        case .hero: return CGPoint(x: w / 2, y: h * 0.44)
        case .circle, .capsule: return CGPoint(x: w / 2, y: h / 2)
        }
    }

    private struct FloatingHeart: Identifiable {
        var id: Int
        var center: CGPoint
        var size: CGFloat
        var turn: Double
        var delay: Double
        var alpha: Double
    }

    /// Their resting places, in the tile's top corner (where the doodles were), biggest highest.
    private var floatingHearts: [FloatingHeart] {
        let unit: CGFloat
        switch spec.variant {
        case .stack: unit = min(w, h) * 0.2
        case .row: unit = h * 0.24
        case .hero: unit = 24
        case .banner: unit = h * 0.24
        case .circle, .capsule: return []
        }
        let corner = CGPoint(x: w - 7 - unit * 0.5, y: 6 + unit * 0.42)
        if spec.variant == .stack {
            // Narrow buttons: the trail runs down the right edge, clear of the picture.
            return [
                FloatingHeart(id: 0, center: corner, size: unit, turn: 12, delay: 0, alpha: 1),
                FloatingHeart(id: 1, center: CGPoint(x: corner.x + unit * 0.12, y: corner.y + unit * 1.05), size: unit * 0.62, turn: -12, delay: 0.12, alpha: 0.9),
                FloatingHeart(id: 2, center: CGPoint(x: corner.x - unit * 0.1, y: corner.y + unit * 1.75), size: unit * 0.42, turn: 8, delay: 0.22, alpha: 0.8),
            ]
        }
        return [
            FloatingHeart(id: 0, center: corner, size: unit, turn: 12, delay: 0, alpha: 1),
            FloatingHeart(id: 1, center: CGPoint(x: corner.x - unit * 1.05, y: corner.y + unit * 0.5), size: unit * 0.64, turn: -14, delay: 0.12, alpha: 0.9),
            FloatingHeart(id: 2, center: CGPoint(x: corner.x - unit * 0.42, y: corner.y + unit * 1.2), size: unit * 0.44, turn: 8, delay: 0.22, alpha: 0.8),
        ]
    }

    @ViewBuilder
    private var sentHearts: some View {
        // The container is always there, so each heart is inserted on its own and gets its transition
        // (WidgetKit animates it between timeline entries; a view that rests outside the widget is
        // dropped, so these come to rest inside the button).
        ZStack(alignment: .topLeading) {
            Color.clear
            if isSent {
                ForEach(floatingHearts) { heart in
                    SignalsWidgetFlyingHeart(look: look)
                        .frame(width: heart.size, height: heart.size * 0.85)
                        .rotationEffect(.degrees(heart.turn))
                        .opacity(heart.alpha)
                        .position(heart.center)
                        .transition(.asymmetric(
                            insertion: .offset(x: pictureCenter.x - heart.center.x, y: pictureCenter.y - heart.center.y)
                                .combined(with: .scale(scale: 0.2))
                                .combined(with: .opacity)
                                .animation(.spring(duration: 0.95, bounce: 0.35).delay(heart.delay)),
                            removal: .opacity.animation(.easeOut(duration: 0.4))))
                }
            }
        }
        .frame(width: w, height: h)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: Chrome

    private var radius: CGFloat {
        switch spec.variant {
        case .stack: return min(16, w * 0.21)
        case .row: return min(17, h * 0.27)
        case .hero: return 20
        case .banner: return 19
        case .circle: return w / 2
        case .capsule: return min(14, h * 0.3)
        }
    }

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: radius, style: .continuous) }

    private var accent: Color {
        look.isMono ? .white : (look.dark ? SignalsWidgetPalette.heartLight : SignalsWidgetPalette.heart)
    }

    @ViewBuilder
    private var chrome: some View {
        let tint = signal.tint
        if spec.variant == .circle || spec.variant == .capsule {
            // Lock Screen: the system's own translucent backing, a ring when it's just been sent.
            ZStack {
                SignalsWidgetAccessoryBackground(circle: spec.variant == .circle)
                if isSent {
                    shape.strokeBorder(Color.white.opacity(0.9), lineWidth: 1.5)
                }
            }
        } else {
            ZStack {
                shape.fill(LinearGradient(colors: [look.tileTop(tint), look.tileBottom(tint)], startPoint: .top, endPoint: .bottom))
                if !look.isMono && !look.dark {
                    // A soft shine across the top half, like a glossy sticker.
                    shape.inset(by: 1.2)
                        .stroke(LinearGradient(colors: [Color.white.opacity(0.9), Color.white.opacity(0)],
                                               startPoint: .top, endPoint: .center), lineWidth: 1.4)
                }
                shape.inset(by: stitchInset)
                    .stroke(isSent || sending ? accent.opacity(look.isMono ? 0.7 : 0.55) : look.stitch(tint),
                            style: StrokeStyle(lineWidth: 1.15, lineCap: .round, dash: [3.1, 2.6]))
                shape.strokeBorder(isSent ? accent.opacity(look.isMono ? 0.9 : 0.75) : look.tileEdge(tint),
                                   lineWidth: isSent ? 1.6 : 1)
            }
            .compositingGroup()
            .shadow(color: isSent && !look.isMono ? accent.opacity(look.dark ? 0.45 : 0.32) : look.tileShadow,
                    radius: isSent ? 6 : 2.5, y: isSent ? 0 : 1.5)
        }
    }

    private var stitchInset: CGFloat {
        switch spec.variant {
        case .hero, .banner: return 4.5
        default: return 3.5
        }
    }

    // MARK: Words

    /// A signal's words on a tile of this kind, when nothing has happened yet.
    static func idleWords(_ signal: SignalsWidgetSignal, variant: SignalsWidgetTileVariant, size: CGSize) -> String {
        switch variant {
        case .stack: return size.height > 100 ? signal.label : signal.shortLabel
        case .row, .hero: return signal.rowLabel
        case .capsule, .circle: return signal.tinyLabel
        case .banner: return signal.label
        }
    }

    private var words: String {
        if sending { return "sending…" }
        switch spec.state {
        case .idle: return Self.idleWords(signal, variant: spec.variant, size: spec.size)
        case .sent(let test): return test ? "test ✓" : "sent ♡"
        case .failed(let problem):
            switch problem {
            case .slowDown: return "in a bit ♡"
            case .notSetUp, .locked: return "open the app"
            case .offline, .server: return "try again"
            }
        }
    }

    private var face: String {
        switch spec.state {
        case .idle: return signal.kaomoji
        case .sent: return "(*´▽`*)♡"
        case .failed(let problem): return problem == .slowDown ? "(´｡•ω•｡`)" : "(；ω；)"
        }
    }

    private var wordsColor: Color {
        if look.isMono { return .white }
        switch spec.state {
        case .idle: return sending ? look.quiet : look.label
        case .sent, .failed: return accent
        }
    }

    /// The label: the group's shared size, made smaller only if this tile's own words need it.
    private var labelSize: CGFloat {
        let own = metrics.fit(words)
        return min(spec.labelSize ?? own, own)
    }

    private func label(align: TextAlignment = .center) -> some View {
        let size = labelSize
        return SignalsWidgetFonts.hand(words, size: size)
            .tracking(metrics.tracking)
            .foregroundStyle(wordsColor)
            .multilineTextAlignment(align)
            .lineLimit(metrics.lines)
            .minimumScaleFactor(0.85)
            .lineSpacing(-size * 0.18)
            .id(words)
            .transition(.push(from: .bottom).combined(with: .opacity))
    }

    private func kaomoji(_ size: CGFloat) -> some View {
        Text(face)
            .font(SignalsWidgetFonts.kaomoji(size: size))
            .foregroundStyle(look.kaomoji(signal.tint))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .opacity(sending ? 0.5 : 1)
            .id(face)
            .transition(.opacity)
    }

    private func picture(_ size: CGFloat) -> some View {
        ZStack {
            if !look.isMono {
                // A soft white halo so every emoji glows on its pastel.
                Circle()
                    .fill(RadialGradient(colors: [Color.white.opacity(look.dark ? 0.16 : 0.85), Color.white.opacity(0)],
                                         center: .center, startRadius: 0, endRadius: size * 0.62))
                    .frame(width: size * 1.3, height: size * 1.3)
            }
            SignalsWidgetPicture(signal: signal, look: look, size: size)
                .opacity(sending ? 0.55 : 1)
            if isSent || sending {
                SignalsWidgetSentBadge(look: look, sending: sending)
                    .frame(width: size * 0.42, height: size * 0.42)
                    .offset(x: size * 0.36, y: size * 0.3)
                    .transition(.scale(scale: 0.2).combined(with: .opacity))
            }
        }
        .frame(width: size, height: size)
    }

    private func doodle(_ size: CGFloat) -> some View {
        // The sent hearts take the doodles' corner for a minute.
        SignalsWidgetDoodle(signal: signal, color: look.doodle(signal.tint), size: size)
            .opacity(isSent ? 0 : 1)
    }

    // MARK: Layouts

    @ViewBuilder
    private var content: some View {
        let m = metrics
        switch spec.variant {
        case .stack:
            // Picture, kaomoji and a label box of fixed height, centred: a row of buttons lines up
            // even when one label takes two lines.
            let roomy = m.lines > 1
            ZStack(alignment: .topTrailing) {
                VStack(spacing: 0) {
                    picture(m.picture)
                    kaomoji(m.kaomoji)
                        .padding(.horizontal, 3)
                        .padding(.top, roomy ? 6 : 2)
                    label()
                        .padding(.horizontal, roomy ? 4 : 2)
                        .frame(height: m.label.upperBound * (roomy ? 2.2 : 1.15), alignment: .top)
                        .padding(.top, roomy ? 2 : 0)
                }
                .padding(.top, roomy ? 4 : 2)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                doodle(min(20, w * 0.27)).padding(.top, 6).padding(.trailing, 6)
            }

        case .row:
            ZStack(alignment: .topTrailing) {
                HStack(spacing: m.gap) {
                    picture(m.picture)
                    VStack(alignment: .leading, spacing: h * 0.02) {
                        label(align: .leading)
                        kaomoji(m.kaomoji)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.leading, m.leading)
                .padding(.trailing, m.trailing)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                doodle(min(22, h * 0.32)).padding(.top, 6).padding(.trailing, 7)
            }

        case .hero:
            ZStack(alignment: .topTrailing) {
                VStack(spacing: 2) {
                    (SignalsWidgetFonts.hand("to \(spec.otherName) ", size: 15).foregroundStyle(look.quiet)
                        + Text("♡").font(SignalsWidgetFonts.kaomoji(size: 12)).foregroundStyle(look.heartText))
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Spacer(minLength: 0)
                    picture(m.picture)
                    Spacer(minLength: 2)
                    kaomoji(m.kaomoji)
                    label()
                }
                .padding(.horizontal, 12)
                .padding(.top, 9)
                .padding(.bottom, 8)
                doodle(26).padding(.top, 9).padding(.trailing, 10)
            }

        case .banner:
            HStack(spacing: m.gap) {
                picture(m.picture)
                VStack(alignment: .leading, spacing: 2) {
                    label(align: .leading)
                    kaomoji(m.kaomoji)
                }
                Spacer(minLength: 0)
                SignalsWidgetHeartTrail(color: look.doodle(signal.tint), height: m.picture)
                    .padding(.trailing, h * 0.22)
            }
            .padding(.leading, m.leading)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

        case .circle:
            VStack(spacing: 0) {
                SignalsWidgetPicture(signal: isSent ? .thinking : signal, look: look, size: m.picture)
                Text(isSent ? "sent" : signal.tinyLabel)
                    .font(.system(size: m.label.upperBound, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .padding(.top, 2)

        case .capsule:
            VStack(spacing: 1) {
                SignalsWidgetPicture(signal: isSent ? .thinking : signal, look: look, size: m.picture)
                Text(isSent ? "sent ♡" : signal.tinyLabel)
                    .font(.system(size: m.label.upperBound, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .padding(.horizontal, 4)
        }
    }
}

/// Three little hearts drifting up and away, on the large widget's ♡.
struct SignalsWidgetHeartTrail: View {
    var color: Color
    var height: CGFloat

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            heart(0.26, x: 0, y: 0, alpha: 0.55, turn: -12)
            heart(0.34, x: height * 0.3, y: -height * 0.3, alpha: 0.75, turn: 8)
            heart(0.46, x: height * 0.62, y: -height * 0.62, alpha: 1, turn: -6)
        }
        .frame(width: height * 1.1, height: height, alignment: .bottomLeading)
        .accessibilityHidden(true)
    }

    private func heart(_ scale: CGFloat, x: CGFloat, y: CGFloat, alpha: Double, turn: Double) -> some View {
        SignalsWidgetHeart().fill(color.opacity(alpha))
            .frame(width: height * scale, height: height * scale * 0.85)
            .rotationEffect(.degrees(turn))
            .offset(x: x, y: y)
    }
}

/// The little red ♡ with a tick that lands on a sent signal's picture (a ring of dots while sending).
struct SignalsWidgetSentBadge: View {
    var look: SignalsWidgetLook
    var sending: Bool

    var body: some View {
        GeometryReader { proxy in
            let s = proxy.size.width
            ZStack {
                if sending {
                    Circle()
                        .fill(look.isMono ? Color.white.opacity(0.3) : Color.white)
                    Circle()
                        .strokeBorder(look.isMono ? Color.white : SignalsWidgetPalette.heart.opacity(0.7),
                                      style: StrokeStyle(lineWidth: max(1.2, s * 0.09), lineCap: .round, dash: [s * 0.08, s * 0.14]))
                        .padding(s * 0.12)
                } else if look.isMono {
                    // One colour: a white disc with the heart cut out of it.
                    SignalsWidgetBadgeShape().fill(Color.white, style: FillStyle(eoFill: true))
                } else {
                    Circle().fill(Color.white)
                    SignalsWidgetHeart()
                        .fill(SignalsWidgetPalette.heart)
                        .frame(width: s * 0.66, height: s * 0.56)
                        .offset(y: s * 0.03)
                }
            }
            .frame(width: s, height: s)
            .shadow(color: look.isMono ? .clear : SignalsWidgetPalette.rgb(0x632bb5, 0.25), radius: 1.5, y: 0.5)
        }
    }
}

struct SignalsWidgetBadgeShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path(ellipseIn: rect)
        let w = rect.width * 0.66, h = rect.height * 0.56
        path.addPath(SignalsWidgetHeart().path(in: CGRect(x: rect.midX - w / 2, y: rect.midY - h / 2 + rect.height * 0.03, width: w, height: h)))
        return path
    }
}

/// The Lock Screen's translucent backing (drawn by the system on iPhone).
struct SignalsWidgetAccessoryBackground: View {
    var circle: Bool

    var body: some View {
        #if os(iOS)
        if circle {
            AccessoryWidgetBackground().clipShape(Circle())
        } else {
            AccessoryWidgetBackground().clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        #else
        if circle { Circle().fill(Color.white.opacity(0.18)) } else { RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.18)) }
        #endif
    }
}

extension SignalsWidgetSignal {
    /// For the large widget's pairs: the full label where it fits on one line.
    var rowLabel: String {
        switch self {
        case .water: return "drink water"
        default: return label
        }
    }

    /// One word for the Lock Screen.
    var tinyLabel: String {
        switch self {
        case .thinking: return "thinking"
        case .hug: return "hug"
        case .kiss: return "kiss"
        case .morning: return "morning"
        case .night: return "night"
        case .miss: return "miss u"
        case .water: return "water"
        }
    }
}
