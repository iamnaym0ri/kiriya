import CoreGraphics
import Foundation
import ImageIO
import SwiftUI
import UniformTypeIdentifiers

// The render lab's shared part (macOS runner and the simulator app): sample notes, and rendering a
// LetterScene at an exact moment to an image, a contact sheet or a video.

enum LabFixtures {
    static let heading = "a little note for you ✉︎"

    static let short = LetterContent(heading: heading, title: nil,
                                     text: "good morning sleepyhead ☀️ I love you ❤️",
                                     byline: "— Josh", truncated: false)

    static let medium = LetterContent(heading: heading, title: "for after your exam",
                                      text: "I know today felt long, but I'm so proud of how hard you worked for this. Go get bubble tea, put your feet up and don't think about revision for one whole evening. I'll call you at nine 💜",
                                      byline: "— Josh", truncated: false)

    static let long = LetterContent(heading: heading, title: "three months 🌸",
                                    text: """
                                    Kiriya, I've been trying to write this all week and every version came out too small for what I mean, so I'm just going to say it plainly.

                                    Three months ago you laughed at my terrible joke about the durian and I thought, oh no. Since then you have become the best part of every ordinary day: the voice notes on the bus, the photos of cats you find on your walk, the way you say "okay but listen" before telling me something wonderful.

                                    I love how you notice small things. I love how you're brave even when you're nervous. I love that you send me a heart at 6am your time just so it's there when I wake up. I keep every one of them.

                                    I know the distance is hard. Some nights the time zones feel like a wall. But every time I hear you laugh it gets a little thinner, and one day soon there won't be a wall at all, just you and me arguing about which hawker centre has the best chicken rice (it's mine, obviously).

                                    Thank you for being patient with me, for teaching me words in Hokkien that I definitely pronounce wrong, and for making me want to be better at everything.

                                    Happy three months, my love. Here's to all the months after this one. ❤️
                                    """,
                                    byline: "— Josh", truncated: false)

    static let noByline = LetterContent(heading: heading, title: "psst",
                                        text: "look out of your window at 9 tonight 🌙",
                                        byline: "", truncated: true)

    /// No emoji anywhere (the simulator runtime has no emoji font, so this isolates that cost).
    static let plain = LetterContent(heading: "a little note for you", title: "for after your exam",
                                     text: "I know today felt long, but I'm so proud of how hard you worked for this. Go get bubble tea, put your feet up and don't think about revision for one whole evening. I'll call you at nine.",
                                     byline: "— Josh", truncated: false)

    static let all: [(String, LetterContent)] = [("short", short), ("medium", medium), ("long", long), ("nobyline", noByline)]

    /// Awkward ones: emoji only, Chinese, an unbreakable link, a title too long for two lines, no heading.
    static let edges: [(String, LetterContent)] = [
        ("emoji", LetterContent(heading: heading, title: nil, text: "❤️❤️❤️🥺💌✨", byline: "— Josh")),
        ("cjk", LetterContent(heading: heading, title: "早安 ☀️", text: "早安！今天也要开心哦。我好想你，我们周末视频吧？晚安的时候记得告诉我你吃了什么 🍜", byline: "— Josh")),
        ("url", LetterContent(heading: heading, title: nil, text: "look at this https://kiriya.love/very/long/path/that/keeps/going/forever?with=params&and=more and tell me it isn't us", byline: "— Josh")),
        ("longtitle", LetterContent(heading: heading, title: "a very very long title that keeps on going and going past two whole lines for sure", text: "short and sweet.", byline: "— Josh")),
        ("noheading", LetterContent(heading: "", title: nil, text: "hi ❤️", byline: "")),
        ("café", LetterContent(heading: "a little note for you ✉︎", title: "café date", text: "Saturday — you, me, the café near Tiong Bahru… and the pastry you love. Deal?", byline: "— Josh")),
    ]

    static func named(_ name: String) -> LetterContent {
        if name == "plain" { return plain }
        if let edge = edges.first(where: { $0.0 == name }) { return edge.1 }
        return all.first { $0.0 == name }?.1 ?? short
    }
}

@MainActor
enum LabRender {
    /// The card at one moment (`time` nil = sealed, with `idle` seconds of idle loop), on its own background.
    static func scene(_ content: LetterContent, width: CGFloat, time: Double?, idle: Double, height: CGFloat? = nil) -> some View {
        let g = LetterGeometry.make(content: content, width: width)
        let h = height ?? (time == nil ? g.sealedHeight : g.openHeight)
        return LetterScene(content: content, time: time, idle: idle, width: width)
            .frame(width: width, height: h, alignment: .top)
            .background(LetterPalette.background)
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

    /// Several frames side by side in a grid, each labelled with its time.
    static func sheet(_ frames: [(String, CGImage)], columns: Int, gap: Int = 12) -> CGImage? {
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
        ctx.setFillColor(CGColor(red: 0.16, green: 0.13, blue: 0.2, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
        for (index, frame) in frames.enumerated() {
            let col = index % columns, row = index / columns
            let x = gap + col * (fw + gap)
            let yTop = gap + row * (fh + label + gap)
            let y = H - yTop - label - frame.1.height
            ctx.draw(frame.1, in: CGRect(x: x, y: y, width: frame.1.width, height: frame.1.height))
            drawLabel(ctx, frame.0, x: x + 4, y: H - yTop - label + 6)
        }
        return ctx.makeImage()
    }

    private static func drawLabel(_ ctx: CGContext, _ text: String, x: Int, y: Int) {
        let font = CTFontCreateWithName("Menlo-Bold" as CFString, 16, nil)
        let attr = NSAttributedString(string: text, attributes: [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(red: 1, green: 0.9, blue: 0.95, alpha: 1),
        ])
        let line = CTLineCreateWithAttributedString(attr)
        ctx.textPosition = CGPoint(x: x, y: y)
        CTLineDraw(line, ctx)
    }

    /// RGBA bytes of an image at a fixed size (for piping frames into ffmpeg).
    static func rgba(_ image: CGImage, width: Int, height: Int) -> Data {
        var data = Data(count: width * height * 4)
        data.withUnsafeMutableBytes { raw in
            guard let ctx = CGContext(data: raw.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                                      space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
            else { return }
            ctx.setFillColor(CGColor(red: 0.99, green: 0.96, blue: 0.98, alpha: 1))
            ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
            ctx.draw(image, in: CGRect(x: 0, y: height - image.height, width: image.width, height: image.height))
        }
        return data
    }
}
