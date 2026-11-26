import AppKit
import SwiftUI

// macOS renderer for the Signals widget lab (macOS has Apple Color Emoji; the iOS 26 simulator runtime doesn't).
//   signalslab stills <out>            every family × state × appearance, iPhone 11 @2x and 6.7" @3x, plus sheets
//   signalslab scene <out> <id-prefix> one scene set (debug)

let args = CommandLine.arguments
let here = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
SignalsWidgetFonts.searchDirectories = [here.appendingPathComponent("../../App/KiriyaWidgets/Signals/Fonts").standardized]
SignalsWidgetSender.isLab = true

func save(_ image: CGImage, _ path: String) {
    let rep = NSBitmapImageRep(cgImage: image)
    try? FileManager.default.createDirectory(atPath: (path as NSString).deletingLastPathComponent, withIntermediateDirectories: true)
    try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
}

@MainActor
func sheet(_ title: String, _ items: [(String, CGImage, CGFloat)], columns: Int, dark: Bool = false, scale: CGFloat = 2) -> CGImage? {
    let renderer = ImageRenderer(content: LabSheet(title: title, items: items, columns: columns, dark: dark))
    renderer.scale = scale
    return renderer.cgImage
}

@MainActor
func run() {
    guard args.count >= 3 else { print("usage: signalslab stills|scene <out> …"); return }
    let mode = args[1], out = args[2]
    switch mode {
    case "stills":
        for device in [LabDevice.iPhone11, LabDevice.pro67] {
            for appearance in [LabAppearance.light, .dark, .tinted, .standby] {
                var items: [(String, CGImage, CGFloat)] = []
                for scene in LabScenes.states(appearance) {
                    if appearance == .standby && scene.family != .small { continue }
                    guard let image = LabRender.widget(scene, device: device) else { continue }
                    save(image, "\(out)/\(device.name)/\(appearance.rawValue)/\(scene.id).png")
                    items.append((scene.id, image, device.scale))
                }
                if let s = sheet("\(device.name) · \(appearance.rawValue)", items, columns: 4, dark: appearance != .light, scale: 1) {
                    save(s, "\(out)/sheets/\(device.name)-\(appearance.rawValue).png")
                }
            }
            var lock: [(String, CGImage, CGFloat)] = []
            for scene in LabScenes.lockScreen + [LabScene(id: "standby-night-small4", family: .small, entry: LabScenes.entry(), appearance: .standbyNight)] {
                guard let image = LabRender.widget(scene, device: device) else { continue }
                save(image, "\(out)/\(device.name)/lock/\(scene.id).png")
                lock.append((scene.id, image, device.scale))
            }
            if let s = sheet("\(device.name) · Lock Screen + StandBy night", lock, columns: 4, dark: true, scale: 1) { save(s, "\(out)/sheets/\(device.name)-lock.png") }
            var extra: [(String, CGImage, CGFloat)] = []
            for scene in LabScenes.extras {
                guard let image = LabRender.widget(scene, device: device) else { continue }
                save(image, "\(out)/\(device.name)/extras/\(scene.id).png")
                extra.append((scene.id, image, device.scale))
            }
            if let s = sheet("\(device.name) · more states", extra, columns: 4, scale: 1) { save(s, "\(out)/sheets/\(device.name)-extras.png") }
        }
        print("stills →", out)
    case "scene":
        let prefix = args.count > 3 ? args[3] : ""
        let appearance = LabAppearance(rawValue: args.count > 4 ? args[4] : "light") ?? .light
        for scene in LabScenes.states(appearance) + LabScenes.extras + LabScenes.lockScreen where scene.id.hasPrefix(prefix) {
            var scene = scene
            if scene.appearance != .lock { scene.appearance = appearance }
            if let image = LabRender.widget(scene, device: .iPhone11) { save(image, "\(out)/\(scene.id)-\(appearance.rawValue).png") }
        }
        print("scene →", out)
    case "overview":
        let d = LabDevice.iPhone11
        func shot(_ scene: LabScene) -> LabOverview.Item? {
            LabRender.widget(scene, device: d).map { LabOverview.Item(caption: "", image: $0, scale: d.scale) }
        }
        func item(_ caption: String, _ scene: LabScene) -> LabOverview.Item? {
            shot(scene).map { var i = $0; i.caption = caption; return i }
        }
        let e = LabScenes.entry
        let rows: [(String, [LabOverview.Item?])] = [
            ("Home Screen · small (she picks four, two or one in Edit Widget) and medium", [
                item("small · four", LabScene(id: "a", family: .small, entry: e(.four, SignalsWidgetSignal.defaults, nil, true))),
                item("small · two", LabScene(id: "b", family: .small, entry: e(.two, [.morning, .night], nil, true))),
                item("small · one big one", LabScene(id: "c", family: .small, entry: e(.one, [.hug], nil, true))),
                item("medium", LabScene(id: "d", family: .medium, entry: e(.four, SignalsWidgetSignal.defaults, nil, true))),
            ]),
            ("Large: all seven · tapping (sending…) · just sent · dark mode", [
                item("large", LabScene(id: "e", family: .large, entry: e(.four, SignalsWidgetSignal.defaults, nil, true))),
                item("sending… (the instant she taps)", LabScene(id: "f", family: .large, entry: e(.four, SignalsWidgetSignal.defaults, nil, true), sending: .hug)),
                item("sent ♡ (hearts pop out and float up)", LabScene(id: "g", family: .large, entry: e(.four, SignalsWidgetSignal.defaults, LabMoments.sent(.hug), true))),
                item("dark mode", LabScene(id: "h", family: .large, entry: e(.four, SignalsWidgetSignal.defaults, nil, true), appearance: .dark)),
            ]),
            ("Tinted Home Screen · StandBy · didn't send · Lock Screen", [
                item("tinted (iOS 18+)", LabScene(id: "i", family: .medium, entry: e(.four, SignalsWidgetSignal.defaults, nil, true), appearance: .tinted)),
                item("StandBy", LabScene(id: "j", family: .small, entry: e(.four, SignalsWidgetSignal.defaults, nil, true), appearance: .standby)),
                item("offline: try again", LabScene(id: "k", family: .small, entry: e(.one, [.thinking], LabMoments.failed(.thinking, .offline), true))),
                item("Lock Screen", LabScene(id: "l", family: .rectangular, entry: e(.four, SignalsWidgetSignal.defaults, nil, true), appearance: .lock)),
                item("", LabScene(id: "m", family: .circular, entry: e(.four, [.hug], nil, true), appearance: .lock)),
            ]),
        ]
        let poster = LabOverview(rows: rows.map { ($0.0, $0.1.compactMap { $0 }) }, subtitle: "little signals for Kiriya, one tap to Josh ♡  (iPhone 11 sizes)")
        let renderer = ImageRenderer(content: poster)
        renderer.scale = 2
        if let image = renderer.cgImage { save(image, "\(out)/overview.png") }
        print("overview →", out)
    default:
        print("unknown mode", mode)
    }
}

MainActor.assumeIsolated { run() }
