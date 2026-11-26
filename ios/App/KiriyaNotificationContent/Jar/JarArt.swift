import SwiftUI
import UIKit

// The note jar's artwork, drawn the way the app draws it: every path and colour below is copied
// from JarArtwork in src/world/today/NoteJar.jsx (viewBox 0 0 360 390, "art units"), so the jar in
// the notification is the jar she knows. Shared by JarScene (the card) and nothing else.

// MARK: - Colours

/// An sRGB colour usable both by SwiftUI and by CoreText.
struct JarRGB: Equatable {
    let r: Double, g: Double, b: Double, a: Double
    init(_ hex: UInt32, _ alpha: Double = 1) {
        r = Double((hex >> 16) & 0xff) / 255
        g = Double((hex >> 8) & 0xff) / 255
        b = Double(hex & 0xff) / 255
        a = alpha
    }
    var color: Color { Color(.sRGB, red: r, green: g, blue: b, opacity: a) }
    var cg: CGColor { CGColor(srgbRed: r, green: g, blue: b, alpha: a) }
    func alpha(_ value: Double) -> JarRGB { JarRGB(r: r, g: g, b: b, a: value) }
    private init(r: Double, g: Double, b: Double, a: Double) { self.r = r; self.g = g; self.b = b; self.a = a }
}

/// NoteJar.css / NoteJar.jsx colours (the site's tokens where the jar uses them).
enum JarPalette {
    // card
    static let cardTop = JarRGB(0xfff7fb)
    static let cardMid = JarRGB(0xf8effa)
    static let cardBottom = JarRGB(0xefe5f6)
    static let glow = JarRGB(0xffffff)
    // glass
    static let glassStops: [(JarRGB, Double)] = [(JarRGB(0xfffaff, 0.9), 0), (JarRGB(0xdcc7eb, 0.35), 0.5), (JarRGB(0xe7bfda, 0.75), 1)]
    static let glassStroke = JarRGB(0xae8abb)
    static let glint = JarRGB(0xfffaff)
    static let sideShade = JarRGB(0xb693bf)
    static let neckLine = JarRGB(0xfff8fd)
    static let floorShadow = JarRGB(0xb697cc)
    // lid
    static let lidTop = JarRGB(0xe4bdd4)
    static let lidStroke = JarRGB(0xb787a9)
    static let lidBandTop = JarRGB(0xe9c8da)
    static let lidBandBottom = JarRGB(0xbe8fae)
    static let lidGlint = JarRGB(0xfff6fc)
    static let lidTicks = JarRGB(0xa57a9f)
    // ribbon, bow, label
    static let ribbon = JarRGB(0xcda0c3)
    static let bowFill = JarRGB(0xdda9c5)
    static let bowStroke = JarRGB(0xb580a5)
    static let bowTails = JarRGB(0xd7a0be)
    static let bowKnot = JarRGB(0xc28aad)
    static let labelFill = JarRGB(0xfffaf5)
    static let labelStroke = JarRGB(0xccb3cf)
    static let labelDash = JarRGB(0xddc9db)
    static let labelInk = JarRGB(0x87608f)
    // the folded notes inside
    static let noteStroke = JarRGB(0xb597bb)
    static let noteFold = JarRGB(0xc3a4c4)
    static let noteHeart = JarRGB(0xbb85aa)
    // charms and the "new notes" heart
    static let charm = JarRGB(0xbd91b4)
    static let heart = JarRGB(0xe0476f)
    static let heartEdge = JarRGB(0xa8244d)
    static let heartShine = JarRGB(0xffd3df)
    // the note that comes out (jar-flying-note) and the paper it opens into (.note-jar__paper)
    static let packet = JarRGB(0xfffaf3)
    static let packetStroke = JarRGB(0xba94c4)
    static let packetFold = JarRGB(0xc9a3c5)
    static let paper = JarRGB(0xfffdf9)
    static let paperBack = JarRGB(0xfbf4ef)
    static let paperBorder = JarRGB(0xdecbdc)
    static let paperSheet = JarRGB(0xf3e8f1)
    static let paperShadow = JarRGB(0x604365)
    static let crease = JarRGB(0xe9dbe6)
    static let tape = JarRGB(0xe9c8df, 0.74)
    // ink
    static let ink = JarRGB(0x54385f)
    static let muted = JarRGB(0x7a6583)
    static let microLabel = JarRGB(0x8b6c92)
    static let salutation = JarRGB(0xa57aa1)
    static let byline = JarRGB(0x917297)
    // the day tag (.note-jar__day, and its [data-fresh] look)
    static let tagFill = JarRGB(0xe4d5ec)
    static let tagEdge = JarRGB(0xba98c7)
    static let freshFill = JarRGB(0xffe5ef)
    static let freshEdge = JarRGB(0xe0476f)
    static let freshInk = JarRGB(0xa8244d)
}

// MARK: - SVG path data

/// A small SVG path-data reader (M L H V C Q T Z, absolute and relative, implicit repeats) so the
/// jar's paths can be copied from NoteJar.jsx unchanged.
enum JarSVG {
    static func path(_ data: String) -> Path {
        var reader = Reader(Array(data.utf8))
        var path = Path()
        var command: UInt8 = 0
        var point = CGPoint.zero, start = CGPoint.zero
        var lastQuad: CGPoint?
        while true {
            if let next = reader.command() {
                command = next
            } else if reader.atEnd {
                break
            } else if command == UInt8(ascii: "M") {
                command = UInt8(ascii: "L")
            } else if command == UInt8(ascii: "m") {
                command = UInt8(ascii: "l")
            }
            let relative = command >= UInt8(ascii: "a")
            let origin = relative ? point : .zero
            var quad: CGPoint?
            switch command | 0x20 {
            case UInt8(ascii: "m"):
                guard let p = reader.point(origin) else { return path }
                path.move(to: p); point = p; start = p
            case UInt8(ascii: "l"):
                guard let p = reader.point(origin) else { return path }
                path.addLine(to: p); point = p
            case UInt8(ascii: "h"):
                guard let x = reader.number() else { return path }
                point = CGPoint(x: (relative ? point.x : 0) + x, y: point.y); path.addLine(to: point)
            case UInt8(ascii: "v"):
                guard let y = reader.number() else { return path }
                point = CGPoint(x: point.x, y: (relative ? point.y : 0) + y); path.addLine(to: point)
            case UInt8(ascii: "c"):
                guard let c1 = reader.point(origin), let c2 = reader.point(origin), let p = reader.point(origin) else { return path }
                path.addCurve(to: p, control1: c1, control2: c2); point = p
            case UInt8(ascii: "q"):
                guard let c = reader.point(origin), let p = reader.point(origin) else { return path }
                path.addQuadCurve(to: p, control: c); point = p; quad = c
            case UInt8(ascii: "t"):
                guard let p = reader.point(origin) else { return path }
                let c = lastQuad.map { CGPoint(x: 2 * point.x - $0.x, y: 2 * point.y - $0.y) } ?? point
                path.addQuadCurve(to: p, control: c); point = p; quad = c
            case UInt8(ascii: "z"):
                path.closeSubpath(); point = start
            default:
                return path
            }
            lastQuad = quad
        }
        return path
    }

    private struct Reader {
        let bytes: [UInt8]
        var index = 0
        init(_ bytes: [UInt8]) { self.bytes = bytes }
        var atEnd: Bool { mutating get { skip(); return index >= bytes.count } }
        mutating func skip() {
            while index < bytes.count, [32, 44, 9, 10, 13].contains(bytes[index]) { index += 1 }
        }
        mutating func command() -> UInt8? {
            skip()
            guard index < bytes.count else { return nil }
            let byte = bytes[index]
            guard "MmLlHhVvCcQqTtZz".utf8.contains(byte) else { return nil }
            index += 1
            return byte
        }
        mutating func number() -> CGFloat? {
            skip()
            let begin = index
            if index < bytes.count, bytes[index] == 45 || bytes[index] == 43 { index += 1 }
            var digits = false, dot = false
            while index < bytes.count {
                let byte = bytes[index]
                if byte >= 48 && byte <= 57 { digits = true; index += 1 } else if byte == 46 && !dot { dot = true; index += 1 } else { break }
            }
            guard digits, let value = Double(String(decoding: bytes[begin..<index], as: UTF8.self)) else { index = begin; return nil }
            return CGFloat(value)
        }
        mutating func point(_ origin: CGPoint) -> CGPoint? {
            guard let x = number(), let y = number() else { return nil }
            return CGPoint(x: origin.x + x, y: origin.y + y)
        }
    }
}

/// NoteJar.jsx's paths, parsed once.
enum JarPaths {
    static let body = JarSVG.path("M106 120h148v20c0 25 30 26 30 63v115q0 31-31 31H107q-31 0-31-31V203c0-37 30-38 30-63Z")
    static let bodyBounds = CGRect(x: 76, y: 120, width: 208, height: 229)
    static let leftGlint = JarSVG.path("M103 181q-14 10-14 30v67m1 15v13")
    static let rightShade = JarSVG.path("M265 217v95q0 20-18 20")
    static let neckLine = JarSVG.path("M107 142h145")
    static let ribbon = JarSVG.path("M83 193q93 16 194-1")
    static let bowLoops = JarSVG.path("M-4-2C-44-36-63-8-42 3c11 7 24 5 38-5ZM4-2C44-35 63-9 42 4c-11 7-26 3-38-6Z")
    static let bowTails = JarSVG.path("m-7 3-22 37 17-5 11-24 17 32 11-10L7 3")
    static let lidBand = JarSVG.path("M93 109v17q1 16 87 16t87-16v-17q-5 15-87 15t-87-15Z")
    static let lidGlint = JarSVG.path("M105 110q65-19 140 0")
    static let lidTicks = JarSVG.path("m133 127 4 9m11-7 3 9m12-8 2 9m13-8v9m14-9-1 8m14-10-2 9m15-11-3 9m15-13-4 9")
    static let noteFold = JarSVG.path("m-23-13 28 16 26-16")
    static let noteHeart = JarSVG.path("M1 5q-7-8-10-3-3 5 10 11Q14 4 10 0 6-3 1 5")
    /// The "new notes" heart (jar-fresh__heart), centred on (0, -7) and 42 units tall.
    static let heart = JarSVG.path("M0 14C-22-2-24-20-12-25-5-28 0-22 0-18 0-22 5-28 12-25 24-20 22-2 0 14Z")
    static let heartShine = JarSVG.path("M-13-17q3-5 8-4")

    /// The eight folded notes inside: position, tilt and paper colour (NoteJar.jsx).
    static let notes: [(x: CGFloat, y: CGFloat, angle: Double, color: JarRGB)] = [
        (106, 278, -19, JarRGB(0xd6bee8)), (213, 294, 14, JarRGB(0xefc5d9)), (159, 318, -8, JarRGB(0xfff5df)),
        (127, 235, 16, JarRGB(0xefcbdc)), (209, 230, -17, JarRGB(0xded0ec)), (154, 275, 9, JarRGB(0xfff8eb)),
        (96, 323, 17, JarRGB(0xe2d2ef)), (241, 329, -15, JarRGB(0xfff4e7)),
    ]

    /// A four-point sparkle (✦/✧) of radius r centred on the origin.
    static func sparkle(_ r: CGFloat) -> Path {
        var path = Path()
        let k = r * 0.2
        path.move(to: CGPoint(x: 0, y: -r))
        path.addQuadCurve(to: CGPoint(x: r, y: 0), control: CGPoint(x: k, y: -k))
        path.addQuadCurve(to: CGPoint(x: 0, y: r), control: CGPoint(x: k, y: k))
        path.addQuadCurve(to: CGPoint(x: -r, y: 0), control: CGPoint(x: -k, y: k))
        path.addQuadCurve(to: CGPoint(x: 0, y: -r), control: CGPoint(x: -k, y: -k))
        path.closeSubpath()
        return path
    }

    /// A five-petal flower (✿) of radius r centred on the origin.
    static func flower(_ r: CGFloat) -> Path {
        var path = Path()
        let petal = r * 0.42
        for index in 0..<5 {
            let angle = Double(index) / 5 * 2 * .pi - .pi / 2
            let center = CGPoint(x: cos(angle) * (r - petal), y: sin(angle) * (r - petal))
            path.addEllipse(in: CGRect(x: center.x - petal, y: center.y - petal, width: petal * 2, height: petal * 2))
        }
        return path
    }

    /// The heart, scaled to `height` and centred on the origin.
    static func heart(height: CGFloat) -> Path {
        heart.applying(CGAffineTransform(scaleX: height / 42, y: height / 42).translatedBy(x: 0, y: 7))
    }
}

// MARK: - Drawing

/// The jar's moving parts at one instant (all in art units / degrees).
struct JarPose: Equatable {
    /// Rotation of the whole jar about its base (180, 350): the app's wiggle and the pull's shake.
    var rotation: Double = 0
    var squashX: CGFloat = 1
    var squashY: CGFloat = 1
    /// Vertical hop of the jar (negative = up).
    var hop: CGFloat = 0
    /// The lid's own lift and tilt, on top of the jar's.
    var lidOffset: CGSize = .zero
    var lidRotation: Double = 0
    /// Per-note nudges for the eight notes inside (dx, dy, degrees).
    var notes: [CGVector] = Array(repeating: .zero, count: 8)
    var noteTilts: [Double] = Array(repeating: 0, count: 8)
    /// The four charms around the jar: lift (art units) and opacity.
    var charmLift: [CGFloat] = [0, 0, 0, 0]
    var charmOpacity: [Double] = [0.75, 0.75, 0.75, 0.75]
    /// The red "new notes" heart on the lid.
    var badgeText: String?
    var badgeScale: CGFloat = 1
    var badgeOpacity: Double = 1
    var badgePop: CGFloat = 1
    var sparkLift: [CGFloat] = [0, 0]
    var sparkOpacity: [Double] = [0.75, 0.75]
    /// Little sparkles at the mouth while a note is being found: (x, y, radius, opacity) in art units.
    var twinkles: [JarTwinkle] = []
}

struct JarTwinkle: Equatable {
    var center: CGPoint
    var radius: CGFloat
    var opacity: Double
    var filled: Bool
    var red = false
}

enum JarArtist {
    /// Where the jar sits in the scene: art (180, 350) lands on `base`, `scale` points per art unit.
    struct Placement: Equatable {
        var base: CGPoint
        var scale: CGFloat
        var transform: CGAffineTransform {
            CGAffineTransform(translationX: base.x, y: base.y).scaledBy(x: scale, y: scale).translatedBy(x: -180, y: -350)
        }
    }

    static func vesselTransform(_ pose: JarPose) -> CGAffineTransform {
        CGAffineTransform(translationX: 180, y: 350 + pose.hop)
            .rotated(by: pose.rotation * .pi / 180)
            .scaledBy(x: pose.squashX, y: pose.squashY)
            .translatedBy(x: -180, y: -350)
    }

    static func lidTransform(_ pose: JarPose) -> CGAffineTransform {
        vesselTransform(pose)
            .translatedBy(x: 180 + pose.lidOffset.width, y: 118 + pose.lidOffset.height)
            .rotated(by: pose.lidRotation * .pi / 180)
            .translatedBy(x: -180, y: -118)
    }

    /// The floor shadow and the glass (everything behind the notes).
    static func drawBack(_ context: GraphicsContext, placement: Placement, pose: JarPose, shadowOpacity: Double = 1) {
        var art = context
        art.concatenate(placement.transform)
        // The shadow stays on the floor and shrinks a little when the jar hops.
        let lift = max(0, -pose.hop)
        let shrink = 1 - min(0.25, lift * 0.012)
        let shadow = CGRect(x: 180 - 119 * shrink * pose.squashX, y: 359 - 13 * shrink, width: 238 * shrink * pose.squashX, height: 26 * shrink)
        art.fill(Path(ellipseIn: shadow), with: .color(JarPalette.floorShadow.color.opacity(0.17 * shadowOpacity)))

        var vessel = art
        vessel.concatenate(vesselTransform(pose))
        // objectBoundingBox gradient, as in the SVG: the unit square stretched over the body's bounds.
        vessel.drawLayer { glass in
            glass.clip(to: JarPaths.body)
            let box = JarPaths.bodyBounds
            glass.concatenate(CGAffineTransform(translationX: box.minX, y: box.minY).scaledBy(x: box.width, y: box.height))
            let stops = JarPalette.glassStops.map { Gradient.Stop(color: $0.0.color, location: $0.1) }
            glass.fill(Path(CGRect(x: 0, y: 0, width: 1, height: 1)), with: .linearGradient(Gradient(stops: stops), startPoint: .zero, endPoint: CGPoint(x: 1, y: 1)))
        }
        vessel.stroke(JarPaths.body, with: .color(JarPalette.glassStroke.color), lineWidth: 2.5)
    }

    /// The notes inside, the glass highlights, ribbon, bow and label (everything on the jar in front of a rising note).
    static func drawFront(_ context: GraphicsContext, placement: Placement, pose: JarPose, hiddenNote: Int? = nil, labelLine: CTLine?) {
        var vessel = context
        vessel.concatenate(placement.transform)
        vessel.concatenate(vesselTransform(pose))
        vessel.drawLayer { inside in
            inside.clip(to: JarPaths.body)
            for (index, note) in JarPaths.notes.enumerated() where index != hiddenNote {
                var paper = inside
                let nudge = pose.notes.indices.contains(index) ? pose.notes[index] : .zero
                let tilt = pose.noteTilts.indices.contains(index) ? pose.noteTilts[index] : 0
                paper.translateBy(x: note.x + nudge.dx, y: note.y + nudge.dy)
                paper.rotate(by: .degrees(note.angle))
                // transform-box: fill-box, origin centre: the tilt turns each note about its own middle.
                paper.translateBy(x: 4, y: 1)
                paper.rotate(by: .degrees(tilt))
                paper.translateBy(x: -4, y: -1)
                let rect = Path(roundedRect: CGRect(x: -25, y: -16, width: 58, height: 34), cornerRadius: 3)
                paper.fill(rect, with: .color(note.color.color))
                paper.stroke(rect, with: .color(JarPalette.noteStroke.color), lineWidth: 1.3)
                paper.stroke(JarPaths.noteFold, with: .color(JarPalette.noteFold.color), lineWidth: 1)
                paper.fill(JarPaths.noteHeart, with: .color(JarPalette.noteHeart.color))
            }
        }
        vessel.stroke(JarPaths.leftGlint, with: .color(JarPalette.glint.color.opacity(0.8)), style: StrokeStyle(lineWidth: 7, lineCap: .round))
        vessel.stroke(JarPaths.rightShade, with: .color(JarPalette.sideShade.color.opacity(0.35)), lineWidth: 3)
        vessel.stroke(JarPaths.neckLine, with: .color(JarPalette.neckLine.color), lineWidth: 6)
        vessel.stroke(JarPaths.ribbon, with: .color(JarPalette.ribbon.color), lineWidth: 10)
        var bow = vessel
        bow.translateBy(x: 183, y: 191)
        bow.fill(JarPaths.bowLoops, with: .color(JarPalette.bowFill.color))
        bow.stroke(JarPaths.bowLoops, with: .color(JarPalette.bowStroke.color), lineWidth: 2)
        bow.fill(JarPaths.bowTails, with: .color(JarPalette.bowTails.color))
        bow.stroke(JarPaths.bowTails, with: .color(JarPalette.bowStroke.color), lineWidth: 1.5)
        bow.fill(Path(ellipseIn: CGRect(x: -10, y: -8, width: 20, height: 16)), with: .color(JarPalette.bowKnot.color))
        // The label: "little bits of love".
        var label = vessel
        label.translateBy(x: 180, y: 266)
        label.rotate(by: .degrees(-4))
        label.translateBy(x: -180, y: -266)
        let card = Path(roundedRect: CGRect(x: 113, y: 244, width: 134, height: 54), cornerRadius: 7)
        label.fill(card, with: .color(JarPalette.labelFill.color))
        label.stroke(card, with: .color(JarPalette.labelStroke.color), lineWidth: 1)
        label.stroke(Path(roundedRect: CGRect(x: 118, y: 249, width: 124, height: 44), cornerRadius: 5),
                     with: .color(JarPalette.labelDash.color), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
        if let labelLine {
            JarText.draw(labelLine, in: label, centeredAt: 180, baseline: 278)
        }
    }

    /// The lid, with its ridges and shine.
    static func drawLid(_ context: GraphicsContext, placement: Placement, pose: JarPose) {
        var lid = context
        lid.concatenate(placement.transform)
        lid.concatenate(lidTransform(pose))
        let top = Path(ellipseIn: CGRect(x: 93, y: 94, width: 174, height: 34))
        lid.fill(top, with: .color(JarPalette.lidTop.color))
        lid.stroke(top, with: .color(JarPalette.lidStroke.color), lineWidth: 2)
        lid.fill(JarPaths.lidBand, with: .linearGradient(Gradient(colors: [JarPalette.lidBandTop.color, JarPalette.lidBandBottom.color]),
                                                         startPoint: CGPoint(x: 180, y: 109), endPoint: CGPoint(x: 180, y: 142)))
        lid.stroke(JarPaths.lidBand, with: .color(JarPalette.lidStroke.color), lineWidth: 2)
        lid.stroke(JarPaths.lidGlint, with: .color(JarPalette.lidGlint.color.opacity(0.8)), lineWidth: 3)
        lid.stroke(JarPaths.lidTicks, with: .color(JarPalette.lidTicks.color.opacity(0.4)), lineWidth: 1)
    }

    /// The four charms (✦ ✿ ✧ and a heart) and the red "new notes" heart with its count.
    static func drawCharms(_ context: GraphicsContext, placement: Placement, pose: JarPose, opacity: Double, countLine: CTLine?) {
        var art = context
        art.concatenate(placement.transform)
        art.translateBy(x: 0, y: pose.hop)
        // Small (under a note), the charms above the lid would touch the paper, and the heart grows so its count stays readable.
        let small = min(1, max(0, (placement.scale - 0.36) / 0.24))
        let topCharms = small * small * (3 - 2 * small)
        let boost = min(1.75, max(1, 0.5 / placement.scale))
        if opacity > 0.001 {
            // Centres measured from the site's glyphs (Georgia 29px at x/y baselines 57/180, 298/153, 278/79, 81/79).
            let charms: [(CGPoint, Int)] = [(CGPoint(x: 70, y: 170), 0), (CGPoint(x: 308, y: 143), 1), (CGPoint(x: 290, y: 70), 2), (CGPoint(x: 92, y: 69), 3)]
            for (center, kind) in charms {
                var charm = art
                charm.opacity = opacity * pose.charmOpacity[kind] * (kind >= 1 ? topCharms : 1)
                charm.translateBy(x: center.x, y: center.y + pose.charmLift[kind])
                switch kind {
                case 0:
                    // The app's ♡ charm, as a filled red heart.
                    charm.fill(JarPaths.heart(height: 17), with: .color(JarPalette.heart.color.opacity(0.85)))
                case 1: charm.stroke(JarPaths.sparkle(11), with: .color(JarPalette.charm.color), lineWidth: 1.7)
                case 2:
                    charm.fill(JarPaths.flower(10), with: .color(JarPalette.charm.color))
                    charm.fill(Path(ellipseIn: CGRect(x: -2.6, y: -2.6, width: 5.2, height: 5.2)), with: .color(JarPalette.heartShine.color))
                default: charm.fill(JarPaths.sparkle(12), with: .color(JarPalette.charm.color))
                }
            }
        }
        for twinkle in pose.twinkles where twinkle.opacity > 0.01 {
            var star = art
            star.opacity = twinkle.opacity
            star.translateBy(x: twinkle.center.x, y: twinkle.center.y)
            let ink = (twinkle.red ? JarPalette.heart : JarPalette.charm).color
            if twinkle.filled {
                star.fill(JarPaths.sparkle(twinkle.radius), with: .color(ink))
            } else {
                star.stroke(JarPaths.sparkle(twinkle.radius), with: .color(ink), lineWidth: 1.6)
            }
        }
        guard pose.badgeText != nil, pose.badgeOpacity > 0.001, pose.badgeScale > 0.001 else { return }
        var badge = art
        badge.opacity = pose.badgeOpacity
        badge.translateBy(x: 262 + 8 * (boost - 1), y: 92 + 30 * (boost - 1))
        badge.scaleBy(x: boost, y: boost)
        for (index, spark) in [CGPoint(x: 30, y: -27), CGPoint(x: -24, y: -29)].enumerated() {
            var star = badge
            star.opacity = pose.sparkOpacity[index]
            star.translateBy(x: spark.x, y: spark.y + pose.sparkLift[index])
            if index == 0 {
                star.fill(JarPaths.sparkle(6.5), with: .color(JarPalette.heart.color))
            } else {
                star.stroke(JarPaths.sparkle(6), with: .color(JarPalette.heart.color), lineWidth: 1.2)
            }
        }
        // transform-box: fill-box; the beat scales the heart about its middle (0, -7).
        badge.translateBy(x: 0, y: -7)
        badge.scaleBy(x: pose.badgeScale * pose.badgePop, y: pose.badgeScale * pose.badgePop)
        badge.translateBy(x: 0, y: 7)
        badge.fill(JarPaths.heart, with: .color(JarPalette.heart.color))
        badge.stroke(JarPaths.heart, with: .color(JarPalette.heartEdge.color), style: StrokeStyle(lineWidth: 2.5, lineJoin: .round))
        badge.stroke(JarPaths.heartShine, with: .color(JarPalette.heartShine.color), style: StrokeStyle(lineWidth: 3, lineCap: .round))
        if let countLine {
            JarText.draw(countLine, in: badge, centeredAt: 0, baseline: -1.5)
        }
    }

    /// The note that comes out (the app's jar-flying-note), drawn in scene points: cream paper, the
    /// envelope fold and a red heart seal. `size` is its full size; the context is already centred and turned.
    static func drawPacket(_ context: GraphicsContext, size: CGSize, flip: Bool = false) {
        var packet = context
        if flip { packet.scaleBy(x: 1, y: -1) }
        let w = size.width, h = size.height
        let rect = CGRect(x: -w / 2, y: -h / 2, width: w, height: h)
        let corner = min(5, max(2, min(w, h) * 0.08))
        let shape = Path(roundedRect: rect, cornerRadius: corner)
        packet.fill(shape, with: .color(JarPalette.packet.color))
        let k = min(h / 43, w / 58)
        var fold = Path()
        fold.move(to: CGPoint(x: rect.minX + 3 * k, y: rect.minY + 4 * k))
        fold.addLine(to: CGPoint(x: 0, y: rect.minY + h * 0.5))
        fold.addLine(to: CGPoint(x: rect.maxX - 3 * k, y: rect.minY + 4 * k))
        // Big enough to read (on its way to her): the flap a shade deeper, and "just for u" in the corner.
        let detail = min(1, max(0, (h - 50) / 50))
        if detail > 0 {
            var flap = Path()
            flap.move(to: CGPoint(x: rect.minX + 1, y: rect.minY + 1))
            flap.addLine(to: CGPoint(x: 0, y: rect.minY + h * 0.5))
            flap.addLine(to: CGPoint(x: rect.maxX - 1, y: rect.minY + 1))
            flap.closeSubpath()
            packet.fill(flap, with: .color(JarPalette.paperBack.color.opacity(0.9 * detail)))
            var words = packet
            words.opacity = detail * 0.85
            let unit = min(1.25, h / 120)
            words.translateBy(x: rect.maxX - 12 * unit, y: rect.maxY - 11 * unit)
            words.scaleBy(x: unit, y: unit)
            let line = JarText.line("just for u", font: JarFonts.hand(21), color: JarPalette.byline)
            JarText.draw(line, in: words, at: CGPoint(x: -JarText.inkWidth(line), y: 0))
        }
        packet.stroke(fold, with: .color(JarPalette.packetFold.color), style: StrokeStyle(lineWidth: max(0.8, min(1.4, 1.1 * k)), lineCap: .round, lineJoin: .round))
        packet.stroke(shape, with: .color(JarPalette.packetStroke.color), lineWidth: max(1, min(1.6, 1.4 * k)))
        // The heart seal sits on the fold's point.
        var seal = packet
        seal.translateBy(x: 0, y: rect.minY + h * 0.5)
        let heartHeight = h * 0.36
        let unit = heartHeight / 42
        seal.scaleBy(x: unit, y: unit)
        seal.translateBy(x: 0, y: 7)
        seal.fill(JarPaths.heart, with: .color(JarPalette.heart.color))
        seal.stroke(JarPaths.heart, with: .color(JarPalette.heartEdge.color), style: StrokeStyle(lineWidth: min(2.5, 1.3 / unit), lineJoin: .round))
        seal.stroke(JarPaths.heartShine, with: .color(JarPalette.heartShine.color), style: StrokeStyle(lineWidth: min(3, 1.6 / unit), lineCap: .round))
    }

    /// A red heart (particles, tags): filled, with the badge's darker edge.
    static func drawHeart(_ context: GraphicsContext, center: CGPoint, height: CGFloat, rotation: Double = 0, opacity: Double = 1, edge: Bool = true) {
        guard opacity > 0.002, height > 0.1 else { return }
        var heart = context
        heart.opacity = opacity
        heart.translateBy(x: center.x, y: center.y)
        heart.rotate(by: .degrees(rotation))
        let unit = height / 42
        heart.scaleBy(x: unit, y: unit)
        heart.translateBy(x: 0, y: 7)
        heart.fill(JarPaths.heart, with: .color(JarPalette.heart.color))
        if edge {
            heart.stroke(JarPaths.heart, with: .color(JarPalette.heartEdge.color), style: StrokeStyle(lineWidth: min(3, 1.1 / unit), lineJoin: .round))
            heart.stroke(JarPaths.heartShine, with: .color(JarPalette.heartShine.color), style: StrokeStyle(lineWidth: min(3.5, 1.4 / unit), lineCap: .round))
        }
    }
}
