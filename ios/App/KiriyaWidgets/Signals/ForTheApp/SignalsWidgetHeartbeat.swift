import AudioToolbox
import CoreHaptics
import Foundation

// App target only (not the widget): when one of his signals arrives while kiriya.love is open, she
// feels his heartbeat (SignalsWidget-heartbeat.ahap: lub-dub, lub-dub) and hears the signal's own
// sound, in step, instead of the system's standard buzz.
//
// Why only then: iOS gives a push notification its sound (aps.sound, which we choose) and the system's
// own alert vibration, which no app can change; Core Haptics stops when an app leaves the foreground.
// So in her pocket the sound is the signature, and in her hand the heartbeat matches its first beats.

final class SignalsWidgetHeartbeat {
    static let shared = SignalsWidgetHeartbeat()

    /// The seven signals (shared/taps.js keys); anything else plays the ♡ one.
    private static let keys: Set<String> = ["thinking", "hug", "kiss", "morning", "night", "miss", "water"]

    private var engine: CHHapticEngine?
    private var sounds: [String: SystemSoundID] = [:]
    private let queue = DispatchQueue(label: "love.kiriya.heartbeat")

    /// Plays the heartbeat and the signal's sound. Call on arrival while the app is in the foreground.
    func play(_ key: String?) {
        let key = key.flatMap { Self.keys.contains($0) ? $0 : nil } ?? "thinking"
        queue.async {
            self.playSound(key)
            self.playHaptic()
        }
    }

    /// A system sound: silent when the ring switch is on silent, never vibrates by itself.
    private func playSound(_ key: String) {
        if sounds[key] == nil,
           let url = Bundle.main.url(forResource: "SignalsWidget-\(key)", withExtension: "caf") {
            var id: SystemSoundID = 0
            if AudioServicesCreateSystemSoundID(url as CFURL, &id) == noErr { sounds[key] = id }
        }
        if let id = sounds[key] { AudioServicesPlaySystemSound(id) }
    }

    private func playHaptic() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics,
              let url = Bundle.main.url(forResource: "SignalsWidget-heartbeat", withExtension: "ahap") else { return }
        do {
            let engine = try self.engine ?? makeEngine()
            self.engine = engine
            try engine.start()
            try engine.playPattern(from: url)
        } catch {
            self.engine = nil
        }
    }

    private func makeEngine() throws -> CHHapticEngine {
        let engine = try CHHapticEngine()
        engine.playsHapticsOnly = true
        engine.isAutoShutdownEnabled = true
        // Stopped (backgrounded, interrupted) or reset: start fresh next time.
        engine.stoppedHandler = { [weak self] _ in self?.queue.async { self?.engine = nil } }
        engine.resetHandler = { [weak self] in self?.queue.async { self?.engine = nil } }
        return engine
    }
}
