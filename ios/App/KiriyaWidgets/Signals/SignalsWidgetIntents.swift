import AppIntents
import WidgetKit

// The widget's two intents: the button press (send one signal) and its "Edit Widget" choices.
// Both live in the widget extension only; Siri and Shortcuts keep using SendTapIntent.

extension SignalsWidgetSignal: AppEnum {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Little signal"
    static var caseDisplayRepresentations: [SignalsWidgetSignal: DisplayRepresentation] = [
        .thinking: DisplayRepresentation(title: "♡ thinking of you", subtitle: "(˘︶˘)♡"),
        .hug: DisplayRepresentation(title: "🫂 a big hug", subtitle: "(っ´▽`)っ"),
        .kiss: DisplayRepresentation(title: "😘 a kiss", subtitle: "(˘ ³˘)♥"),
        .morning: DisplayRepresentation(title: "☀️ good morning", subtitle: "(＾▽＾)ノ"),
        .night: DisplayRepresentation(title: "🌙 goodnight", subtitle: "(－ω－)zZ"),
        .miss: DisplayRepresentation(title: "🥺 miss you", subtitle: "(｡•︿•｡)"),
        .water: DisplayRepresentation(title: "💧 drink some water", subtitle: "(˘▽˘)っ旦"),
    ]
}

/// A button press. Runs in the widget extension; when it returns, the system reloads the timeline,
/// which picks up the moment it remembered (sent / test / didn't send).
struct SignalsWidgetSendIntent: AppIntent {
    static var title: LocalizedStringResource = "Send a little signal"
    static var description = IntentDescription("Sends one of the little signals from the Thinking of you widget.")
    /// Only for the widget's buttons: Shortcuts and Siri already have "Send a little tap".
    static var isDiscoverable: Bool = false

    @Parameter(title: "Signal")
    var signal: SignalsWidgetSignal

    init() {}

    init(signal: SignalsWidgetSignal) {
        self.signal = signal
    }

    func perform() async throws -> some IntentResult {
        await SignalsWidgetSender.send(signal)
        return .result()
    }
}

/// How many signals the small widget shows.
enum SignalsWidgetSmallStyle: String, AppEnum {
    case four, two, one

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Layout"
    static var caseDisplayRepresentations: [SignalsWidgetSmallStyle: DisplayRepresentation] = [
        .four: "Four little ones",
        .two: "Two",
        .one: "One big one",
    ]

    var count: Int {
        switch self {
        case .four: return 4
        case .two: return 2
        case .one: return 1
        }
    }
}

/// "Edit Widget": which signals, in which order. The large widget always shows all seven.
struct SignalsWidgetConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Thinking of you"
    static var description = IntentDescription("Pick the little signals this widget sends.")

    @Parameter(title: "Show", default: .four)
    var smallStyle: SignalsWidgetSmallStyle

    @Parameter(title: "First", default: .thinking)
    var first: SignalsWidgetSignal

    @Parameter(title: "Second", default: .hug)
    var second: SignalsWidgetSignal

    @Parameter(title: "Third", default: .kiss)
    var third: SignalsWidgetSignal

    @Parameter(title: "Fourth", default: .miss)
    var fourth: SignalsWidgetSignal

    init() {}

    init(smallStyle: SignalsWidgetSmallStyle, signals: [SignalsWidgetSignal]) {
        let picked = signals.signalsWidgetUnique(4)
        self.smallStyle = smallStyle
        self.first = picked[0]
        self.second = picked[1]
        self.third = picked[2]
        self.fourth = picked[3]
    }

    var signals: [SignalsWidgetSignal] { [first, second, third, fourth].signalsWidgetUnique(4) }

    static var parameterSummary: some ParameterSummary {
        When(widgetFamily: .equalTo, .systemSmall) {
            When(\SignalsWidgetConfigurationIntent.$smallStyle, .equalTo, .one) {
                Summary("\(\.$smallStyle): \(\.$first)")
            } otherwise: {
                When(\SignalsWidgetConfigurationIntent.$smallStyle, .equalTo, .two) {
                    Summary("\(\.$smallStyle): \(\.$first) and \(\.$second)")
                } otherwise: {
                    Summary("\(\.$smallStyle)") {
                        \.$first
                        \.$second
                        \.$third
                        \.$fourth
                    }
                }
            }
        } otherwise: {
            When(widgetFamily: .equalTo, .systemMedium) {
                Summary("Send \(\.$first)") {
                    \.$second
                    \.$third
                    \.$fourth
                }
            } otherwise: {
                When(widgetFamily: .equalTo, .accessoryCircular) {
                    Summary("Send \(\.$first)")
                } otherwise: {
                    When(widgetFamily: .equalTo, .accessoryRectangular) {
                        Summary("Send \(\.$first) or \(\.$second)")
                    } otherwise: {
                        Summary("All seven little signals")
                    }
                }
            }
        }
    }
}
