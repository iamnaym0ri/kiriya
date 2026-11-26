import AppKit
import CoreImage
import Foundation
import SwiftUI

// The little-note widget's render lab (macOS). Renders the widget's own views with ImageRenderer
// (real colour emoji; the iOS 26.3 simulator runtime here has none) on a Home Screen-like wallpaper,
// at iPhone 11 sizes (Josh's phone and hers) or a 6.7" phone, and draws the timeline transitions
// frame by frame with the same effects the system interpolates.
//
//   noteslab states   <out> [11|67]        every state × family × look, one PNG each
//   noteslab sheet    <out> [11|67]        contact sheets: one per look (light, dark, tinted, standby, lock)
//   noteslab overview <out>                one picture for Josh
//   noteslab edges    <out>                awkward notes (emoji only, Chinese, a URL, a long title…)
//   noteslab gif      <out> <small|medium|large> [11|67]   the update + peel, as a GIF (needs ffmpeg)
//   noteslab frame    <out> <small|medium|large> <seconds> one frame of that sequence

let ffmpeg = ProcessInfo.processInfo.environment["FFMPEG"] ?? "/Users/josh/kiriya/node_modules/@ffmpeg-installer/darwin-x64/ffmpeg"
let labNow = Date(timeIntervalSince1970: 1_795_000_000) // a fixed morning, so every render reads the same

// MARK: - Devices and looks

enum Device: String {
    case iPhone11 = "11", plus67 = "67"
    func size(_ size: NotesWidgetLook.Size) -> CGSize {
        switch (self, size) {
        case (.iPhone11, _): return NotesWidgetLook.iPhone11(size)
        case (.plus67, .small): return CGSize(width: 170, height: 170)
        case (.plus67, .medium): return CGSize(width: 364, height: 170)
        case (.plus67, .large): return CGSize(width: 364, height: 382)
        case (.plus67, .rectangular): return CGSize(width: 172, height: 76)
        }
    }
    var label: String { self == .iPhone11 ? "iPhone 11" : "6.7-inch" }
}

enum Appearance: String, CaseIterable {
    case light, dark, tinted, standby, lock
}

// MARK: - Drawing one widget as it sits on the Home Screen

struct Wallpaper: View {
    var appearance: Appearance
    var body: some View {
        switch appearance {
        case .light:
            LinearGradient(colors: [Color(red: 0.98, green: 0.86, blue: 0.91), Color(red: 0.84, green: 0.85, blue: 0.97), Color(red: 0.78, green: 0.9, blue: 0.95)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        case .dark:
            LinearGradient(colors: [Color(red: 0.11, green: 0.09, blue: 0.2), Color(red: 0.2, green: 0.13, blue: 0.27)], startPoint: .top, endPoint: .bottom)
        case .tinted:
            LinearGradient(colors: [Color(red: 0.16, green: 0.12, blue: 0.26), Color(red: 0.32, green: 0.2, blue: 0.4)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .standby:
            Color.black
        case .lock:
            LinearGradient(colors: [Color(red: 0.36, green: 0.27, blue: 0.5), Color(red: 0.6, green: 0.38, blue: 0.55)], startPoint: .top, endPoint: .bottom)
        }
    }
}

@MainActor
enum Lab {
    static let corner: CGFloat = 22

    static func look(_ size: NotesWidgetLook.Size, _ appearance: Appearance, _ device: Device) -> NotesWidgetLook {
        NotesWidgetLook(size: size, tinted: appearance == .tinted || appearance == .lock, dark: appearance == .dark,
                        background: appearance != .standby && appearance != .tinted, canvas: device.size(size))
    }

    /// The widget's own pixels (no wallpaper), as the system would get them from the extension.
    @ViewBuilder
    static func widget(_ entry: NotesWidgetEntry, _ look: NotesWidgetLook, appearance: Appearance, override: AnyView? = nil) -> some View {
        let content = override ?? AnyView(NotesWidgetCanvas(entry: entry, look: look))
        if look.size == .rectangular {
            content
                .foregroundStyle(.white)
                .environment(\.colorScheme, .dark)
                .frame(width: look.canvas.width, height: look.canvas.height)
        } else if appearance == .light || appearance == .dark {
            content
                .frame(width: look.canvas.width, height: look.canvas.height)
                .background(NotesWidgetDesk(dark: appearance == .dark))
                .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
                .environment(\.colorScheme, appearance == .dark ? .dark : .light)
        } else {
            content
                .frame(width: look.canvas.width, height: look.canvas.height)
                .environment(\.colorScheme, .dark)
        }
    }

    /// One widget on its wallpaper, with a label under it.
    static func tile(_ entry: NotesWidgetEntry, size: NotesWidgetLook.Size, appearance: Appearance, device: Device = .iPhone11,
                     label: String? = nil, padding: CGFloat = 18) -> some View {
        let look = look(size, appearance, device)
        return VStack(spacing: 8) {
            plate(entry, look: look, appearance: appearance)
                .padding(padding)
                .background(Wallpaper(appearance: appearance))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            if let label {
                Text(label).font(.system(size: 11, weight: .medium)).foregroundStyle(Color(white: 0.32))
            }
        }
    }

    /// The widget as the Home Screen shows it: tinted/clear looks keep only opacity (white on a
    /// dark glass plate), StandBy drops the background, the Lock Screen draws white.
    @ViewBuilder
    static func plate(_ entry: NotesWidgetEntry, look: NotesWidgetLook, appearance: Appearance, override: AnyView? = nil) -> some View {
        switch appearance {
        case .tinted:
            ZStack {
                RoundedRectangle(cornerRadius: corner, style: .continuous).fill(Color(red: 0.2, green: 0.15, blue: 0.3).opacity(0.78))
                RoundedRectangle(cornerRadius: corner, style: .continuous).stroke(Color.white.opacity(0.12), lineWidth: 1)
                if let image = alphaOnly(widget(entry, look, appearance: appearance, override: override), size: look.canvas, tint: CIColor(red: 0.93, green: 0.88, blue: 1)) {
                    Image(decorative: image, scale: 2).resizable().frame(width: look.canvas.width, height: look.canvas.height)
                }
            }
            .frame(width: look.canvas.width, height: look.canvas.height)
        case .lock:
            ZStack {
                if let image = alphaOnly(widget(entry, look, appearance: appearance, override: override), size: look.canvas, tint: CIColor(red: 1, green: 1, blue: 1)) {
                    Image(decorative: image, scale: 2).resizable().frame(width: look.canvas.width, height: look.canvas.height)
                }
            }
            .frame(width: look.canvas.width, height: look.canvas.height)
        default:
            widget(entry, look, appearance: appearance, override: override)
        }
    }

    /// Keeps each pixel's opacity and replaces its colour (what accented / vibrant rendering does).
    static func alphaOnly<V: View>(_ view: V, size: CGSize, tint: CIColor) -> CGImage? {
        let renderer = ImageRenderer(content: view)
        renderer.scale = 2
        guard let cg = renderer.cgImage else { return nil }
        let input = CIImage(cgImage: cg)
        let filter = CIFilter(name: "CIColorMatrix")!
        filter.setValue(input, forKey: kCIInputImageKey)
        filter.setValue(CIVector(x: 0, y: 0, z: 0, w: 0), forKey: "inputRVector")
        filter.setValue(CIVector(x: 0, y: 0, z: 0, w: 0), forKey: "inputGVector")
        filter.setValue(CIVector(x: 0, y: 0, z: 0, w: 0), forKey: "inputBVector")
        filter.setValue(CIVector(x: 0, y: 0, z: 0, w: 1), forKey: "inputAVector")
        filter.setValue(CIVector(x: tint.red, y: tint.green, z: tint.blue, w: 0), forKey: "inputBiasVector")
        guard let out = filter.outputImage else { return nil }
        // Premultiply again so transparent pixels stay transparent.
        let premultiplied = out.premultiplyingAlpha()
        return CIContext().createCGImage(premultiplied, from: input.extent)
    }

    static func render<V: View>(_ view: V, scale: CGFloat = 2) -> CGImage? {
        let renderer = ImageRenderer(content: view)
        renderer.scale = scale
        return renderer.cgImage
    }

    static func write(_ image: CGImage?, _ path: String) {
        guard let image else { print("render failed: \(path)"); return }
        let rep = NSBitmapImageRep(cgImage: image)
        try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
    }
}

// MARK: - States

let allStates: [(String, NotesWidgetSamples.Kind)] = [
    ("sealed", .sealed), ("open", .open), ("short", .short), ("title", .title), ("long", .long), ("letter", .letter),
    ("empty", .empty), ("setup", .notSetUp), ("sent-opened", .sentOpened), ("sent-waiting", .sentWaiting),
    ("sent-loved", .sentLoved), ("empty-admin", .emptyAdmin),
]
let homeSizes: [(String, NotesWidgetLook.Size)] = [("small", .small), ("medium", .medium), ("large", .large)]

func entry(_ kind: NotesWidgetSamples.Kind) -> NotesWidgetEntry { NotesWidgetSamples.entry(kind, date: labNow) }

@MainActor
func run() {
    var args = Array(CommandLine.arguments.dropFirst())
    let fonts = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        .appendingPathComponent("../../../../App/KiriyaWidgets/Notes/Fonts").standardized
    NotesWidgetFonts.searchDirectories = [fonts]
    NotesWidgetFonts.registerIfNeeded()
    guard !args.isEmpty else { print("usage: see Lab/mac/main.swift"); return }
    let mode = args.removeFirst()
    func dir(_ path: String) -> String {
        try? FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
        return path
    }
    print("fonts bundled: hand=\(NotesWidgetFonts.isBundled(.hand)) bold=\(NotesWidgetFonts.isBundled(.handBold)) script=\(NotesWidgetFonts.isBundled(.script))")

    switch mode {
    case "states":
        let out = dir(args[0])
        let device = Device(rawValue: args.count > 1 ? args[1] : "11") ?? .iPhone11
        for (name, kind) in allStates {
            for (sizeName, size) in homeSizes {
                for appearance in [Appearance.light, .dark, .tinted] {
                    Lab.write(Lab.render(Lab.tile(entry(kind), size: size, appearance: appearance, device: device)),
                              "\(out)/\(device.rawValue)-\(sizeName)-\(name)-\(appearance.rawValue).png")
                }
            }
            Lab.write(Lab.render(Lab.tile(entry(kind), size: .small, appearance: .standby, device: device)),
                      "\(out)/\(device.rawValue)-small-\(name)-standby.png")
            Lab.write(Lab.render(Lab.tile(entry(kind), size: .rectangular, appearance: .lock, device: device)),
                      "\(out)/\(device.rawValue)-lock-\(name).png")
        }
        print("states → \(out)")

    case "sheet":
        let out = dir(args[0])
        let device = Device(rawValue: args.count > 1 ? args[1] : "11") ?? .iPhone11
        for appearance in [Appearance.light, .dark, .tinted] {
            let view = VStack(alignment: .leading, spacing: 14) {
                Text("Little note · \(appearance.rawValue) · \(device.label)").font(.system(size: 16, weight: .semibold))
                ForEach(Array(allStates.enumerated()), id: \.offset) { _, state in
                    HStack(alignment: .top, spacing: 12) {
                        ForEach(Array(homeSizes.enumerated()), id: \.offset) { _, size in
                            Lab.tile(entry(state.1), size: size.1, appearance: appearance, device: device, label: "\(size.0) · \(state.0)", padding: 12)
                        }
                    }
                }
            }
            .padding(20)
            .background(Color(white: 0.96))
            Lab.write(Lab.render(view, scale: 1.5), "\(out)/sheet-\(device.rawValue)-\(appearance.rawValue).png")
        }
        // StandBy (small, scaled up as StandBy shows it) and the Lock Screen.
        let extra = VStack(alignment: .leading, spacing: 14) {
            Text("StandBy (small) and Lock Screen (rectangular) · \(device.label)").font(.system(size: 16, weight: .semibold))
            HStack(alignment: .top, spacing: 12) {
                ForEach(Array(allStates.prefix(6).enumerated()), id: \.offset) { _, state in
                    Lab.tile(entry(state.1), size: .small, appearance: .standby, device: device, label: state.0, padding: 12)
                }
            }
            HStack(alignment: .top, spacing: 12) {
                ForEach(Array(allStates.enumerated()), id: \.offset) { _, state in
                    Lab.tile(entry(state.1), size: .rectangular, appearance: .lock, device: device, label: state.0, padding: 10)
                }
            }
        }
        .padding(20)
        .background(Color(white: 0.96))
        Lab.write(Lab.render(extra, scale: 1.5), "\(out)/sheet-\(device.rawValue)-standby-lock.png")
        print("sheets → \(out)")

    case "one":
        // noteslab one <out> <state> <size> <appearance> [device]
        let out = dir(args[0])
        let kind = allStates.first { $0.0 == args[1] }?.1 ?? .open
        let size = homeSizes.first { $0.0 == args[2] }?.1 ?? (args[2] == "lock" ? .rectangular : .medium)
        let appearance = Appearance(rawValue: args[3]) ?? .light
        let device = Device(rawValue: args.count > 4 ? args[4] : "11") ?? .iPhone11
        let path = "\(out)/one-\(args[1])-\(args[2])-\(args[3]).png"
        Lab.write(Lab.render(Lab.tile(entry(kind), size: size, appearance: appearance, device: device), scale: 3), path)
        print(path)

    case "overview":
        let out = dir(args[0])
        Lab.write(Lab.render(Overview(), scale: 2), "\(out)/overview.png")
        print("\(out)/overview.png")

    case "edges":
        let out = dir(args[0])
        let view = Edges()
        Lab.write(Lab.render(view, scale: 1.5), "\(out)/edges.png")
        print("\(out)/edges.png")

    case "gif", "frame":
        let out = dir(args[0])
        let size = homeSizes.first { $0.0 == args[1] }?.1 ?? .medium
        let device = Device(rawValue: mode == "gif" ? (args.count > 2 ? args[2] : "11") : (args.count > 3 ? args[3] : "11")) ?? .iPhone11
        let story = Story(size: size, device: device)
        if mode == "frame" {
            let t = Double(args[2]) ?? 0
            let path = "\(out)/frame-\(args[1])-\(String(format: "%.2f", t)).png"
            Lab.write(Lab.render(story.frame(at: t), scale: 2), path)
            print(path)
        } else {
            story.gif(to: "\(out)/update-\(args[1])-\(device.rawValue).gif", sheet: "\(out)/update-\(args[1])-\(device.rawValue)-sheet.png")
        }

    default:
        print("unknown mode \(mode)")
    }
}

// MARK: - The update, frame by frame: an old note → a new note passed in, sealed → tap → peeled open

@MainActor
struct Story {
    var size: NotesWidgetLook.Size
    var device: Device
    let fps = 30.0

    // The timeline: hold the old note, pass the new one in, hold, tap, peel, hold.
    let holdOld = 0.7
    let pass = 1.5
    let holdSealed = 1.2
    let tap = 0.35
    let peel = 1.5
    let holdOpen = 1.9
    var duration: Double { holdOld + pass + holdSealed + tap + peel + holdOpen }

    var look: NotesWidgetLook { NotesWidgetLook(size: size, canvas: device.size(size)) }

    var old: NotesWidgetEntry {
        let note = NotesWidgetNote(id: "0a0a0a0a-1111-4222-8333-944445555666", title: nil,
                                   text: "sweet dreams, see you in the morning 🌙", from: "Josh",
                                   at: labNow.addingTimeInterval(-11 * 3600), opened: true)
        return NotesWidgetEntry(date: labNow, scene: .open(note), me: "Kiriya", other: "Josh")
    }

    var new: NotesWidgetNote { NotesWidgetSamples.note(.title, date: labNow) }
    var sealedEntry: NotesWidgetEntry {
        var note = new
        note.opened = false
        note.at = labNow
        return NotesWidgetEntry(date: labNow, scene: .sealed(note), me: "Kiriya", other: "Josh")
    }
    var openEntry: NotesWidgetEntry {
        var note = new
        note.at = labNow
        return NotesWidgetEntry(date: labNow.addingTimeInterval(8), scene: .open(note), me: "Kiriya", other: "Josh")
    }

    func frame(at t: Double) -> some View {
        let palette = NotesWidgetPalette.make(look)
        let content: AnyView
        var ripple: (CGPoint, Double)?
        let passStart = holdOld
        let tapStart = holdOld + pass + holdSealed
        let peelStart = tapStart + tap
        if t < passStart {
            content = AnyView(NotesWidgetCanvas(entry: old, look: look))
        } else if t < tapStart {
            let p = CGFloat(NotesWidgetMotion.spring(t - passStart))
            let fade = min(1, max(0, Double(p)))
            let words = min(1, max(0, NotesWidgetMotion.spring(t - passStart - NotesWidgetMotion.deskDelay)))
            content = AnyView(ZStack(alignment: .topLeading) {
                NotesWidgetDeskDecor(look: look, scene: old.scene).opacity(1 - fade)
                NotesWidgetDeskDecor(look: look, scene: sealedEntry.scene).opacity(fade)
                NotesWidgetDeskWords(entry: sealedEntry, look: look, palette: palette).opacity(words)
                NotesWidgetSheet(entry: old, look: look, palette: palette)
                    .modifier(NotesWidgetPassOut(progress: p, distance: look.canvas.width))
                NotesWidgetSheet(entry: sealedEntry, look: look, palette: palette)
                    .modifier(NotesWidgetPassIn(progress: p, distance: look.canvas.width))
            }.frame(width: look.canvas.width, height: look.canvas.height, alignment: .topLeading))
        } else {
            let p = t < peelStart ? 0 : CGFloat(NotesWidgetMotion.spring(t - peelStart))
            let fade = min(1, max(0, Double(p)))
            let wordsGone = t < peelStart ? 0 : min(1, (t - peelStart) / 0.2)
            if t >= tapStart && t < peelStart + 0.25 {
                let g = NotesWidgetGeometry(look: look)
                ripple = (CGPoint(x: g.folded.midX, y: g.folded.minY + g.folded.height * g.flapDepth), (t - tapStart) / (tap + 0.25))
            }
            content = AnyView(ZStack(alignment: .topLeading) {
                NotesWidgetDeskDecor(look: look, scene: sealedEntry.scene).opacity(1 - fade)
                NotesWidgetDeskDecor(look: look, scene: openEntry.scene).opacity(fade)
                NotesWidgetDeskWords(entry: sealedEntry, look: look, palette: palette).opacity(1 - wordsGone)
                NotesWidgetSheet(entry: sealedEntry, look: look, palette: palette, labPeel: max(0, t - peelStart))
            }.frame(width: look.canvas.width, height: look.canvas.height, alignment: .topLeading))
        }
        return ZStack(alignment: .topLeading) {
            Lab.plate(old, look: look, appearance: .light, override: content)
            if let (point, k) = ripple {
                Circle()
                    .fill(Color.white.opacity(0.55 * (1 - k)))
                    .overlay(Circle().stroke(Color.white.opacity(0.9 * (1 - k)), lineWidth: 2))
                    .frame(width: 24 + 30 * k, height: 24 + 30 * k)
                    .position(point)
            }
        }
        .frame(width: look.canvas.width, height: look.canvas.height)
        .padding(16)
        .background(Wallpaper(appearance: .light))
    }

    func gif(to path: String, sheet: String) {
        let frames = FileManager.default.temporaryDirectory.appendingPathComponent("noteslab-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: frames, withIntermediateDirectories: true)
        let count = Int(duration * fps)
        var picks: [(String, CGImage)] = []
        for index in 0..<count {
            let t = Double(index) / fps
            guard let image = Lab.render(frame(at: t), scale: 2) else { continue }
            Lab.write(image, frames.appendingPathComponent(String(format: "f%04d.png", index)).path)
            if index % 6 == 0 && picks.count < 40 { picks.append((String(format: "%.1fs", t), image)) }
        }
        let palette = frames.appendingPathComponent("palette.png").path
        let input = frames.appendingPathComponent("f%04d.png").path
        shell([ffmpeg, "-y", "-loglevel", "error", "-framerate", "\(Int(fps))", "-i", input, "-vf", "palettegen=stats_mode=full:max_colors=256", palette])
        shell([ffmpeg, "-y", "-loglevel", "error", "-framerate", "\(Int(fps))", "-i", input, "-i", palette,
               "-lavfi", "paletteuse=dither=sierra2_4a", "-loop", "0", path])
        let mp4 = path.replacingOccurrences(of: ".gif", with: ".mp4")
        shell([ffmpeg, "-y", "-loglevel", "error", "-framerate", "\(Int(fps))", "-i", input, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", mp4])
        try? FileManager.default.removeItem(at: frames)
        // A contact sheet of every 6th frame, for reviewing the motion as stills.
        let columns = size == .medium ? 4 : 6
        let view = VStack(alignment: .leading, spacing: 6) {
            ForEach(0..<((picks.count + columns - 1) / columns), id: \.self) { row in
                HStack(spacing: 6) {
                    ForEach(0..<columns, id: \.self) { column in
                        let index = row * columns + column
                        if index < picks.count {
                            VStack(spacing: 2) {
                                Image(decorative: picks[index].1, scale: 2)
                                Text(picks[index].0).font(.system(size: 10)).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .padding(10)
        .background(Color.white)
        Lab.write(Lab.render(view, scale: 1), sheet)
        print(path)
        print(mp4)
        print(sheet)
    }
}

@discardableResult
func shell(_ command: [String]) -> Int32 {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: command[0])
    process.arguments = Array(command.dropFirst())
    try? process.run()
    process.waitUntilExit()
    return process.terminationStatus
}

// MARK: - The overview for Josh

struct Overview: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Little note widget").font(.system(size: 26, weight: .bold, design: .rounded))
                Text("A note passed to her and taped down. iPhone 11 sizes, light unless marked.").font(.system(size: 14)).foregroundStyle(.secondary)
            }
            row("A new note arrives: folded and taped shut (tap it to peel the tape and open it)", [
                AnyView(Lab.tile(entry(.sealed), size: .small, appearance: .light, label: "small")),
                AnyView(Lab.tile(entry(.sealed), size: .medium, appearance: .light, label: "medium")),
                AnyView(Lab.tile(entry(.sealed), size: .large, appearance: .light, label: "large")),
            ])
            row("Opened: the page, taped down", [
                AnyView(Lab.tile(entry(.short), size: .small, appearance: .light, label: "small · short note")),
                AnyView(Lab.tile(entry(.title), size: .medium, appearance: .light, label: "medium · with a title")),
                AnyView(Lab.tile(entry(.long), size: .large, appearance: .light, label: "large · a long note")),
            ])
            row("Night, tinted and StandBy", [
                AnyView(Lab.tile(entry(.title), size: .small, appearance: .dark, label: "dark")),
                AnyView(Lab.tile(entry(.sealed), size: .medium, appearance: .dark, label: "dark · sealed")),
                AnyView(Lab.tile(entry(.title), size: .small, appearance: .tinted, label: "tinted")),
                AnyView(Lab.tile(entry(.sealed), size: .small, appearance: .standby, label: "StandBy")),
            ])
            row("Lock Screen", [
                AnyView(Lab.tile(entry(.sealed), size: .rectangular, appearance: .lock, label: "a new note")),
                AnyView(Lab.tile(entry(.title), size: .rectangular, appearance: .lock, label: "opened")),
                AnyView(Lab.tile(entry(.sentOpened), size: .rectangular, appearance: .lock, label: "Josh's phone")),
            ])
            row("On Josh's phone: his last note to her, stamped once she opens it", [
                AnyView(Lab.tile(entry(.sentWaiting), size: .small, appearance: .light, label: "not opened yet")),
                AnyView(Lab.tile(entry(.sentOpened), size: .medium, appearance: .light, label: "she opened it ♡")),
                AnyView(Lab.tile(entry(.sentLoved), size: .small, appearance: .light, label: "she ♡'d it")),
            ])
            row("A letter came · nothing yet · tinted medium", [
                AnyView(Lab.tile(entry(.letter), size: .medium, appearance: .light, label: "a letter's announcement")),
                AnyView(Lab.tile(entry(.empty), size: .small, appearance: .light, label: "no notes yet")),
                AnyView(Lab.tile(entry(.title), size: .medium, appearance: .tinted, label: "tinted")),
            ])
        }
        .padding(28)
        .background(Color(white: 0.975))
    }

    func row(_ title: String, _ tiles: [AnyView]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.system(size: 15, weight: .semibold))
            HStack(alignment: .top, spacing: 14) {
                ForEach(Array(tiles.enumerated()), id: \.offset) { _, tile in tile }
            }
        }
    }
}

// MARK: - Awkward notes

struct Edges: View {
    static let cases: [(String, NotesWidgetNote)] = {
        func n(_ title: String?, _ text: String, truncated: Bool = false) -> NotesWidgetNote {
            NotesWidgetNote(id: UUID().uuidString, title: title, text: text, from: "Josh", at: labNow.addingTimeInterval(-300), opened: true, truncated: truncated)
        }
        return [
            ("emoji only", n(nil, "❤️❤️❤️🥺💌✨")),
            ("chinese", n("早安 ☀️", "早安！今天也要开心哦。我好想你，我们周末视频吧？晚安的时候记得告诉我你吃了什么 🍜")),
            ("a link", n(nil, "look at this https://kiriya.love/very/long/path/that/keeps/going/forever?with=params and tell me it isn't us")),
            ("long title", n("a very very long title that keeps on going and going", "short and sweet.")),
            ("accents/dashes", n("café date", "Saturday — you, me, the café near Tiong Bahru… and the pastry you love. Deal?")),
            ("push cut short", n("psst", "I wrote you something longer than a push can carry, so this is only the start of it", truncated: true)),
            ("1000 chars", n("everything", String(repeating: "you are my favourite person in every room and every city. ", count: 17))),
            ("one word", n(nil, "hi")),
        ]
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(Array(Self.cases.enumerated()), id: \.offset) { _, item in
                let e = NotesWidgetEntry(date: labNow, scene: .open(item.1), me: "Kiriya", other: "Josh")
                HStack(alignment: .top, spacing: 12) {
                    Lab.tile(e, size: .small, appearance: .light, label: item.0, padding: 10)
                    Lab.tile(e, size: .medium, appearance: .light, label: item.0, padding: 10)
                    Lab.tile(e, size: .large, appearance: .light, label: item.0, padding: 10)
                    Lab.tile(e, size: .rectangular, appearance: .lock, label: item.0, padding: 10)
                }
            }
        }
        .padding(20)
        .background(Color(white: 0.96))
    }
}

MainActor.assumeIsolated { run() }
