import SwiftUI

// Sample notes and scripted state changes for the lab. A script is the card's states over time, as
// the host would set them; `story(at:)` replays it into the JarStory the card would hold at that time.

enum LabNotes {
    static let byline = "— Josh <3"
    static let short = JarPulledNote(text: "you’re my favourite person to do nothing with.", byline: byline, label: "for the comfy days")
    static let medium = JarPulledNote(text: "you don’t have to finish everything today. close one tab, drink some water, and let me be proud of you anyway. i already am.",
                                      byline: byline, label: "for the 47-tabs-open days")
    static let mediumNoLabel = JarPulledNote(text: medium.text, byline: byline, label: nil)
    static let long = JarPulledNote(text: "i was thinking about the first time you laughed so hard at your own joke that you couldn’t finish it, and how i didn’t even need the ending because watching you was the whole joke. that’s you, all the time: the best part of every room, even the boring ones. if today feels heavy, put some of it down for a minute. eat something warm, text me something dumb, and remember that someone on the other side of the world is counting down the days until he can make you tea again. you are so loved, so much more than this little note can carry. ok that’s all. go be a menace ❤️",
                                    byline: byline, label: "a little note, just for u")
    static let longNoLabel = JarPulledNote(text: long.text, byline: byline, label: nil)
    static let mediumLong = JarPulledNote(text: "remember when we got lost looking for that dessert place and ended up sharing fries on the curb instead? that was one of my favourite nights. you make the wrong turns feel like the plan. i hope today has at least one wrong turn that turns out right. i love you, menace.",
                                          byline: byline, label: "for the can't-sit-still days")
    static let tiny = JarPulledNote(text: "hi. i love u.", byline: byline, label: "for the cute days")
    static let preview = JarPulledNote(text: medium.text, byline: byline, label: "for the 47-tabs-open days", isPreview: true)
    static let noByline = JarPulledNote(text: "drink some water, pretty girl 💧", byline: "", label: "for the grr days")
}

struct LabScript {
    var name: String
    var heading: String
    var newCount: Int?
    var initial: JarCardState
    /// (seconds, state)
    var events: [(Double, JarCardState)]
    var range: ClosedRange<Double>
    var fps: Double
    var reduceMotion = false

    /// Scene time starts at an arbitrary reference so absolute-time loops look as they would live.
    static let epoch: Double = 10_000

    func story(at t: Double) -> JarStory {
        var story = JarStory(initial: initial)
        for (time, state) in events where time <= t {
            story.advance(to: state, at: Self.epoch + time)
        }
        return story
    }

    var times: [Double] {
        let count = Int(((range.upperBound - range.lowerBound) * fps).rounded()) + 1
        return (0..<count).map { range.lowerBound + Double($0) / fps }
    }
}

enum LabScenarios {
    static let morning = "2 new little notes in your jar ❤️"
    static let reminder = "a little note has been waiting since this morning ♡"

    static func all() -> [LabScript] {
        [
            // The jar waiting: the app's idle loops (wiggle every 4.5 s).
            LabScript(name: "waiting-badge2", heading: morning, newCount: 2, initial: .waiting, events: [], range: 0...4.5, fps: 30),
            LabScript(name: "waiting-badge1", heading: reminder, newCount: 1, initial: .waiting, events: [], range: 2.9...4.4, fps: 10),
            LabScript(name: "waiting-badge3", heading: "3 new little notes in your jar ❤️", newCount: 3, initial: .waiting, events: [], range: 2.9...4.4, fps: 10),
            LabScript(name: "waiting-nil", heading: "a little love is waiting in your jar ❤️", newCount: nil, initial: .waiting, events: [], range: 2.9...4.4, fps: 10),
            // Finding a note (long network wait).
            LabScript(name: "pulling-loop", heading: morning, newCount: 2, initial: .waiting, events: [(0.5, .pulling)], range: 0.3...3.3, fps: 30),
            // The full pull from the waiting jar.
            LabScript(name: "pull-medium", heading: morning, newCount: 2, initial: .waiting,
                      events: [(1.0, .pulling), (2.35, .pulled(LabNotes.medium))], range: 0.6...6.2, fps: 60),
            LabScript(name: "pull-short", heading: reminder, newCount: 1, initial: .waiting,
                      events: [(0.5, .pulling), (1.1, .pulled(LabNotes.short))], range: 0.4...5.2, fps: 30),
            LabScript(name: "pull-long", heading: morning, newCount: 2, initial: .waiting,
                      events: [(0.5, .pulling), (1.4, .pulled(LabNotes.long))], range: 0.4...5.6, fps: 30),
            // A fast network: 0.2 s of pulling.
            LabScript(name: "pull-fast", heading: morning, newCount: 2, initial: .waiting,
                      events: [(0.5, .pulling), (0.7, .pulled(LabNotes.medium))], range: 0.4...4.6, fps: 30),
            // Pull another: the read note is swept aside, the small jar gives up another.
            LabScript(name: "repeat", heading: morning, newCount: 2, initial: .pulled(LabNotes.short),
                      events: [(0.6, .pulling), (1.55, .pulled(LabNotes.medium))], range: 0.4...5.6, fps: 60),
            LabScript(name: "repeat-shorter", heading: morning, newCount: nil, initial: .pulled(LabNotes.long),
                      events: [(0.5, .pulling), (1.0, .pulled(LabNotes.tiny))], range: 0.4...5.0, fps: 30),
            // It didn't work.
            LabScript(name: "failed", heading: morning, newCount: 2, initial: .waiting,
                      events: [(0.5, .pulling), (2.0, .failed("the jar got a little stuck. try again?"))], range: 0.3...3.2, fps: 30),
            LabScript(name: "failed-after", heading: morning, newCount: nil, initial: .pulled(LabNotes.medium),
                      events: [(0.5, .pulling), (1.6, .failed("the jar got a little stuck. try again?"))], range: 0.3...2.8, fps: 20),
            // Reduce Motion: crossfades only.
            LabScript(name: "reduce-motion", heading: morning, newCount: 2, initial: .waiting,
                      events: [(0.5, .pulling), (1.5, .pulled(LabNotes.medium))], range: 0.3...2.3, fps: 20, reduceMotion: true),
        ]
    }

    /// Resting notes, for stills.
    static let rests: [(String, JarPulledNote, Int?)] = [
        ("tiny", LabNotes.tiny, 2), ("short", LabNotes.short, nil), ("medium", LabNotes.medium, 2), ("medium-nolabel", LabNotes.mediumNoLabel, nil),
        ("medium-long", LabNotes.mediumLong, 2), ("long", LabNotes.long, 3), ("long-nolabel", LabNotes.longNoLabel, nil), ("preview", LabNotes.preview, 2), ("nobyline", LabNotes.noByline, nil),
    ]
}
