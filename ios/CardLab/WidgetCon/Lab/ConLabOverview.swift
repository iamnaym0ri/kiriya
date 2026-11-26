import SwiftUI
import WidgetKit

// One picture of the whole widget for Josh: every state, every size, light, dark, tinted and the
// Lock Screen, at iPhone 11 size.

struct ConLabOverviewSheet: View {
    let device = ConLabDevice.iPhone11

    private func entry(_ name: String) -> ConWidgetEntry { ConLab.scenario(name)!.entry }

    private func caption(_ text: String, dark: Bool = false) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .foregroundStyle(dark ? Color.white.opacity(0.75) : Color(red: 0.31, green: 0.18, blue: 0.39).opacity(0.8))
    }

    private func labelled<V: View>(_ text: String, dark: Bool = false, @ViewBuilder _ content: () -> V) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            content()
            caption(text, dark: dark)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Next con · the ticket widget")
                    .font(ConWidgetFonts.hand(34))
                    .foregroundStyle(Color(red: 0.31, green: 0.18, blue: 0.39))
                Text("iPhone 11 sizes · the countdown changes with the distance and ticks live · sample data: Singapore's 2026 cons")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(Color(red: 0.46, green: 0.35, blue: 0.57))
            }
            // Small: the journey.
            HStack(alignment: .top, spacing: 14) {
                ForEach([("far", "10 days out"), ("near", "tomorrow: live clock"), ("today", "day one"), ("ongoing", "day 2 of 3"),
                         ("ended", "the day after → next"), ("none", "nothing booked")], id: \.0) { name, text in
                    labelled(text) { ConLabTile(family: .systemSmall, entry: entry(name), look: .light, device: device) }
                }
            }
            // Medium.
            HStack(alignment: .top, spacing: 14) {
                labelled("medium · far") { ConLabTile(family: .systemMedium, entry: entry("far"), look: .light, device: device) }
                labelled("medium · tomorrow (ticking)") { ConLabTile(family: .systemMedium, entry: entry("near"), look: .light, device: device) }
                labelled("medium · day 2 of 3") { ConLabTile(family: .systemMedium, entry: entry("ongoing"), look: .light, device: device) }
            }
            HStack(alignment: .top, spacing: 14) {
                labelled("medium · the day after") { ConLabTile(family: .systemMedium, entry: entry("ended"), look: .light, device: device) }
                labelled("medium · a 5-week exhibition") { ConLabTile(family: .systemMedium, entry: entry("exhibition"), look: .light, device: device) }
                labelled("medium · nothing booked") { ConLabTile(family: .systemMedium, entry: entry("none"), look: .light, device: device) }
            }
            // Large, light / dark / tinted.
            HStack(alignment: .top, spacing: 14) {
                labelled("large · far, with the next three") { ConLabTile(family: .systemLarge, entry: entry("far"), look: .light, device: device) }
                labelled("large · dark mode, con day", dark: true) { ConLabTile(family: .systemLarge, entry: entry("today"), look: .dark, device: device) }
                labelled("large · tinted (approximation)", dark: true) { ConLabTile(family: .systemLarge, entry: entry("ongoing"), look: .tinted, device: device) }
            }
            .padding(14)
            .background(LinearGradient(colors: [Color(red: 0.86, green: 0.82, blue: 0.95), Color(red: 0.16, green: 0.12, blue: 0.22), Color(red: 0.1, green: 0.08, blue: 0.14)],
                                       startPoint: .leading, endPoint: .trailing))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            // Dark and tinted smalls, StandBy, Lock Screen.
            HStack(alignment: .top, spacing: 14) {
                labelled("dark · tomorrow", dark: true) { ConLabTile(family: .systemSmall, entry: entry("near"), look: .dark, device: device) }
                labelled("dark · ended → next", dark: true) { ConLabTile(family: .systemSmall, entry: entry("ended"), look: .dark, device: device) }
                labelled("tinted · far", dark: true) { ConLabTile(family: .systemSmall, entry: entry("far"), look: .tinted, device: device) }
                labelled("StandBy", dark: true) { ConLabTile(family: .systemSmall, entry: entry("today"), look: .standby, device: device) }
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 12) {
                        ConLabTile(family: .accessoryCircular, entry: entry("far"), look: .light, device: device)
                        ConLabTile(family: .accessoryCircular, entry: entry("near"), look: .light, device: device)
                        ConLabTile(family: .accessoryCircular, entry: entry("ongoing"), look: .light, device: device)
                    }
                    ConLabTile(family: .accessoryRectangular, entry: entry("near"), look: .light, device: device)
                    ConLabTile(family: .accessoryRectangular, entry: entry("ongoing"), look: .light, device: device)
                    caption("Lock Screen: ring + rectangular", dark: true)
                }
            }
            .padding(14)
            .background(Color(red: 0.1, green: 0.07, blue: 0.14))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .padding(26)
        .background(Color(red: 0.97, green: 0.95, blue: 0.98))
    }
}

@MainActor
enum ConLabOverview {
    static func render(to out: URL) {
        ConLabRenderer.png(ConLabOverviewSheet(), scale: 2, to: out.appendingPathComponent("overview.png"))
    }
}
