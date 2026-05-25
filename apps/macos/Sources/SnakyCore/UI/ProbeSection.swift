import SwiftUI

struct ProbeSection: View {
    let entries: [ProbeEntry]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(icon: "arrow.triangle.branch", title: "Probes")
            VStack(spacing: 2) {
                ForEach(entries, id: \.name) { entry in
                    ProbeRow(model: ProbeRowModel(from: entry))
                }
            }
        }
        .card()
    }
}

private struct ProbeRow: View {
    let model: ProbeRowModel

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            FaviconView(name: model.name, isSuccess: model.isSuccess)
                .frame(width: 16, height: 16)
                .offset(y: 1)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(model.name)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(Theme.primaryText)
                        .lineLimit(1)
                    if model.usedFallback {
                        Badge(text: "fallback", color: .orange, background: .orange.opacity(0.15))
                    }
                }
                HStack(spacing: 8) {
                    if model.isSuccess {
                        Text(Theme.flagEmoji(for: model.location == "—" ? nil : model.location))
                            .font(.system(size: 10))
                        Text(model.ip)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Theme.secondaryText)
                        Text(model.colo)
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.tertiaryText)
                    } else {
                        Text(model.errorCode ?? "ERROR")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.red)
                    }
                }
            }
            Spacer()
            Text(model.latencyText)
                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                .foregroundStyle(model.latencyColor.color)
                .frame(minWidth: 50, alignment: .trailing)
        }
        .padding(.vertical, 5)
    }
}
