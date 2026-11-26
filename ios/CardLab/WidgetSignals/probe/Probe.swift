import SwiftUI
import CoreText
#if canImport(UIKit)
import UIKit
#else
import AppKit
#endif

// Font probe: which kaomoji characters each candidate face covers, and how they look at widget sizes.
// Run on the lab simulator (iOS fonts) and on macOS; writes specimen PNGs + a coverage report.

let candidates: [(String, [String])] = [
    ("thinking", ["(˘︶˘)♡", "(˘ω˘)♡", "(◡‿◡)♡", "(˶˘ᵕ˘˶)", "(｡･ω･｡)♡", "(´ω`)♡", "(˘︶˘).｡*♡", "(*˘︶˘*)"]),
    ("hug", ["(っ´▽`)っ", "(っ´ω`)っ", "(っ˘̩╭╮˘̩)っ", "⊂(・▽・⊂)", "(つ≧▽≦)つ", "(っ◕‿◕)っ", "(づ￣ ³￣)づ", "(っ˘ω˘)っ"]),
    ("kiss", ["(˘ ³˘)♡", "( ˘ ³˘)♥", "(´ε` )♡", "(＾3＾)♡", "(*˘³˘)♡", "(っ˘з˘)っ♡", "(˘ε˘)♡"]),
    ("morning", ["(´▽`)ﾉ", "ヾ(＾∇＾)", "＼(＾▽＾)／", "\\(^▽^)/", "(＾▽＾)ノ", "ヽ(・∀・)ﾉ", "(◕ᴗ◕✿)", "o(≧▽≦)o"]),
    ("night", ["(－ω－)zZ", "(￣o￣)zzZ", "(˘ω˘)ｽﾔｧ", "(-_-)zzZ", "(｡-ω-)zzz", "(˘‿˘)zZ", "(_ _)zZ", "(∪｡∪)zZ"]),
    ("miss", ["(´・ω・`)", "(｡•́︿•̀｡)", "(｡•︿•｡)", "(｡╯︵╰｡)", "(っ- ‸ – ς)", "(´；ω；`)", "(｡>﹏<｡)", "(ᗒᗣᗕ)"]),
    ("water", ["(˘▽˘)っ旦", "( ˘ω˘)っ旦", "(^-^)っ旦", "(´∀`)っ旦", "( ´ ▽ ` )っ旦", "(˘ᵕ˘)っ旦"]),
]

nonisolated(unsafe) var probeEmojiFont: CTFont?
let faces = ["HiraMaruProN-W4", "HiraginoSans-W3", "HiraginoSans-W6", "Gaegu-Bold", ".SFUI-Regular"]

func coverage(_ text: String, _ fontName: String) -> [String] {
    let font = CTFontCreateWithName(fontName as CFString, 12, nil)
    let actual = CTFontCopyPostScriptName(font) as String
    var missing: [String] = []
    if actual != fontName && !fontName.hasPrefix(".") { missing.append("<face missing: \(actual)>") }
    for scalar in text.unicodeScalars {
        let utf16 = Array(String(scalar).utf16)
        var glyphs = [CGGlyph](repeating: 0, count: utf16.count)
        let ok = CTFontGetGlyphsForCharacters(font, utf16, &glyphs, utf16.count)
        if !ok || glyphs.contains(0) { missing.append(String(format: "U+%04X", scalar.value)) }
    }
    return missing
}

struct Specimen: View {
    let face: String
    let size: CGFloat
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(face) @ \(Int(size))pt").font(.system(size: 11, weight: .bold)).foregroundStyle(.gray)
            ForEach(candidates, id: \.0) { row in
                HStack(spacing: 14) {
                    Text(row.0).font(.system(size: 10)).frame(width: 52, alignment: .leading).foregroundStyle(.gray)
                    ForEach(row.1, id: \.self) { kao in
                        Text(kao).font(.custom(face, size: size)).foregroundStyle(Color(red: 0.48, green: 0.36, blue: 0.58))
                            .fixedSize()
                    }
                }
            }
            Text("🫂 😘 ☀️ 🌙 🥺 💧 ♡ ❤️").font(.system(size: 28)); Text("🫂 😘 ☀️ 🌙 🥺 💧 ♡ ❤️").font(probeEmojiFont.map { Font($0) } ?? .custom("AppleColorEmoji", size: 28))
        }
        .padding(14)
        .background(Color(red: 1, green: 0.97, blue: 0.98))
    }
}

@MainActor
func runProbe(out: String) {
    var report = ""
    for face in faces {
        report += "== \(face)\n"
        for row in candidates {
            for kao in row.1 {
                let miss = coverage(kao, face)
                report += "  \(row.0)  \(kao)  \(miss.isEmpty ? "ok" : "MISSING " + miss.joined(separator: " "))\n"
            }
        }
    }
    try? report.write(toFile: out + "/coverage.txt", atomically: true, encoding: .utf8)
    for face in ["HiraMaruProN-W4", "HiraginoSans-W3", "HiraginoSans-W6"] {
        for size in [10.0, 13.0] {
            let renderer = ImageRenderer(content: Specimen(face: face, size: size))
            renderer.scale = 2
            #if canImport(UIKit)
            if let data = renderer.uiImage?.pngData() { try? data.write(to: URL(fileURLWithPath: out + "/specimen-\(face)-\(Int(size)).png")) }
            #else
            if let cg = renderer.cgImage {
                let rep = NSBitmapImageRep(cgImage: cg)
                try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: out + "/specimen-\(face)-\(Int(size)).png"))
            }
            #endif
        }
    }
    print("probe done", out)
}
