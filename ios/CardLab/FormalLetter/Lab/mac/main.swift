import Foundation
import SwiftUI

// The lab's macOS runner: renders the formal letter with ImageRenderer (real colour emoji; the iOS
// 26.3 simulator runtime on this Mac ships without Apple Color Emoji) and pipes frames into ffmpeg.
//
//   formallab stills   <out>                         sealed + rest stills of every letter, 343 and 393, @3x
//   formallab frame    <out> <letter> <width> <t|sealed|sealed@idle|wiggle@s> [scale]
//   formallab sheet    <out> <letter> <width> [step] [from] [to]   contact sheet of the opening
//   formallab idle     <out> <letter> <width>        contact sheet + 30fps video of the idle loop
//   formallab video    <out> <letter> <width>        60fps MP4: 1s idle, the opening, 1.4s at rest
//   formallab gif      <out> <letter> <width>        the opening as a GIF (2x, 30fps)
//   formallab overview <out> <width>                 sealed + short + long + locked side by side
//   formallab edges    <out> <width>                 the awkward letters, sealed and open
//   formallab piece    <out> seal|flap|flapin|pocket|back|crest
//   formallab report   <letter> <width>              heights, paper, swap time

let ffmpeg = ProcessInfo.processInfo.environment["FFMPEG"] ?? "/Users/josh/kiriya/node_modules/@ffmpeg-installer/darwin-x64/ffmpeg"

@MainActor
func run() {
    var args = Array(CommandLine.arguments.dropFirst())
    let fontDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        .appendingPathComponent("../../../../App/KiriyaNotificationContent/FormalLetter/Fonts").standardized
    FormalLetterFonts.searchDirectories = [fontDir]
    FormalLetterFonts.loadIfNeeded()
    guard !args.isEmpty else { print("usage: see Lab/mac/main.swift"); return }
    let mode = args.removeFirst()
    let D = FormalLetterGeometry.duration

    func out(_ dir: String) -> String {
        try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        return dir
    }
    func letter(_ name: String) -> (FormalLetterContent, Bool) { (LabFixtures.named(name), LabFixtures.isLocked(name)) }

    switch mode {
    case "report":
        let (content, locked) = letter(args[0])
        let width = CGFloat(Double(args[1]) ?? 343)
        let g = LabRender.geometry(content, width: width, locked: locked)
        print("letter=\(args[0]) width=\(width) sealed=\(g.sealedHeight) open=\(g.openHeight) paper=\(g.paper.width)x\(g.paper.height) lines=\(g.paper.lines.count) scrolls=\(g.paper.scrolls) content=\(g.paper.scrollContentHeight) truncated=\(g.paper.truncated) env=\(g.env.width)x\(g.env.height) inside=\(String(format: "%.3f", g.insideScale)) envRest=\(String(format: "%.3f", g.envRestScale)) swap=\(String(format: "%.3f", g.swapTime)) locked=\(locked) fonts=\(FormalLetterFonts.isBundled(.text)) \(FormalLetterFonts.isBundled(.script))")

    case "speak":
        // What VoiceOver says, sealed and open: formallab speak <letter>
        let (content, locked) = letter(args[0])
        print("sealed: \(locked ? content.spokenLocked : "Open the letter (button) — hint: \(content.spokenEnvelope)")")
        if !locked { print("open: \(content.spokenLetter.prefix(600))") }

    case "stills":
        let dir = out(args[0])
        let only = args.count > 1 ? args[1] : nil
        for (name, content) in LabFixtures.all where only == nil || only == name {
            let locked = LabFixtures.isLocked(name)
            for width in [343.0, 393.0] {
                for (label, time) in [("sealed", nil), ("rest", D)] as [(String, Double?)] {
                    if locked && label == "rest" { continue }
                    if let image = LabRender.image(LabRender.scene(content, width: width, time: time, idle: 0, locked: locked), scale: 3) {
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
        var tallest: CGFloat = 0
        for (_, content) in LabFixtures.edges { tallest = max(tallest, LabRender.geometry(content, width: width, locked: false).openHeight) }
        for (name, content) in LabFixtures.edges {
            let g = LabRender.geometry(content, width: width, locked: false)
            for (label, time) in [("sealed", nil), ("rest", D)] as [(String, Double?)] {
                if let image = LabRender.image(LabRender.scene(content, width: width, time: time, idle: 0, height: tallest), scale: 1.5) {
                    frames.append(("\(name) \(label)", image))
                }
            }
            print("\(name): sealed=\(g.sealedHeight) open=\(g.openHeight) lines=\(g.paper.lines.count) truncated=\(g.paper.truncated)")
        }
        if let sheet = LabRender.sheet(frames, columns: 6) {
            LabRender.writePNG(sheet, to: "\(dir)/edges-\(Int(width)).png")
            print("\(dir)/edges-\(Int(width)).png")
        }

    case "piece":
        let dir = out(args[0])
        let m = FormalLetterEnvelopeMetrics(width: 300)
        let view: AnyView
        switch args[1] {
        case "seal": view = AnyView(HStack { FormalLetterWaxSeal(diameter: 120, piece: .whole); FormalLetterWaxSeal(diameter: 120, piece: .upper); FormalLetterWaxSeal(diameter: 120, piece: .lower) })
        case "flap": view = AnyView(FormalLetterFlapFace(m: m, inside: false))
        case "flapin": view = AnyView(FormalLetterFlapFace(m: m, inside: true))
        case "back": view = AnyView(FormalLetterEnvelopeBack(m: m))
        case "crest": view = AnyView(Canvas { ctx, _ in FormalLetterCrest.draw(ctx, center: CGPoint(x: 60, y: 50), height: 80); FormalLetterCrest.draw(ctx, center: CGPoint(x: 170, y: 50), height: 80, look: .embossed) }.frame(width: 230, height: 110).background(FormalLetterPalette.paper))
        default: view = AnyView(FormalLetterEnvelopePocket(m: m, primary: "open when you miss me", secondary: "for the far-away nights"))
        }
        if let image = LabRender.image(view.padding(10).background(Color(white: 0.92)), scale: 5) {
            LabRender.writePNG(image, to: "\(dir)/piece-\(args[1]).png")
            print("\(dir)/piece-\(args[1]).png")
        }

    case "frame":
        let dir = out(args[0])
        let (content, locked) = letter(args[1])
        let width = CGFloat(Double(args[2]) ?? 343)
        let spec = args[3]
        var time: Double?
        var idle = 0.0
        var wiggle: Double?
        if spec.hasPrefix("sealed") {
            idle = Double(spec.split(separator: "@").last.map(String.init) ?? "0") ?? 0
        } else if spec.hasPrefix("wiggle") {
            wiggle = Double(spec.split(separator: "@").last.map(String.init) ?? "0") ?? 0
        } else {
            time = Double(spec)
        }
        let scale = args.count > 4 ? CGFloat(Double(args[4]) ?? 3) : 3
        let g = LabRender.geometry(content, width: width, locked: locked)
        if let image = LabRender.image(LabRender.scene(content, width: width, time: time, idle: idle, wiggle: wiggle, locked: locked,
                                                       height: time == nil ? g.sealedHeight : g.openHeight), scale: scale) {
            let path = "\(dir)/\(args[1])-\(Int(width))-\(spec).png"
            LabRender.writePNG(image, to: path)
            print(path)
        }

    case "sheet":
        let dir = out(args[0])
        let (content, _) = letter(args[1])
        let width = CGFloat(Double(args[2]) ?? 343)
        let step = args.count > 3 ? Double(args[3]) ?? 0.1 : 0.1
        let from = args.count > 4 ? Double(args[4]) ?? 0 : 0
        let to = args.count > 5 ? Double(args[5]) ?? D : D
        let scale: CGFloat = args.count > 6 ? CGFloat(Double(args[6]) ?? 1) : 1
        let g = LabRender.geometry(content, width: width, locked: false)
        var frames: [(String, CGImage)] = []
        var t = from
        while t <= to + 1e-6 {
            if let image = LabRender.image(LabRender.scene(content, width: width, time: t, idle: 0, height: g.openHeight), scale: scale) {
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
        let (content, locked) = letter(args[1])
        let width = CGFloat(Double(args[2]) ?? 343)
        let g = LabRender.geometry(content, width: width, locked: locked)
        var frames: [(String, CGImage)] = []
        for i in 0..<16 {
            let idle = 1.6 + Double(i) * 0.14
            if let image = LabRender.image(LabRender.scene(content, width: width, time: nil, idle: idle, locked: locked), scale: 1) {
                frames.append((String(format: "idle %.2f", idle), image))
            }
        }
        if let sheet = LabRender.sheet(frames, columns: 8) {
            LabRender.writePNG(sheet, to: "\(dir)/idle-\(args[1])-\(Int(width)).png")
        }
        let scale: CGFloat = 2
        let w = Int(width * scale), h = Int(g.sealedHeight * scale) / 2 * 2
        encode(path: "\(dir)/idle-\(args[1])-\(Int(width)).mp4", width: w, height: h, fps: 30) { write in
            for f in 0..<(30 * 12) {
                let clock = Double(f) / 30
                // A locked letter: tapped at 3s and 8s.
                let wiggle: Double? = locked ? [3.0, 8.0].map { clock - $0 }.first { $0 >= 0 && $0 < 0.8 } : nil
                if let image = LabRender.image(LabRender.scene(content, width: width, time: nil, idle: clock, wiggle: wiggle, locked: locked), scale: scale) {
                    write(LabRender.rgba(image, width: w, height: h))
                }
            }
        }

    case "video", "gif":
        let dir = out(args[0])
        let (content, _) = letter(args[1])
        let width = CGFloat(Double(args[2]) ?? 343)
        let g = LabRender.geometry(content, width: width, locked: false)
        let gif = mode == "gif"
        let scale: CGFloat = 2
        let w = Int(width * scale), h = Int(g.openHeight * scale) / 2 * 2
        let fps = gif ? 30.0 : 60.0
        let lead = 1.0, hold = gif ? 2.2 : 1.4
        let mp4 = "\(dir)/open-\(args[1])-\(Int(width))\(gif ? "-gifsrc" : "").mp4"
        // The sealed card first (as tall as the sealed card, like the real host), then the open card.
        encode(path: mp4, width: w, height: h, fps: Int(fps)) { write in
            var f = 0
            while Double(f) / fps < lead + D + hold {
                let clock = Double(f) / fps
                let view = clock < lead
                    ? LabRender.scene(content, width: width, time: nil, idle: clock + 1.0, height: g.openHeight)
                    : LabRender.scene(content, width: width, time: clock - lead, idle: lead + 1.0, height: g.openHeight)
                if let image = LabRender.image(view, scale: scale) { write(LabRender.rgba(image, width: w, height: h)) }
                f += 1
            }
        }
        if gif {
            let out = "\(dir)/open-\(args[1])-\(Int(width)).gif"
            let process = Process()
            process.executableURL = URL(fileURLWithPath: ffmpeg)
            let gw = Int(width * 1.5)
            process.arguments = ["-y", "-loglevel", "error", "-i", mp4, "-filter_complex",
                                 "fps=30,scale=\(gw):-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a",
                                 "-loop", "0", out]
            try? process.run()
            process.waitUntilExit()
            try? FileManager.default.removeItem(atPath: mp4)
            print(out)
        }

    case "overview":
        let dir = out(args[0])
        let width = CGFloat(Double(args.count > 1 ? args[1] : "343") ?? 343)
        let picks: [(String, String, Double?)] = [("medium", "sealed", nil), ("short", "short, open", D), ("long", "long (scrolls), open", D), ("locked", "locked", nil)]
        var frames: [(String, CGImage)] = []
        for (name, label, time) in picks {
            let (content, locked) = letter(name)
            if let image = LabRender.image(LabRender.scene(content, width: width, time: time, idle: 0, locked: locked), scale: 2) {
                frames.append((label, image))
            }
        }
        if let sheet = LabRender.sheet(frames, columns: frames.count, gap: 24, background: CGColor(red: 0.96, green: 0.93, blue: 0.98, alpha: 1)) {
            LabRender.writePNG(sheet, to: "\(dir)/overview-\(Int(width)).png")
            print("\(dir)/overview-\(Int(width)).png")
        }

    default:
        print("unknown mode \(mode)")
    }
}

func encode(path: String, width: Int, height: Int, fps: Int, frames: ((Data) -> Void) -> Void) {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: ffmpeg)
    process.arguments = ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", "\(width)x\(height)", "-r", "\(fps)",
                         "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path]
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
