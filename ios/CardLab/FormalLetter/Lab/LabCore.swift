import CoreGraphics
import CoreText
import Foundation
import ImageIO
import SwiftUI
import UniformTypeIdentifiers

// The formal letter's render lab (shared by the macOS runner and the simulator app): sample
// letters, and rendering a FormalLetterScene at an exact moment to an image, a sheet or a video.

enum LabFixtures {
    /// 26 November 2026, 9pm in Singapore (fixed, so every render is the same).
    static let written = Date(timeIntervalSince1970: 1_795_698_000)
    /// 14 February 2027 in Singapore.
    static let valentines = Date(timeIntervalSince1970: 1_802_534_400)

    static let medium = FormalLetterContent(
        title: "three months",
        text: """
        I wrote this one slowly, the way you're meant to write the important ones, with good paper and a whole evening and you at the end of every sentence.

        Three months ago you laughed at my terrible joke about the durian and I thought, oh no. Since then you have become the best part of every ordinary day: the voice notes on the bus, the photos of cats you find on your walk, the way you say "okay but listen" before telling me something wonderful.

        Thank you for being patient with me, and for making me want to be better at everything. Here's to all the months after this one.
        """,
        from: "Josh", kind: "note", date: written)

    static let short = FormalLetterContent(
        title: "for no reason at all",
        text: "Just a small letter to say I'm proud of you, and that I'd choose you in every lifetime. ❤️",
        from: "Josh", kind: "note", date: written)

    static let openWhen = FormalLetterContent(
        title: "for the far-away nights",
        text: """
        If you're reading this, it's late where you are and the distance feels loud tonight.

        Close your eyes for a second. I'm right there, the side of the bed you always steal the blanket from. Count to ten with me. Better?

        Now go and drink some water, put on the hoodie I left, and text me even if it's 3am. I will always, always want to hear from you.
        """,
        from: "Josh", kind: "open_when", openWhen: "you miss me", date: written)

    static let locked = FormalLetterContent(
        title: "our first valentine's",
        text: "Not yet, my love. ❤️",
        from: "Josh", kind: "open_when", openWhen: "it's valentine's day", date: written, lockedUntil: valentines)

    static let birthday = FormalLetterContent(
        heading: "a birthday letter for you \u{2709}",
        title: "for your birthday",
        text: """
        Dear Kiriya,

        Happy birthday, my love. Today the whole world is a little bit more yours than usual, and I hope it treats you like it knows that.

        Eat the cake first. Play your songs too loud. Let everyone fuss over you for once. I'll be the one fussing loudest.
        """,
        from: "Josh", kind: "birthday", date: written)

    static let maomao = FormalLetterContent(
        heading: "a letter for you \u{2709}",
        title: "a prescription for a long week",
        text: """
        ...yes, it's me again. dont make that face. i checked the herbs twice before writing this, so it's perfectly safe to read.

        ur doing too much, as usual. so here is the prescription: one cup of something warm, two hours of doing nothing at all, and as many naps as u can steal. no arguments. i've measured it properly.

        and if anyone asks, i did NOT write u a letter. it's a medical note. now rest... okay? ♡
        """,
        from: "Maomao", kind: "note", date: written)

    static let noTitle = FormalLetterContent(
        title: "",
        text: "Good morning, sleepyhead. I made you breakfast in my head and it was perfect. See you tonight at nine.",
        from: "Josh", kind: "note", date: nil)

    static let truncatedPush = FormalLetterContent(
        title: "the long one",
        text: "This is only the start of it. The push could only carry the first part, so the paper ends here and the rest is in the app\u{2026}",
        from: "Josh", kind: "note", date: written, truncated: true)

    static let long: FormalLetterContent = {
        let paragraphs = [
            "Kiriya, I've been trying to write this all week and every version came out too small for what I mean, so I'm just going to say it plainly, the way I'd say it if you were here.",
            "I love how you notice small things. I love how you're brave even when you're nervous. I love that you send me a heart at 6am your time just so it's there when I wake up. I keep every one of them.",
            "I know the distance is hard. Some nights the time zones feel like a wall. But every time I hear you laugh it gets a little thinner, and one day soon there won't be a wall at all, just you and me arguing about which hawker centre has the best chicken rice (it's mine, obviously).",
            "Thank you for teaching me words in Hokkien that I definitely pronounce wrong, for sending me songs at exactly the right moment, and for making ordinary Tuesdays feel like something to look forward to.",
            "There's a version of the future I think about a lot. It has a small kitchen and too many plants and a cat with opinions. You're in every room of it.",
        ]
        var text = ""
        var index = 0
        while text.count < 6200 {
            text += (text.isEmpty ? "" : "\n\n") + paragraphs[index % paragraphs.count]
            index += 1
        }
        text += "\n\nHappy three months, my love. Here's to all the months after this one. ❤️"
        return FormalLetterContent(title: "everything I didn't say out loud", text: text, from: "Josh", kind: "note", date: written)
    }()

    /// The longest a letter can be (20,000 characters).
    static let huge: FormalLetterContent = {
        var content = long
        var text = content.text
        while text.count < 19_900 { text += "\n\n" + long.text.prefix(1200) }
        content.text = String(text.prefix(20_000))
        content.title = "all of it"
        return content
    }()

    static let all: [(String, FormalLetterContent)] = [
        ("short", short), ("medium", medium), ("openwhen", openWhen), ("birthday", birthday), ("maomao", maomao),
        ("notitle", noTitle), ("truncated", truncatedPush), ("long", long), ("locked", locked),
    ]

    /// Awkward ones: emoji only, Chinese, an unbreakable word, a very long title, accents and dashes.
    static let edges: [(String, FormalLetterContent)] = [
        ("emoji", FormalLetterContent(title: "❤️❤️❤️", text: "❤️❤️❤️🥺💌✨", from: "Josh", date: written)),
        ("cjk", FormalLetterContent(title: "给你的信", text: "早安！今天也要开心哦。我好想你，我们周末视频吧？晚安的时候记得告诉我你吃了什么 🍜\n\n永远爱你。", from: "Josh", date: written)),
        ("longword", FormalLetterContent(title: "look", text: "look at this https://kiriya.love/very/long/path/that/keeps/going/forever?with=params&and=more and tell me it isn't us. Supercalifragilisticexpialidociousnessandthensomemorewithoutanyspaces.", from: "Josh", date: written)),
        ("longtitle", FormalLetterContent(title: "a very, very long title that keeps on going and going, far past what any envelope could possibly hold in one line", text: "short and sweet.", from: "Josh", kind: "note", date: written)),
        ("accents", FormalLetterContent(title: "café date", text: "Saturday — you, me, the café near Tiong Bahru… and the pâtisserie you love. Naïve of me to think you'd say no. Deal?", from: "Josh", date: written)),
        ("noheading", FormalLetterContent(heading: "", title: "", text: "hi ❤️", from: "", date: nil)),
    ]

    static func named(_ name: String) -> FormalLetterContent {
        if name == "huge" { return huge }
        if let edge = edges.first(where: { $0.0 == name }) { return edge.1 }
        return all.first { $0.0 == name }?.1 ?? medium
    }

    static func isLocked(_ name: String) -> Bool { named(name).isLocked(at: written) }
}

@MainActor
enum LabRender {
    static var scrollable = ProcessInfo.processInfo.environment["SCROLLABLE"] != "0"

    static func geometry(_ content: FormalLetterContent, width: CGFloat, locked: Bool) -> FormalLetterGeometry {
        FormalLetterGeometry.make(content: content, width: width, scrollable: scrollable, locked: locked)
    }

    /// The card at one moment (`time` nil = sealed, with `idle` seconds of idle loop), on its own background.
    static func scene(_ content: FormalLetterContent, width: CGFloat, time: Double?, idle: Double, wiggle: Double? = nil,
                      locked: Bool = false, height: CGFloat? = nil) -> some View {
        let g = geometry(content, width: width, locked: locked)
        let h = height ?? (time == nil || locked ? g.sealedHeight : g.openHeight)
        return FormalLetterScene(content: content, time: time, idle: idle, wiggle: wiggle, width: width,
                                 scrollable: scrollable, locked: locked)
            .frame(width: width, height: h, alignment: .top)
            .background(FormalLetterPalette.background)
            .environment(\.colorScheme, .light)
    }

    static func image<V: View>(_ view: V, scale: CGFloat) -> CGImage? {
        let renderer = ImageRenderer(content: view)
        renderer.scale = scale
        return renderer.cgImage
    }

    static func writePNG(_ image: CGImage, to path: String) {
        let url = URL(fileURLWithPath: path) as CFURL
        guard let dest = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil) else { return }
        CGImageDestinationAddImage(dest, image, nil)
        CGImageDestinationFinalize(dest)
    }

    /// Several frames side by side in a grid, each labelled.
    static func sheet(_ frames: [(String, CGImage)], columns: Int, gap: Int = 12, background: CGColor? = nil) -> CGImage? {
        guard let first = frames.first?.1 else { return nil }
        let fw = frames.map { $0.1.width }.max() ?? first.width
        let fh = frames.map { $0.1.height }.max() ?? first.height
        let label = 26
        let rows = (frames.count + columns - 1) / columns
        let W = columns * fw + (columns + 1) * gap
        let H = rows * (fh + label) + (rows + 1) * gap
        guard let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return nil }
        ctx.setFillColor(background ?? CGColor(red: 0.16, green: 0.13, blue: 0.2, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
        for (index, frame) in frames.enumerated() {
            let col = index % columns, row = index / columns
            let x = gap + col * (fw + gap)
            let yTop = gap + row * (fh + label + gap)
            let y = H - yTop - label - frame.1.height
            ctx.draw(frame.1, in: CGRect(x: x, y: y, width: frame.1.width, height: frame.1.height))
            drawLabel(ctx, frame.0, x: x + 4, y: H - yTop - label + 6, dark: background != nil)
        }
        return ctx.makeImage()
    }

    private static func drawLabel(_ ctx: CGContext, _ text: String, x: Int, y: Int, dark: Bool) {
        let font = CTFontCreateWithName("Menlo-Bold" as CFString, 16, nil)
        let color = dark ? CGColor(red: 0.3, green: 0.18, blue: 0.39, alpha: 1) : CGColor(red: 1, green: 0.9, blue: 0.95, alpha: 1)
        let attr = NSAttributedString(string: text, attributes: [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
        ])
        let line = CTLineCreateWithAttributedString(attr)
        ctx.textPosition = CGPoint(x: x, y: y)
        CTLineDraw(line, ctx)
    }

    /// RGBA bytes of an image at a fixed size (for piping frames into ffmpeg), top-aligned.
    static func rgba(_ image: CGImage, width: Int, height: Int) -> Data {
        var data = Data(count: width * height * 4)
        data.withUnsafeMutableBytes { raw in
            guard let ctx = CGContext(data: raw.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                                      space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
            else { return }
            ctx.setFillColor(CGColor(red: 0.98, green: 0.95, blue: 0.99, alpha: 1))
            ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
            ctx.draw(image, in: CGRect(x: 0, y: height - image.height, width: image.width, height: image.height))
        }
        return data
    }
}
