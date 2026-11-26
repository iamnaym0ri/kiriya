import Foundation

// Plain checks of the model (run with the renders: `./sim.sh render …` prints them): Singapore days,
// the countdown at the boundaries, the forgiving decoder with old, new and broken snapshots, the
// timeline's dates and the words.

enum ConLabChecks {
    nonisolated(unsafe) static var failures = 0

    static func check(_ ok: Bool, _ what: String) {
        if !ok { failures += 1 }
        print("\(ok ? "PASS" : "FAIL")  \(what)")
    }

    static func run() {
        let saved = ConWidgetDay.utcOffset
        ConWidgetDay.utcOffset = 8 * 3600
        defer { ConWidgetDay.utcOffset = saved }

        // Days.
        let afaDay = ConWidgetDay("2026-11-27")!
        check(ConWidgetWords.weekday(afaDay) == "Fri", "27 Nov 2026 is a Friday")
        check(afaDay.civil == (2026, 11, 27), "civil round trip")
        check(ConWidgetDay("2026-02-31") == nil && ConWidgetDay("nope") == nil && ConWidgetDay(nil) == nil, "bad days are rejected")
        check(ConWidgetDay("2026-11-27T00:00:00Z") == afaDay, "a timestamp's date part is read")
        check(ConWidgetDay(containing: ConLab.sgt("2026-11-26 23:59:59")) == afaDay.adding(-1), "23:59:59 SGT is still the day before")
        check(ConWidgetDay(containing: ConLab.sgt("2026-11-27 00:00")) == afaDay, "00:00 SGT is the new day")
        check(afaDay.start == ISO8601DateFormatter().date(from: "2026-11-26T16:00:00Z"), "a day starts at 16:00 UTC the day before")
        check(ConWidgetDay("2027-01-01")!.adding(-1) == ConWidgetDay("2026-12-31"), "year boundary")

        // The countdown.
        let season = ConLab.season
        func countdown(_ at: String) -> ConWidgetCountdown? { ConWidgetMoment(events: season, at: ConLab.sgt(at)).countdown }
        check(countdown("2026-11-23 23:59") == .days(4), "4 days out")
        check(countdown("2026-11-24 12:00") == .days(3), "3 days out is still a day count")
        check(countdown("2026-11-25 00:00") == .hours(days: 2, until: afaDay.start), "48 h out: the clock starts")
        check(countdown("2026-11-26 14:18") == .hours(days: 1, until: afaDay.start), "tomorrow: the clock")
        check(countdown("2026-11-27 00:00") == .today(doors: nil), "midnight: today")
        check(countdown("2026-11-28 09:00") == .on(day: 2, of: 3), "day 2 of 3")
        let last = ConWidgetMoment(events: season, at: ConLab.sgt("2026-11-29 20:00"))
        check(last.countdown == .on(day: 3, of: 3) && last.isLastDay, "last day")
        let after = ConWidgetMoment(events: season, at: ConLab.sgt("2026-11-30 00:00"))
        check(after.event?.id == ConLab.sgcc.id && after.justEnded?.id == ConLab.afa.id, "the day after: SGCC next, AFA was lovely")
        let twoDaysAfter = ConWidgetMoment(events: season, at: ConLab.sgt("2026-12-01 00:00"))
        check(twoDaysAfter.justEnded == nil, "the ribbon lasts one day")
        check(ConWidgetMoment(events: [], at: Date()).event == nil, "nothing booked")
        let doors = ConLab.scenario("doors")!.moment
        check(doors.countdown == .today(doors: ConLab.sgt("2026-11-27 11:00")), "doors time ahead today")
        let doorsLater = ConWidgetMoment(events: ConLab.scenario("doors")!.events, at: ConLab.sgt("2026-11-27 11:00"))
        check(doorsLater.countdown == .today(doors: nil), "doors open: plain today")

        // Overlap: AFA on, SJ60 starting the same weekend.
        let overlap = ConWidgetMoment(events: season, at: ConLab.sgt("2026-11-28 10:00"))
        check(overlap.event?.id == ConLab.afa.id && overlap.later.first?.id == ConLab.sj60.id, "overlap: AFA in the spotlight, SJ60 first in the programme")

        // Decoding.
        let old = #"{"nextEvent":{"title":"AFA Singapore","startsOn":"2026-11-27","daysAway":10,"venue":"Suntec"},"links":{"events":"kiriyalove://open/world#events"}}"#
        let oldFeed = ConWidgetFeed(snapshotJSON: Data(old.utf8), now: ConLab.sgt("2026-11-17 10:00"))
        check(oldFeed?.events.count == 1 && oldFeed?.events.first?.dayCount == 1 && oldFeed?.events.first?.title == "AFA Singapore", "today's server: nextEvent only")
        let new = #"""
        {"nextEvent":{"id":"afa-singapore:2026","title":"AFA Singapore","startsOn":"2026-11-27","endsOn":"2026-11-29","daysAway":-1,"venue":"Suntec Singapore Convention & Exhibition Centre","city":"Singapore","tags":["anime","cosplay",3],"hers":true,"url":"https://animefestival.asia/afasg26/","link":"kiriyalove://open/world?event=afa-singapore%3A2026#events"},
         "events":[{"id":"ended:2026","title":"Yesterday","startsOn":"2026-11-25","endsOn":"2026-11-27"},
                   {"id":"afa-singapore:2026","title":"AFA Singapore","startsOn":"2026-11-27","endsOn":"2026-11-29","hers":true,"link":"kiriyalove://open/world?event=afa-singapore%3A2026#events"},
                   {"id":"broken","title":42,"startsOn":"soon"},
                   "not even an object",
                   {"id":"sgcc:2026","name":"Singapore Comic Con","startsOn":"2026-12-04","endsOn":"2026-12-06","hers":"yes","link":"https://evil.example/x"}],
         "links":{"events":"kiriyalove://open/world#events"},"somethingNew":{"a":1}}
        """#
        let feed = ConWidgetFeed(snapshotJSON: Data(new.utf8), now: ConLab.sgt("2026-11-28 10:00"))
        check(feed?.events.map(\.id) == ["ended:2026", "afa-singapore:2026", "sgcc:2026"], "new server: the list, broken items skipped, nextEvent deduplicated")
        check(feed?.events[1].hers == true && feed?.events[1].link?.absoluteString.hasPrefix("kiriyalove://") == true, "her pick and its own link")
        check(feed?.events[2].link == nil && feed?.events[2].hers == false && feed?.events[2].title == "Singapore Comic Con", "a non-app link and a wrong-typed flag are dropped; 'name' is read")
        check(ConWidgetFeed(snapshotJSON: Data("[]".utf8)) == nil && ConWidgetFeed(snapshotJSON: Data("{}".utf8))?.events.isEmpty == true, "garbage in, nothing out")

        // Timeline.
        let near = ConWidgetFeed(events: season)
        let dates = ConWidgetTimeline.dates(for: near, from: ConLab.sgt("2026-11-26 14:18"), ringHours: false)
        check(dates.count == 15 && dates[1] == afaDay.start, "entries: now and 14 Singapore midnights")
        let ring = ConWidgetTimeline.dates(for: near, from: ConLab.sgt("2026-11-26 14:18"), ringHours: true)
        check(ring.count > dates.count && ring.contains(afaDay.start.addingTimeInterval(-3600)), "the ring adds hours in the last 48")

        // Words.
        check(ConWidgetWords.shortVenue("Hall 405, Suntec Singapore Convention & Exhibition Centre") == "Suntec · Hall 405", "Suntec · Hall 405")
        check(ConWidgetWords.shortVenue("Marina Bay Sands Expo & Convention Centre") == "Marina Bay Sands", "Marina Bay Sands")
        check(ConWidgetWords.shortVenue("L1 Atrium, City Square Mall") == "City Square Mall · L1 atrium", "City Square Mall · L1 atrium")
        check(ConWidgetWords.shortVenue("Fever Exhibition Hall, 25 Scotts Road, Singapore 228220") == "Fever Exhibition Hall", "Fever Exhibition Hall")
        check(ConWidgetWords.shortVenue("Some New Hall, Somewhere") == "Some New Hall", "an unknown venue keeps its first part")
        check(ConWidgetWords.shortRange(ConLab.afa) == "27–29 Nov" && ConWidgetWords.longRange(ConLab.afa) == "Fri 27 – Sun 29 Nov", "AFA's dates")
        check(ConWidgetWords.longRange(ConLab.apothecary) == "30 Sep – 1 Nov", "an exhibition's dates")
        check(ConWidgetWords.shortTitle(ConLab.afa, max: 12) == "AFA" && ConWidgetWords.shortTitle(ConLab.sgcc, max: 12) == nil, "short names")

        print(failures == 0 ? "ALL CHECKS PASS" : "\(failures) CHECK(S) FAILED")
    }
}
