import SwiftUI

// Draws one JarFrame. Pure: everything it shows comes from the frame. The jar, its words and the
// note while it is still inside the jar are one Canvas; the paper is SwiftUI views (it folds in 3D);
// the note in flight and the little hearts are a second Canvas on top.

struct JarScene: View {
    let frame: JarFrame
    let heading: String
    var interactive = true
    var onPull: () -> Void = {}

    var body: some View {
        ZStack(alignment: .topLeading) {
            Canvas(rendersAsynchronously: false) { context, _ in
                drawWords(context)
                drawJar(context)
            }
            .frame(width: frame.width, height: frame.height)
            .accessibilityHidden(true)

            if let old = frame.oldPaper {
                JarPaperView(paper: old).accessibilityHidden(true)
            }
            if let paper = frame.paper {
                JarPaperView(paper: paper).accessibilityHidden(true)
            }

            Canvas(rendersAsynchronously: false) { context, _ in
                drawFlight(context)
                for particle in frame.particles {
                    JarArtist.drawHeart(context, center: particle.center, height: particle.height, rotation: particle.rotation, opacity: particle.opacity)
                }
            }
            .frame(width: frame.width, height: frame.height)
            .allowsHitTesting(false)
            .accessibilityHidden(true)

            if interactive { accessibilityAndTouch }
        }
        .frame(width: frame.width, height: frame.height, alignment: .topLeading)
        .background(alignment: .top) {
            // Reaches past the bottom so a notification still growing to its new height shows lilac, not a gap.
            JarBackdrop(cardHeight: frame.height).frame(height: frame.height + 900).allowsHitTesting(false)
        }
    }

    // MARK: words

    private func drawWords(_ context: GraphicsContext) {
        if let tag = frame.layout.tag, frame.tagOpacity > 0.001 {
            var label = context
            label.opacity = frame.tagOpacity
            label.translateBy(x: tag.rect.midX, y: tag.rect.midY)
            label.rotate(by: .degrees(-2))
            label.translateBy(x: -tag.rect.midX, y: -tag.rect.midY)
            let shape = Path(tag.rect)
            label.fill(shape, with: .color((tag.fresh ? JarPalette.freshFill : JarPalette.tagFill).color))
            label.stroke(Path(tag.rect.insetBy(dx: 0.5, dy: 0.5)), with: .color((tag.fresh ? JarPalette.freshEdge : JarPalette.tagEdge).color),
                         style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
            JarArtist.drawHeart(label, center: tag.heartCenter, height: tag.heartHeight, edge: false)
            JarText.draw(tag.text, in: label, origin: tag.textOrigin, width: tag.textWidth, align: 0.5)
        }
        for (caption, opacity) in frame.captions where opacity > 0.001 {
            var words = context
            words.opacity = opacity
            JarText.draw(caption.text, in: words, origin: caption.origin, width: caption.width, align: caption.align)
        }
    }

    // MARK: the jar

    private func drawJar(_ context: GraphicsContext) {
        let placement = frame.placement
        let pose = frame.pose
        JarArtist.drawBack(context, placement: placement, pose: pose, shadowOpacity: frame.shadowOpacity)
        let toScene = JarArtist.vesselTransform(pose).concatenating(placement.transform)
        if let note = frame.attached {
            // Inside the glass, behind the other notes and the bow.
            var inside = context
            inside.clip(to: JarPaths.body.applying(toScene))
            drawAttached(inside, note: note, toScene: toScene)
        }
        JarArtist.drawFront(context, placement: placement, pose: pose, labelLine: frame.labelLine)
        JarArtist.drawLid(context, placement: placement, pose: pose)
        if let note = frame.attached {
            // Out through the neck: in front of the lid once it's above the mouth.
            var outside = context
            outside.clip(to: Path(CGRect(x: -3000, y: -3000, width: 6360, height: 3121)).applying(toScene))
            drawAttached(outside, note: note, toScene: toScene)
        }
        JarArtist.drawCharms(context, placement: placement, pose: pose, opacity: frame.charmsOpacity, countLine: frame.countLine)
    }

    private func drawAttached(_ context: GraphicsContext, note: JarAttachedNote, toScene: CGAffineTransform) {
        var packet = context
        let center = note.center.applying(toScene)
        let scale = frame.placement.scale * note.scale
        packet.translateBy(x: center.x, y: center.y)
        packet.rotate(by: .degrees(note.rotation + frame.pose.rotation))
        JarArtist.drawPacket(packet, size: CGSize(width: 58 * scale, height: 43 * scale))
    }

    private func drawFlight(_ context: GraphicsContext) {
        guard let flying = frame.flying else { return }
        var packet = context
        packet.translateBy(x: flying.center.x, y: flying.center.y)
        packet.rotate(by: .degrees(flying.rotation))
        // Its shadow comes from its outline only (and ends as the paper's own shadow, for a seamless hand-over).
        let outline = Path(CGRect(x: -flying.size.width / 2, y: -flying.size.height / 2, width: flying.size.width, height: flying.size.height))
        packet.drawLayer { layer in
            layer.addFilter(.shadow(color: JarPalette.paperShadow.color.opacity(flying.shadow), radius: JarPaperView.shadowRadius * CGFloat(flying.lift), x: 0,
                                    y: JarPaperView.shadowY * CGFloat(flying.lift)))
            layer.fill(outline, with: .color(JarPalette.packet.color))
        }
        JarArtist.drawPacket(packet, size: flying.size)
    }

    // MARK: accessibility and touch

    private var accessibilityAndTouch: some View {
        ZStack(alignment: .topLeading) {
            if let tag = frame.layout.tag, frame.tagOpacity > 0.5 {
                Rectangle().fill(Color.clear)
                    .frame(width: tag.rect.width, height: tag.rect.height)
                    .offset(x: tag.rect.minX, y: tag.rect.minY)
                    .accessibilityElement()
                    .accessibilityLabel(Text(JarText.headingWithoutHearts(heading)))
                    .accessibilityAddTraits(.isHeader)
                    .accessibilitySortPriority(4)
                    .allowsHitTesting(false)
            }
            if let paper = frame.paper, let note = frame.note, paper.flat {
                let size = paper.layout.size
                Rectangle().fill(Color.clear)
                    .frame(width: size.width, height: size.height)
                    .offset(x: paper.origin.x, y: paper.origin.y)
                    .accessibilityElement()
                    .accessibilityLabel(Text(JarScene.spoken(note)))
                    .accessibilitySortPriority(3)
                    .allowsHitTesting(false)
            }
            Button {
                if !frame.isPulling { onPull() }
            } label: {
                Rectangle().fill(Color.clear).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .frame(width: frame.jarHit.width, height: frame.jarHit.height)
            .offset(x: frame.jarHit.minX, y: frame.jarHit.minY)
            .accessibilityLabel(Text("Pull a note from the jar"))
            .accessibilityValue(Text(frame.hint))
            .accessibilitySortPriority(2)
            ForEach(Array(frame.captions.enumerated()), id: \.offset) { _, item in
                if item.1 > 0.5 {
                    let caption = item.0
                    Rectangle().fill(Color.clear)
                        .frame(width: caption.width, height: max(1, caption.height))
                        .offset(x: caption.origin.x, y: caption.origin.y)
                        .accessibilityElement()
                        .accessibilityLabel(Text(caption.string))
                        .accessibilitySortPriority(1)
                        .allowsHitTesting(false)
                }
            }
        }
        .frame(width: frame.width, height: frame.height, alignment: .topLeading)
    }

    static func spoken(_ note: JarPulledNote) -> String {
        var parts: [String] = []
        if let label = note.label, !label.isEmpty { parts.append(label + ".") }
        parts.append("hey, u.")
        parts.append(note.text)
        if !note.byline.isEmpty { parts.append(note.byline) }
        if note.isPreview { parts.append("A preview: her jar is untouched.") }
        return parts.joined(separator: " ")
    }
}

/// The card's own background, the lilac family of the site's jar section (works under a dark system UI too).
struct JarBackdrop: View {
    var cardHeight: CGFloat

    var body: some View {
        LinearGradient(stops: [
            .init(color: JarPalette.cardTop.color, location: 0),
            .init(color: JarPalette.cardMid.color, location: min(0.6, 260 / max(cardHeight + 900, 1))),
            .init(color: JarPalette.cardBottom.color, location: min(0.95, cardHeight / max(cardHeight + 900, 1))),
            .init(color: JarPalette.cardBottom.color, location: 1),
        ], startPoint: .top, endPoint: .bottom)
    }
}

// MARK: - The paper

/// The pulled note's paper: the app's .note-jar__paper (cream, a fine border, the offset sheet behind
/// it, washi tape on top), which unfolds downward panel by panel from the folded letter.
struct JarPaperView: View {
    let paper: JarPaperFrame
    static let shadowOpacity = 0.11, shadowRadius: CGFloat = 9, shadowY: CGFloat = 7

    private var size: CGSize { paper.layout.size }
    private var panelHeight: CGFloat { paper.layout.panelHeight }

    /// The height of the paper that lies flat so far (for its shadow and the sheet behind it).
    private var extent: CGFloat {
        let ph = panelHeight
        let n = paper.layout.panels
        if paper.flat { return size.height }
        var height = ph
        let first = n == 2 ? size.height - ph : ph
        if paper.fold1 < 90 { height += first * CGFloat(cos(paper.fold1 * .pi / 180)) }
        if n == 3, paper.fold1 <= 0.0001, paper.fold2 < 90 { height += (size.height - 2 * ph) * CGFloat(cos(paper.fold2 * .pi / 180)) }
        return height
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // .note-jar__paper's box-shadow: 0 7px 18px #60436512, 4px 4px 0 #f3e8f1.
            Rectangle()
                .fill(JarPalette.paperSheet.color)
                .frame(width: size.width, height: extent)
                .offset(x: 4, y: 4)
                .opacity(paper.sheet)
            Rectangle()
                .fill(JarPalette.paper.color)
                .frame(width: size.width, height: extent)
                .shadow(color: JarPalette.paperShadow.color.opacity(Self.shadowOpacity), radius: Self.shadowRadius, x: 0, y: Self.shadowY)
            if paper.flat {
                JarPaperFace(layout: paper.layout)
            } else {
                panels
            }
            tape
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .rotationEffect(.degrees(paper.rotation))
        .offset(x: paper.origin.x + paper.offset.width, y: paper.origin.y + paper.offset.height)
        .opacity(paper.opacity)
    }

    @ViewBuilder private var panels: some View {
        let ph = panelHeight
        ZStack(alignment: .topLeading) {
            slice(top: 0, height: ph)
            if paper.layout.panels == 2 {
                let rest = size.height - ph
                flap(front: slice(top: ph, height: rest), back: JarPacketFace(size: CGSize(width: size.width, height: rest)), angle: paper.fold1, height: rest)
                    .offset(y: ph)
            } else if paper.fold1 > 0.0001 {
                // The middle and bottom panels swing down together (the bottom one still folded in).
                flap(front: JarPaperBack(), back: JarPacketFace(size: CGSize(width: size.width, height: ph)), angle: paper.fold1, height: ph)
                    .offset(y: ph)
            } else {
                let rest = size.height - 2 * ph
                slice(top: ph, height: ph).offset(y: ph)
                flap(front: slice(top: 2 * ph, height: rest), back: JarPaperBack(), angle: paper.fold2, height: rest)
                    .offset(y: 2 * ph)
            }
        }
    }

    private func slice(top: CGFloat, height: CGFloat) -> some View {
        JarPaperFace(layout: paper.layout)
            .frame(width: size.width, height: size.height)
            .offset(y: -top)
            .frame(width: size.width, height: height, alignment: .top)
            .clipped()
    }

    /// A panel hinged on its top edge: 180° lies folded up over the panel above, 0° hangs open.
    private func flap<Front: View, Back: View>(front: Front, back: Back, angle: Double, height: CGFloat) -> some View {
        let turned = angle > 90
        return ZStack {
            front.opacity(turned ? 0 : 1)
            back.scaleEffect(x: 1, y: -1).opacity(turned ? 1 : 0)
            // It darkens a touch as it turns edge-on.
            JarPalette.paperShadow.color.opacity(0.10 * sin(angle * .pi / 180))
        }
        .frame(width: size.width, height: height)
        .rotation3DEffect(.degrees(angle), axis: (x: 1, y: 0, z: 0), anchor: .top, anchorZ: 0, perspective: 0.42)
    }

    @ViewBuilder private var tape: some View {
        if paper.tape > 0.001 {
            let p = paper.tape
            let settle = JarTimeline.outBack(p, 1.3)
            JarTape()
                .fill(JarPalette.tape.color)
                .frame(width: 100, height: 28)
                .scaleEffect(1 + 0.32 * (1 - settle))
                .rotationEffect(.degrees(-4 - 9 * (1 - JarTimeline.outCubic(p))))
                .offset(x: size.width / 2 - 50, y: -13 - 10 * (1 - JarTimeline.outCubic(p)))
                .opacity(JarTimeline.smooth(p * 2.2))
        }
    }
}

/// The front of the paper: the note as the app writes it.
struct JarPaperFace: View {
    let layout: JarPaperLayout

    var body: some View {
        Canvas(rendersAsynchronously: false) { context, size in
            let rect = CGRect(origin: .zero, size: size)
            context.fill(Path(rect), with: .color(JarPalette.paper.color))
            // The creases it was folded along.
            for index in 1..<layout.panels {
                let y = layout.panelHeight * CGFloat(index)
                // A faint valley: a soft shade just above the fold, a hairline, and a little light below it.
                context.fill(Path(CGRect(x: 1, y: y - 4, width: size.width - 2, height: 4)),
                             with: .linearGradient(Gradient(colors: [JarPalette.crease.color.opacity(0), JarPalette.crease.color.opacity(0.22)]),
                                                   startPoint: CGPoint(x: 0, y: y - 4), endPoint: CGPoint(x: 0, y: y)))
                context.fill(Path(CGRect(x: 1, y: y - 0.25, width: size.width - 2, height: 0.5)), with: .color(JarPalette.crease.color.opacity(0.75)))
                context.fill(Path(CGRect(x: 1, y: y + 0.25, width: size.width - 2, height: 0.75)), with: .color(Color.white.opacity(0.8)))
            }
            context.stroke(Path(rect.insetBy(dx: 0.5, dy: 0.5)), with: .color(JarPalette.paperBorder.color), lineWidth: 1)
            let x = layout.inset, width = size.width - layout.inset * 2
            if let label = layout.label {
                JarText.draw(label, in: context, origin: CGPoint(x: x, y: layout.labelTop), width: width)
            }
            if let hello = layout.salutation {
                JarText.draw(hello, in: context, origin: CGPoint(x: x, y: layout.salutationTop), width: width)
            }
            JarText.draw(layout.message, in: context, origin: CGPoint(x: x, y: layout.messageTop), width: width)
            if let more = layout.more {
                JarText.draw(more, in: context, origin: CGPoint(x: x, y: layout.moreTop), width: width)
            }
            if let byline = layout.byline {
                JarText.draw(byline, in: context, origin: CGPoint(x: x, y: layout.bylineTop), width: width)
            }
        }
        .frame(width: layout.size.width, height: layout.size.height)
    }
}

/// The back of the paper.
struct JarPaperBack: View {
    var body: some View {
        Rectangle()
            .fill(JarPalette.paperBack.color)
            .overlay(Rectangle().strokeBorder(JarPalette.paperBorder.color, lineWidth: 1))
    }
}

/// The outside of the folded letter: the jar note's envelope fold and red heart seal.
struct JarPacketFace: View {
    let size: CGSize

    var body: some View {
        Canvas(rendersAsynchronously: false) { context, canvas in
            var packet = context
            packet.translateBy(x: canvas.width / 2, y: canvas.height / 2)
            JarArtist.drawPacket(packet, size: canvas)
        }
        .frame(width: size.width, height: size.height)
    }
}

/// Washi tape with torn ends (.note-jar__tape's clip-path).
struct JarTape: Shape {
    func path(in rect: CGRect) -> Path {
        let points: [(CGFloat, CGFloat)] = [(0.02, 0), (0.98, 0), (1, 0.13), (0.98, 0.26), (1, 0.42), (0.98, 0.59), (1, 0.78), (0.98, 1),
                                            (0.02, 1), (0, 0.85), (0.02, 0.68), (0, 0.53), (0.02, 0.36), (0, 0.17)]
        var path = Path()
        path.addLines(points.map { CGPoint(x: rect.minX + rect.width * $0.0, y: rect.minY + rect.height * $0.1) })
        path.closeSubpath()
        return path
    }
}
