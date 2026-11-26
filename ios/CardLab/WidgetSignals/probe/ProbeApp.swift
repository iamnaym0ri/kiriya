import SwiftUI
import CoreText
@main
struct ProbeApp: App {
    init() {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-out"), i + 1 < args.count {
            let out = args[i + 1]
            for path in ["/Library/Developer/CoreSimulator/Volumes/iOS_23D8133/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 26.3.simruntime/Contents/Resources/RuntimeRoot/System/Library/Fonts/CoreAddition/AppleColorEmoji-160px.ttc", "/System/Library/Fonts/Apple Color Emoji.ttc"] {
                var err: Unmanaged<CFError>?
                let ok = CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: path) as CFURL, .process, &err)
                print("register", path, ok, FileManager.default.fileExists(atPath: path), err?.takeRetainedValue().localizedDescription ?? "")
                let descs = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: path) as CFURL) as? [CTFontDescriptor] ?? []
                print("descriptors", descs.count, descs.first.map { CTFontDescriptorCopyAttribute($0, kCTFontNameAttribute) as? String ?? "?" } ?? "none")
                if let d = descs.first, probeEmojiFont == nil { probeEmojiFont = CTFontCreateWithFontDescriptor(d, 28, nil) }
            }
            DispatchQueue.main.async { runProbe(out: out); exit(0) }
        }
    }
    var body: some Scene { WindowGroup { Text("probe") } }
}
