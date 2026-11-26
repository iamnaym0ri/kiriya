import SwiftUI

// The seven one-tap signals as the "Thinking of you" widget shows them. Keys are what the server
// expects (shared/taps.js); the emoji and labels match it, and the kaomoji are the ones proposed for
// its new `kaomoji` field, so the widget button and the notification she gets read the same.
//
// Kaomoji are set in Hiragino Maru Gothic (the rounded face behind the site's "M PLUS Rounded 1c",
// on every iPhone). Each one was checked glyph by glyph on iOS and macOS: no boxes, no combining marks.

enum SignalsWidgetSignal: String, CaseIterable, Hashable, Codable, Sendable {
    case thinking, hug, kiss, morning, night, miss, water

    /// The emoji from shared/taps.js. ♡ is drawn (a glossy heart), not typed.
    var emoji: String {
        switch self {
        case .thinking: return "♡"
        case .hug: return "🫂"
        case .kiss: return "😘"
        case .morning: return "☀️"
        case .night: return "🌙"
        case .miss: return "🥺"
        case .water: return "💧"
        }
    }

    var kaomoji: String {
        switch self {
        case .thinking: return "(˘︶˘)♡"
        case .hug: return "(っ´▽`)っ"
        case .kiss: return "(˘ ³˘)♥"
        case .morning: return "(＾▽＾)ノ"
        case .night: return "(－ω－)zZ"
        case .miss: return "(｡•︿•｡)"
        case .water: return "(˘▽˘)っ旦"
        }
    }

    /// shared/taps.js `label`, for roomy buttons.
    var label: String {
        switch self {
        case .thinking: return "thinking of you"
        case .hug: return "a big hug"
        case .kiss: return "a kiss"
        case .morning: return "good morning"
        case .night: return "goodnight"
        case .miss: return "miss you"
        case .water: return "drink some water"
        }
    }

    /// For the little buttons (the small widget's four, the Lock Screen).
    var shortLabel: String {
        switch self {
        case .thinking: return "thinking of u"
        case .hug: return "a hug"
        case .kiss: return "a kiss"
        case .morning: return "morning!"
        case .night: return "goodnight"
        case .miss: return "miss you"
        case .water: return "drink water"
        }
    }

    /// What VoiceOver says for the button ("Send Josh: a big hug").
    func spoken(to name: String) -> String { "Send \(name): \(label)" }

    /// The notification sound for this signal (ForTheApp/Sounds; aps.sound on the server).
    var soundName: String { "SignalsWidget-\(rawValue).caf" }

    /// Each signal's own pastel, so she finds it by colour as much as by picture.
    var tint: SignalsWidgetTint {
        switch self {
        case .thinking: return .init(base: 0xf6d9ee, light: 0xfdf2fa, edge: 0xe7b3d6, ink: 0xb44d86, nightTop: 0x5c2d58, nightBottom: 0x441f43, nightEdge: 0x93508a)
        case .hug: return .init(base: 0xffdcc9, light: 0xfff3eb, edge: 0xf2bb9c, ink: 0xc4643f, nightTop: 0x603639, nightBottom: 0x47272c, nightEdge: 0xa06656)
        case .kiss: return .init(base: 0xffd0e1, light: 0xfff0f6, edge: 0xf2a5c3, ink: 0xd2477f, nightTop: 0x612b4a, nightBottom: 0x481f38, nightEdge: 0xa54d7c)
        case .morning: return .init(base: 0xffecb0, light: 0xfffae4, edge: 0xefd17e, ink: 0xc28a12, nightTop: 0x5e4522, nightBottom: 0x45321b, nightEdge: 0xa9843c)
        case .night: return .init(base: 0xdcd6f8, light: 0xf4f2fe, edge: 0xb8aee8, ink: 0x6a5bc0, nightTop: 0x392f6a, nightBottom: 0x2a2452, nightEdge: 0x6f63b6)
        case .miss: return .init(base: 0xd4e9fb, light: 0xf0f7fe, edge: 0xa6caea, ink: 0x4a80b8, nightTop: 0x27405f, nightBottom: 0x1d304b, nightEdge: 0x5079ac)
        case .water: return .init(base: 0xcdeeea, light: 0xeefbf9, edge: 0x98d5cc, ink: 0x2f958a, nightTop: 0x214c50, nightBottom: 0x183a3e, nightEdge: 0x45918b)
        }
    }

    /// The large widget's fixed order: the signature ♡ on top, then three pairs that belong together.
    static let largeOrder: [SignalsWidgetSignal] = [.thinking, .hug, .kiss, .morning, .night, .miss, .water]

    /// What a new widget shows before she picks her own.
    static let defaults: [SignalsWidgetSignal] = [.thinking, .hug, .kiss, .miss]
}

/// A signal's colours: `base` fills the button, `light` is its top, `edge` its rim, `ink` its doodles;
/// `night…` are the same hue as a deep jewel tone for dark mode (a faded pastel turns muddy on plum).
struct SignalsWidgetTint: Hashable {
    let base: UInt32
    let light: UInt32
    let edge: UInt32
    let ink: UInt32
    let nightTop: UInt32
    let nightBottom: UInt32
    let nightEdge: UInt32

    var baseColor: Color { SignalsWidgetPalette.rgb(base) }
    var lightColor: Color { SignalsWidgetPalette.rgb(light) }
    var edgeColor: Color { SignalsWidgetPalette.rgb(edge) }
    var inkColor: Color { SignalsWidgetPalette.rgb(ink) }
}

extension Array where Element == SignalsWidgetSignal {
    /// No signal twice (a doubled pick is filled with the next default), at most `count`.
    func signalsWidgetUnique(_ count: Int) -> [SignalsWidgetSignal] {
        var seen = Set<SignalsWidgetSignal>()
        var out: [SignalsWidgetSignal] = []
        for signal in self + SignalsWidgetSignal.defaults + SignalsWidgetSignal.allCases where !seen.contains(signal) {
            seen.insert(signal)
            out.append(signal)
            if out.count == count { break }
        }
        return out
    }
}
