import SwiftUI
import UIKit
import WidgetKit

// Renders every face of the con widget with ImageRenderer, as the Home Screen and Lock Screen
// would show them: light, dark, tinted (an approximation of iOS 18's accented look; the real one
// is checked on the simulator's Home Screen), StandBy and the Lock Screen's vibrant look.

struct ConLabDevice {
    let name: String
    let scale: CGFloat
    let small: CGSize
    let medium: CGSize
    let large: CGSize
    let circular: CGSize
    let rectangular: CGSize
    let inline: CGSize
    let corner: CGFloat

    func size(_ family: WidgetFamily) -> CGSize {
        switch family {
        case .systemSmall: return small
        case .systemMedium: return medium
        case .systemLarge: return large
        case .accessoryCircular: return circular
        case .accessoryRectangular: return rectangular
        default: return inline
        }
    }

    /// iPhone 11 (414 × 896 pt, @2x): Josh's and Kiriya's size.
    static let iPhone11 = ConLabDevice(name: "iphone11", scale: 2, small: CGSize(width: 169, height: 169),
                                       medium: CGSize(width: 360, height: 169), large: CGSize(width: 360, height: 376),
                                       circular: CGSize(width: 76, height: 76), rectangular: CGSize(width: 160, height: 72),
                                       inline: CGSize(width: 248, height: 26), corner: 21.67)
    /// 6.7" (430 × 932 pt, @3x).
    static let max67 = ConLabDevice(name: "max67", scale: 3, small: CGSize(width: 170, height: 170),
                                    medium: CGSize(width: 364, height: 170), large: CGSize(width: 364, height: 382),
                                    circular: CGSize(width: 76, height: 76), rectangular: CGSize(width: 172, height: 76),
                                    inline: CGSize(width: 257, height: 26), corner: 23)
}

enum ConLabLook: String, CaseIterable {
    case light, dark, tinted, standby
}

/// One widget as it would appear: clipped to the widget's corners, with its background.
struct ConLabTile: View {
    let family: WidgetFamily
    let entry: ConWidgetEntry
    let look: ConLabLook
    let device: ConLabDevice
    var tint = Color(red: 0.80, green: 0.70, blue: 1.0)

    var body: some View {
        let size = device.size(family)
        let moment = ConWidgetMoment(events: entry.feed.events, at: entry.date)
        Group {
            switch family {
            case .accessoryCircular, .accessoryRectangular, .accessoryInline:
                ConWidgetFace(family: family, entry: entry, moment: moment, look: ConWidgetLook(mode: .mono))
                    .foregroundStyle(.white)
                    .environment(\.colorScheme, .dark)
                    .environment(\.widgetRenderingMode, .vibrant)
                    .frame(width: size.width, height: size.height)
            default:
                switch look {
                case .light, .dark:
                    let style = ConWidgetLook(mode: look == .dark ? .dark : .light)
                    ZStack {
                        ConWidgetBackdrop(family: family, look: style)
                        ConWidgetFace(family: family, entry: entry, moment: moment, look: style)
                    }
                    .frame(width: size.width, height: size.height)
                    .clipShape(RoundedRectangle(cornerRadius: device.corner, style: .continuous))
                    .environment(\.colorScheme, look == .dark ? .dark : .light)
                case .tinted:
                    ZStack {
                        RoundedRectangle(cornerRadius: device.corner, style: .continuous)
                            .fill(Color(red: 0.16, green: 0.12, blue: 0.22).opacity(0.72))
                        ConWidgetFace(family: family, entry: entry, moment: moment, look: ConWidgetLook(mode: .mono))
                            .colorMultiply(tint)
                    }
                    .frame(width: size.width, height: size.height)
                    .clipShape(RoundedRectangle(cornerRadius: device.corner, style: .continuous))
                    .environment(\.colorScheme, .dark)
                    .environment(\.widgetRenderingMode, .accented)
                case .standby:
                    ConWidgetFace(family: family, entry: entry, moment: moment, look: ConWidgetLook(mode: .light), framed: false)
                        .frame(width: size.width, height: size.height)
                }
            }
        }
        .environment(\.conWidgetFrozenClock, true)
    }
}

/// A Lock Screen-ish backdrop for the accessory widgets.
struct ConLabLockWall: View {
    var body: some View {
        LinearGradient(colors: [Color(red: 0.32, green: 0.22, blue: 0.45), Color(red: 0.12, green: 0.08, blue: 0.2)],
                       startPoint: .top, endPoint: .bottom)
    }
}

/// A Home Screen-ish backdrop (a soft lilac-to-blue wallpaper), so the widget's edges show.
struct ConLabWall: View {
    var dark = false
    var body: some View {
        LinearGradient(colors: dark ? [Color(red: 0.13, green: 0.12, blue: 0.2), Color(red: 0.05, green: 0.05, blue: 0.1)]
                                    : [Color(red: 0.72, green: 0.78, blue: 0.93), Color(red: 0.86, green: 0.76, blue: 0.9)],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

/// Every face of one scenario on one sheet.
struct ConLabBoard: View {
    let scenario: ConLab.Scenario
    let device: ConLabDevice

    var body: some View {
        let entry = scenario.entry
        VStack(alignment: .leading, spacing: 18) {
            Text("\(scenario.name) — \(scenario.note) · \(device.name)")
                .font(.system(size: 15, weight: .bold, design: .monospaced))
                .foregroundStyle(.black.opacity(0.75))
            ForEach([ConLabLook.light, .dark, .tinted], id: \.self) { look in
                HStack(alignment: .top, spacing: 16) {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack(spacing: 16) {
                            ConLabTile(family: .systemSmall, entry: entry, look: look, device: device)
                            Text(look.rawValue).font(.system(size: 13, weight: .semibold, design: .monospaced))
                                .foregroundStyle(look == .light ? Color.black.opacity(0.6) : Color.white.opacity(0.7))
                        }
                        ConLabTile(family: .systemMedium, entry: entry, look: look, device: device)
                    }
                    ConLabTile(family: .systemLarge, entry: entry, look: look, device: device)
                }
                .padding(16)
                .background(ConLabWall(dark: look != .light))
            }
            HStack(alignment: .center, spacing: 18) {
                ConLabTile(family: .accessoryCircular, entry: entry, look: .light, device: device)
                ConLabTile(family: .accessoryRectangular, entry: entry, look: .light, device: device)
                ConLabTile(family: .accessoryInline, entry: entry, look: .light, device: device)
                ConLabTile(family: .systemSmall, entry: entry, look: .standby, device: device)
                    .scaleEffect(1.0)
                    .padding(8)
                    .background(Color.black)
            }
            .padding(16)
            .background(ConLabLockWall())
        }
        .padding(20)
        .background(Color(white: 0.96))
    }
}

@MainActor
enum ConLabRenderer {
    static func png<V: View>(_ view: V, scale: CGFloat, to url: URL) {
        let renderer = ImageRenderer(content: view)
        renderer.scale = scale
        renderer.isOpaque = false
        guard let image = renderer.uiImage, let data = image.pngData() else {
            print("render failed: \(url.lastPathComponent)")
            return
        }
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: url)
    }

    static func renderAll(to out: URL, only: Set<String>?, tiles: Bool) {
        let families: [(WidgetFamily, String)] = [(.systemSmall, "small"), (.systemMedium, "medium"), (.systemLarge, "large"),
                                                   (.accessoryCircular, "circular"), (.accessoryRectangular, "rect"), (.accessoryInline, "inline")]
        for scenario in ConLab.scenarios where only == nil || only!.contains(scenario.name) {
            for device in [ConLabDevice.iPhone11, .max67] {
                png(ConLabBoard(scenario: scenario, device: device), scale: device.scale == 3 ? 2 : 2,
                    to: out.appendingPathComponent("boards/\(device.name)/\(scenario.name).png"))
                for (family, name) in families where tiles {
                    let home = family == .systemSmall || family == .systemMedium || family == .systemLarge
                    let looks: [ConLabLook] = home ? [.light, .dark, .tinted] : [.light]
                    for look in looks {
                        let tile = ConLabTile(family: family, entry: scenario.entry, look: look, device: device)
                        let framed = Group {
                            if family == .systemSmall || family == .systemMedium || family == .systemLarge {
                                tile.padding(12).background(ConLabWall(dark: look != .light))
                            } else {
                                tile.padding(12).background(ConLabLockWall())
                            }
                        }
                        png(framed, scale: device.scale,
                            to: out.appendingPathComponent("tiles/\(device.name)/\(scenario.name)/\(name)-\(look.rawValue).png"))
                    }
                }
            }
            print("rendered \(scenario.name)")
        }
    }
}
