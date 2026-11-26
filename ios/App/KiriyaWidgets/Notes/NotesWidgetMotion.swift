import SwiftUI

// How the little note moves when the timeline changes (iOS 17 widget animations).
//
// A widget runs no code while it animates: the system interpolates between two entries, and it can
// only do that for SwiftUI's built-in transitions (push, move, offset, scale, opacity and their
// combinations; Apple: "Animating data updates in widgets and Live Activities"). A custom
// `.modifier` transition falls back to a plain cross-fade (seen on the lab simulator), so every
// transition here is built from built-ins only. Animations are capped at 2 seconds.
//
// - A new note is passed in: the new folded note pushes in from the right edge as the old page
//   slides away to the left (`pass`); the words written on the desk fade in once it has landed.
// - Peeling: the tape lifts up and away (`peel`), the folded note lets go (`letGo`), the page opens
//   out from where the tape held it (`unfold`) and a fresh strip of tape is pressed down (`press`).
//
// The `NotesWidget…` modifiers below draw exactly what those built-ins do at a given progress, so the
// render lab can draw any frame of the motion as the system will (`./lab.sh gif …`).
//
// Every layer the sheet draws is as big as the widget, so the anchors are points in the widget
// (the tape's end, the page's top edge), given as UnitPoints of the widget's size.

enum NotesWidgetMotion {
    /// About a second, a soft landing with a touch of bounce.
    static let response = 0.78
    static let damping = 0.74
    static let animation = Animation.spring(response: response, dampingFraction: damping)

    /// The tape goes first; the page opens a moment later. Words written on the desk only appear
    /// once a new note has nearly landed.
    static let unfoldDelay = 0.08
    static let deskDelay = 0.34

    /// The same spring as a function of time, for the render lab (SwiftUI's spring, from 0 to 1).
    static func spring(_ t: Double) -> Double {
        guard t > 0 else { return 0 }
        let omega = 2 * Double.pi / response
        let wd = omega * sqrt(1 - damping * damping)
        let envelope = exp(-damping * omega * t)
        return 1 - envelope * (cos(wd * t) + (damping * omega / wd) * sin(wd * t))
    }

    /// Seconds after a change → a piece's progress, for the render lab.
    static func progress(_ seconds: Double, delay: Double = 0) -> CGFloat { CGFloat(spring(seconds - delay)) }

    // MARK: the transitions (built-ins only)

    /// In from the trailing edge, the old one out towards the leading edge, both fading.
    static var pass: AnyTransition { .push(from: .trailing) }

    static var deskWords: AnyTransition {
        .asymmetric(insertion: .opacity.animation(animation.delay(deskDelay)), removal: .opacity.animation(.easeOut(duration: 0.2)))
    }

    static let peelOffset = CGSize(width: 46, height: -40)
    static let peelScale: CGFloat = 1.16
    static func peel(anchor: UnitPoint) -> AnyTransition {
        .asymmetric(insertion: .opacity,
                    removal: AnyTransition.offset(peelOffset).combined(with: .scale(scale: peelScale, anchor: anchor)).combined(with: .opacity))
    }

    static let pressScale: CGFloat = 1.5
    static let pressLift: CGFloat = -9
    static func press(anchor: UnitPoint) -> AnyTransition {
        .asymmetric(insertion: AnyTransition.scale(scale: pressScale, anchor: anchor).combined(with: .offset(y: pressLift)).combined(with: .opacity)
                        .animation(animation.delay(unfoldDelay)),
                    removal: .opacity)
    }

    static let unfoldScale: CGFloat = 0.5
    static func unfold(anchor: UnitPoint) -> AnyTransition {
        .asymmetric(insertion: AnyTransition.scale(scale: unfoldScale, anchor: anchor).combined(with: .opacity)
                        .animation(animation.delay(unfoldDelay)),
                    removal: .opacity)
    }

    static let letGoScale: CGFloat = 1.06
    static func letGo(anchor: UnitPoint) -> AnyTransition {
        .asymmetric(insertion: .opacity, removal: AnyTransition.scale(scale: letGoScale, anchor: anchor).combined(with: .opacity))
    }
}

// MARK: - The same transitions at a given progress (the render lab's frames)

private func lerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat { a + (b - a) * t }
private func clamp(_ x: CGFloat) -> Double { Double(min(1, max(0, x))) }

/// `.push(from: .trailing)`, inserting: 0 = a whole widget to the right and clear, 1 = in place.
struct NotesWidgetPassIn: ViewModifier {
    var progress: CGFloat
    var distance: CGFloat
    func body(content: Content) -> some View {
        content.offset(x: lerp(distance, 0, progress)).opacity(clamp(progress))
    }
}

/// `.push(from: .trailing)`, removing: 0 = in place, 1 = a whole widget to the left and clear.
struct NotesWidgetPassOut: ViewModifier {
    var progress: CGFloat
    var distance: CGFloat
    func body(content: Content) -> some View {
        content.offset(x: lerp(0, -distance, progress)).opacity(clamp(1 - progress))
    }
}

/// `peel`, removing: 0 = stuck down, 1 = gone up and away.
struct NotesWidgetPeel: ViewModifier {
    var progress: CGFloat
    var anchor: UnitPoint
    func body(content: Content) -> some View {
        content
            .scaleEffect(lerp(1, NotesWidgetMotion.peelScale, progress), anchor: anchor)
            .offset(x: lerp(0, NotesWidgetMotion.peelOffset.width, progress), y: lerp(0, NotesWidgetMotion.peelOffset.height, progress))
            .opacity(clamp(1 - progress))
    }
}

/// `press`, inserting: 0 = above the page, bigger, clear; 1 = pressed flat.
struct NotesWidgetPress: ViewModifier {
    var progress: CGFloat
    var anchor: UnitPoint
    func body(content: Content) -> some View {
        content
            .scaleEffect(lerp(NotesWidgetMotion.pressScale, 1, progress), anchor: anchor)
            .offset(y: lerp(NotesWidgetMotion.pressLift, 0, progress))
            .opacity(clamp(progress))
    }
}

/// `unfold`, inserting: 0 = small at the tape and clear, 1 = the whole page.
struct NotesWidgetUnfold: ViewModifier {
    var progress: CGFloat
    var anchor: UnitPoint
    func body(content: Content) -> some View {
        content.scaleEffect(lerp(NotesWidgetMotion.unfoldScale, 1, progress), anchor: anchor).opacity(clamp(progress))
    }
}

/// `letGo`, removing: 0 = in place, 1 = lifted a touch towards her and gone.
struct NotesWidgetLetGo: ViewModifier {
    var progress: CGFloat
    var anchor: UnitPoint
    func body(content: Content) -> some View {
        content.scaleEffect(lerp(1, NotesWidgetMotion.letGoScale, progress), anchor: anchor).opacity(clamp(1 - progress))
    }
}
