import CoreText
import SwiftUI
import UIKit

// The lab's host app on the "Kiriya Signals Widget Lab" simulator. It carries the lab widget extension
// (Lab/widget) and has three modes:
//   (no args)            a plain screen, so the extension is installed and the widgets can be added
//   -render <dir>        iOS ImageRenderer parity frames of the main scenes (compare with the macOS ones)
//   -live <family>       the widget face at its real size, cycling idle → sending → sent → idle with the
//                        same transitions the widget uses (recorded for the GIF when the Home Screen can't be)

@main
struct SignalsLabApp: App {
    init() {
        SignalsLabHost.prepare()
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-render"), i + 1 < args.count {
            let out = args[i + 1]
            DispatchQueue.main.async {
                SignalsLabHost.render(out)
                exit(0)
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-live"), i + 1 < args.count {
                SignalsLabLive(family: args[i + 1])
            } else {
                VStack(spacing: 12) {
                    Text("Signals Lab").font(.title.bold())
                    Text("Long-press the Home Screen → + → Signals Lab").foregroundStyle(.secondary)
                }
            }
        }
    }
}

enum SignalsLabHost {
    static func prepare() {
        SignalsWidgetSender.isLab = true
        SignalsWidgetFonts.loadIfNeeded()
        let path = "/Library/Developer/CoreSimulator/Volumes/iOS_23D8133/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 26.3.simruntime/Contents/Resources/RuntimeRoot/System/Library/Fonts/CoreAddition/AppleColorEmoji-160px.ttc"
        if let found = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: path) as CFURL) as? [CTFontDescriptor], let first = found.first {
            SignalsWidgetFonts.labEmoji = { size in Font(CTFontCreateWithFontDescriptor(first, size, nil)) }
        }
    }

    @MainActor
    static func render(_ out: String) {
        try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)
        let scenes = LabScenes.states(.light).filter { $0.id.hasSuffix("idle") || $0.id.hasSuffix("sent") }
            + LabScenes.states(.dark).filter { $0.id.hasSuffix("idle") }.map { var s = $0; s.id += "-dark"; return s }
            + LabScenes.lockScreen
        for scene in scenes {
            let started = CFAbsoluteTimeGetCurrent()
            guard let image = LabRender.widget(scene, device: .iPhone11) else { continue }
            let ms = (CFAbsoluteTimeGetCurrent() - started) * 1000
            if let data = UIImage(cgImage: image).pngData() {
                try? data.write(to: URL(fileURLWithPath: "\(out)/\(scene.id).png"))
            }
            print(String(format: "rendered %@ in %.0f ms", scene.id, ms))
        }
    }
}

/// The face cycling through a send, with the widget's own transitions, at its real size.
struct SignalsLabLive: View {
    let family: String
    @State private var entry = SignalsWidgetEntry.sample()
    @State private var sending: SignalsWidgetSignal?

    private var kind: SignalsWidgetFamily {
        switch family {
        case "medium": return .medium
        case "large": return .large
        default: return .small
        }
    }

    private var size: CGSize { LabDevice.iPhone11.size(kind) }
    private var hero: SignalsWidgetSignal { kind == .large ? .hug : .thinking }

    var body: some View {
        ZStack {
            LabWallpaper(dark: false).ignoresSafeArea()
            ZStack {
                SignalsWidgetLook().background
                SignalsWidgetFace(entry: entry, family: kind, look: SignalsWidgetLook(), labSending: sending)
            }
            .frame(width: size.width, height: size.height)
            .clipShape(RoundedRectangle(cornerRadius: LabDevice.iPhone11.radius, style: .continuous))
        }
        .task { await loop() }
    }

    private func loop() async {
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: 1_600_000_000)
            withAnimation(.easeOut(duration: 0.2)) { sending = hero }
            try? await Task.sleep(nanoseconds: 900_000_000)
            withAnimation(.smooth(duration: 0.5)) {
                sending = nil
                entry = .sample(moment: SignalsWidgetMoment(signal: hero, at: Date(), outcome: .sent))
            }
            try? await Task.sleep(nanoseconds: 3_200_000_000)
            withAnimation(.smooth(duration: 0.6)) { entry = .sample() }
        }
    }
}
