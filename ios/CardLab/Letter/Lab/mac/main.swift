import Foundation
import SwiftUI

// The lab's macOS runner: renders the letter card with ImageRenderer (real color emoji; the iOS 26.3
// simulator runtime on this Mac ships without Apple Color Emoji) and pipes frames into ffmpeg.
//
//   letterlab stills  <out>                          sealed + rest stills, every note, 343 and 393, @3x
//   letterlab frame   <out> <note> <width> <t|sealed> [scale]
//   letterlab sheet   <out> <note> <width> [step] [from] [to]   contact sheet of the opening
//   letterlab idle    <out> <note> <width>           contact sheet + 30fps video of the sealed idle loop
//   letterlab video   <out> <note> <width>           60fps MP4: 0.8s idle, the opening, 1.2s at rest
//   letterlab report  <note> <width>                 heights, folds, swap time

let ffmpeg = ProcessInfo.processInfo.environment["FFMPEG"] ?? "/Users/josh/kiriya/node_modules/@ffmpeg-installer/darwin-x64/ffmpeg"

@MainActor
func run() {
    var args = Array(CommandLine.arguments.dropFirst())
    let fontDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        .appendingPathComponent("../../../../App/KiriyaNotificationContent/Letter/Fonts").standardized
    LetterFonts.searchDirectories = [fontDir]
    LetterFonts.registerIfNeeded()
    guard !args.isEmpty else { print("usage: see Lab/mac/main.swift"); return }
    let mode = args.removeFirst()

    func out(_ dir: String) -> String {
        try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        return dir
    }

    switch mode {
    case "report":
        let content = LabFixtures.named(args[0])
        let width = CGFloat(Double(args[1]) ?? 343)
        let g = LetterGeometry.make(content: content, width: width)
        print("note=\(args[0]) width=\(width) sealed=\(g.sealedHeight) open=\(g.openHeight) paper=\(g.paper.width)x\(g.paper.height) folds=\(g.paper.folds) rows=\(g.paper.lines.count) truncated=\(g.paper.truncated) env=\(g.env.width)x\(g.env.height) inside=\(g.insideScale) swap=\(g.swapTime) bundledFonts=\(LetterFonts.isBundled(.hand))")

    case "stills":
        let dir = out(args[0])
        for (name, content) in LabFixtures.all {
            for width in [343.0, 393.0] {
                for (label, time) in [("sealed", nil), ("rest", LetterGeometry.duration)] as [(String, Double?)] {
                    if let image = LabRender.image(LabRender.scene(content, width: width, time: time, idle: 0), scale: 3) {
                        LabRender.writePNG(image, to: "\(dir)/\(name)-\(Int(width))-\(label).png")
                    }
                }
            }
        }
        print("stills → \(dir)")

    case "edges":
        let dir = out(args[0])
        let width = CGFloat(Double(args.count > 1 ? args[1] : "343") ?? 343)
        var frames: [(String, CGImage)] = []
        for (name, content) in LabFixtures.edges {
            let g = LetterGeometry.make(content: content, width: width)
            for (label, time) in [("sealed", nil), ("rest", LetterGeometry.duration)] as [(String, Double?)] {
                if let image = LabRender.image(LabRender.scene(content, width: width, time: time, idle: 0, height: g.openHeight), scale: 1.5) {
                    frames.append(("\(name) \(label)", image))
                }
            }
            print("\(name): sealed=\(g.sealedHeight) open=\(g.openHeight) rows=\(g.paper.lines.count) truncated=\(g.paper.truncated)")
        }
        if let sheet = LabRender.sheet(frames, columns: 6) {
            LabRender.writePNG(sheet, to: "\(dir)/edges-\(Int(width)).png")
        }

    case "piece":
        // One art piece on white, big: letterlab piece <out> loop|tail|seal|flap|pocket [width]
        let dir = out(args[0])
        let m = LetterEnvelopeMetrics(width: CGFloat(Double(args.count > 2 ? args[2] : "326") ?? 326))
        let view: AnyView
        switch args[1] {
        case "loop": view = AnyView(LetterBowLoop(m: m))
        case "tail": view = AnyView(LetterBowTail(m: m))
        case "seal": view = AnyView(LetterWaxSeal(size: m.sealSize))
        case "flap": view = AnyView(LetterFlapFace(m: m, inside: false))
        case "flapin": view = AnyView(LetterFlapFace(m: m, inside: true))
        default: view = AnyView(LetterEnvelopePocket(m: m))
        }
        if let image = LabRender.image(view.padding(10).background(Color.white), scale: 6) {
            LabRender.writePNG(image, to: "\(dir)/piece-\(args[1]).png")
            print("\(dir)/piece-\(args[1]).png")
        }

    case "frame":
        let dir = out(args[0])
        let content = LabFixtures.named(args[1])
        let width = CGFloat(Double(args[2]) ?? 343)
        // "sealed" or "sealed@<idle seconds>", else seconds into the opening.
        let sealed = args[3].hasPrefix("sealed")
        let time = sealed ? nil : Double(args[3])
        let idle = sealed ? Double(args[3].split(separator: "@").last.map(String.init) ?? "0") ?? 0 : 0
        let scale = args.count > 4 ? CGFloat(Double(args[4]) ?? 3) : 3
        if let image = LabRender.image(LabRender.scene(content, width: width, time: time, idle: idle), scale: scale) {
            let path = "\(dir)/\(args[1])-\(Int(width))-\(args[3]).png"
            LabRender.writePNG(image, to: path)
            print(path)
        }

    case "sheet":
        let dir = out(args[0])
        let content = LabFixtures.named(args[1])
        let width = CGFloat(Double(args[2]) ?? 343)
        let step = args.count > 3 ? Double(args[3]) ?? 0.1 : 0.1
        let from = args.count > 4 ? Double(args[4]) ?? 0 : 0
        let to = args.count > 5 ? Double(args[5]) ?? LetterGeometry.duration : LetterGeometry.duration
        let g = LetterGeometry.make(content: content, width: width)
        var frames: [(String, CGImage)] = []
        var t = from
        while t <= to + 1e-6 {
            if let image = LabRender.image(LabRender.scene(content, width: width, time: t, idle: 0, height: g.openHeight), scale: 1) {
                frames.append((String(format: "t=%.2f", t), image))
            }
            t += step
        }
        if let sheet = LabRender.sheet(frames, columns: min(8, frames.count)) {
            let path = "\(dir)/sheet-\(args[1])-\(Int(width))-\(String(format: "%.2f-%.2f", from, to)).png"
            LabRender.writePNG(sheet, to: path)
            print(path)
        }

    case "idle":
        let dir = out(args[0])
        let content = LabFixtures.named(args[1])
        let width = CGFloat(Double(args[2]) ?? 343)
        let g = LetterGeometry.make(content: content, width: width)
        var frames: [(String, CGImage)] = []
        for i in 0..<16 {
            let idle = Double(i) * 0.225
            if let image = LabRender.image(LabRender.scene(content, width: width, time: nil, idle: idle), scale: 1) {
                frames.append((String(format: "idle %.2f", idle), image))
            }
        }
        if let sheet = LabRender.sheet(frames, columns: 8) {
            LabRender.writePNG(sheet, to: "\(dir)/idle-\(args[1])-\(Int(width)).png")
        }
        let scale: CGFloat = 2
        let w = Int(width * scale), h = Int(g.sealedHeight * scale) / 2 * 2
        encode(path: "\(dir)/idle-\(args[1])-\(Int(width)).mp4", width: w, height: h, fps: 30) { write in
            for f in 0..<(30 * 8) {
                if let image = LabRender.image(LabRender.scene(content, width: width, time: nil, idle: Double(f) / 30), scale: scale) {
                    write(LabRender.rgba(image, width: w, height: h))
                }
            }
        }

    case "video":
        let dir = out(args[0])
        let content = LabFixtures.named(args[1])
        let width = CGFloat(Double(args[2]) ?? 343)
        let g = LetterGeometry.make(content: content, width: width)
        let scale: CGFloat = 2
        let w = Int(width * scale), h = Int(g.openHeight * scale) / 2 * 2
        let fps = 60.0
        let lead = 0.8, hold = 1.2
        let path = "\(dir)/open-\(args[1])-\(Int(width)).mp4"
        encode(path: path, width: w, height: h, fps: Int(fps)) { write in
            var f = 0
            while Double(f) / fps < lead + LetterGeometry.duration + hold {
                let clock = Double(f) / fps
                let view = clock < lead
                    ? LabRender.scene(content, width: width, time: nil, idle: clock + 1.0, height: g.openHeight)
                    : LabRender.scene(content, width: width, time: clock - lead, idle: lead + 1.0, height: g.openHeight)
                if let image = LabRender.image(view, scale: scale) { write(LabRender.rgba(image, width: w, height: h)) }
                f += 1
            }
        }

    default:
        print("unknown mode \(mode)")
    }
}

func encode(path: String, width: Int, height: Int, fps: Int, frames: (( Data) -> Void) -> Void) {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: ffmpeg)
    process.arguments = ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", "\(width)x\(height)", "-r", "\(fps)",
                         "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path]
    let pipe = Pipe()
    process.standardInput = pipe
    do { try process.run() } catch { print("ffmpeg failed: \(error)"); return }
    var count = 0
    frames { data in
        pipe.fileHandleForWriting.write(data)
        count += 1
    }
    try? pipe.fileHandleForWriting.close()
    process.waitUntilExit()
    print("\(path) (\(count) frames)")
}

MainActor.assumeIsolated { run() }
