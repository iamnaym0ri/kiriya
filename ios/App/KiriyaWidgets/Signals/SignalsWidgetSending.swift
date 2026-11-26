import Foundation
import WidgetKit

// What happens when she taps a signal: POST /api/widget/tap with the phone's widget key (the same
// request KiriyaAPI.sendTap makes, but reading the answer, so the widget can tell "sent", Josh's
// "test mode" and the server's own "that's a lot of love for one hour ♡" apart), then remember the
// outcome in the App Group for the timeline the system reloads straight after.

/// The last thing a tap did, as the widget shows it for a little while.
struct SignalsWidgetMoment: Codable, Hashable {
    enum Outcome: String, Codable { case sent, test, failed }
    enum Problem: String, Codable { case offline, notSetUp, locked, slowDown, server }

    var signal: SignalsWidgetSignal
    var at: Date
    var outcome: Outcome
    var problem: Problem?
    /// The server's own words, when it gave some (only shown for `slowDown`).
    var message: String?

    var isSent: Bool { outcome != .failed }

    /// How long the widget keeps showing it.
    var lasts: TimeInterval { isSent ? SignalsWidgetMoment.sentFor : SignalsWidgetMoment.failedFor }
    var endsAt: Date { at.addingTimeInterval(lasts) }

    static let sentFor: TimeInterval = 60
    static let failedFor: TimeInterval = 10 * 60
}

enum SignalsWidgetMemory {
    private static let key = "signalsWidget.moment"

    static func remember(_ moment: SignalsWidgetMoment) {
        guard let data = try? JSONEncoder().encode(moment) else { return }
        KiriyaGroup.defaults?.set(data, forKey: key)
    }

    /// The moment to show now, if one is still showing. A tap sent from elsewhere (a notification's
    /// "Send one back", Siri, the old intent) counts too: KiriyaStore.markTapSent records those.
    static func moment(now: Date = Date()) -> SignalsWidgetMoment? {
        var latest: SignalsWidgetMoment?
        if let data = KiriyaGroup.defaults?.data(forKey: key),
           let mine = try? JSONDecoder().decode(SignalsWidgetMoment.self, from: data) {
            latest = mine
        }
        if let at = KiriyaStore.lastTapDate(),
           let kind = KiriyaGroup.defaults?.string(forKey: KiriyaGroup.lastTapKind),
           let signal = SignalsWidgetSignal(rawValue: kind),
           at > (latest?.at ?? .distantPast).addingTimeInterval(1) {
            latest = SignalsWidgetMoment(signal: signal, at: at, outcome: .sent)
        }
        guard let moment = latest else { return nil }
        let age = now.timeIntervalSince(moment.at)
        return age >= -5 && age < moment.lasts ? moment : nil
    }
}

enum SignalsWidgetSendError: Error {
    case problem(SignalsWidgetMoment.Problem, String?)
}

enum SignalsWidgetSender {
    struct Answer { var test = false }

    /// The network call. The lab swaps in a stub, so nothing it does can reach kiriya.love.
    nonisolated(unsafe) static var transport: (SignalsWidgetSignal, String) async throws -> Answer = live

    private struct Reply: Decodable {
        var ok: Bool?
        var test: Bool?
        var error: String?
        var message: String?
    }

    static func live(_ signal: SignalsWidgetSignal, clientId: String) async throws -> Answer {
        guard let key = KiriyaAPI.key else { throw SignalsWidgetSendError.problem(.notSetUp, nil) }
        var request = URLRequest(url: KiriyaAPI.base.appendingPathComponent("api/widget/tap"),
                                 cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["kind": signal.rawValue, "clientId": clientId])
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            // No connection, timed out, or the host can't be reached: all "try again in a moment".
            throw SignalsWidgetSendError.problem(.offline, nil)
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let reply = try? JSONDecoder().decode(Reply.self, from: data)
        switch status {
        case 200..<300: return Answer(test: reply?.test == true)
        case 401: throw SignalsWidgetSendError.problem(.locked, nil)
        case 429: throw SignalsWidgetSendError.problem(.slowDown, reply?.message)
        default: throw SignalsWidgetSendError.problem(.server, nil)
        }
    }

    /// Sends one signal and remembers how it went. Never throws: the widget shows the outcome.
    @discardableResult
    static func send(_ signal: SignalsWidgetSignal, now: Date = Date()) async -> SignalsWidgetMoment {
        var moment = SignalsWidgetMoment(signal: signal, at: now, outcome: .failed)
        if !KiriyaAPI.isSetUp && !isLab {
            moment.problem = .notSetUp
        } else {
            // A fresh id per press: each tap is its own little message (the server dedupes retries of one).
            let clientId = KiriyaAPI.clientId("w", UUID().uuidString, signal.rawValue)
            do {
                let answer = try await transport(signal, clientId)
                moment.outcome = answer.test ? .test : .sent
                moment.at = Date()
                KiriyaStore.markTapSent(signal.rawValue, at: moment.at)
            } catch SignalsWidgetSendError.problem(let problem, let message) {
                moment.problem = problem
                moment.message = message.map { String($0.prefix(80)) }
            } catch {
                moment.problem = .server
            }
        }
        SignalsWidgetMemory.remember(moment)
        return moment
    }

    /// True in the render lab and the lab's own widget (stubbed network, no device key).
    nonisolated(unsafe) static var isLab = false
}
