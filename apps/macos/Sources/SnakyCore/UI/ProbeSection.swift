import SwiftUI

struct ProbeSection: View {
    let entries: [ProbeEntry]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(icon: "arrow.triangle.branch", title: "Probes", badge: "\(entries.count)")
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
        HStack(spacing: 8) {
            Circle()
                .fill(model.isSuccess ? Color.green : Color.red)
                .frame(width: 7, height: 7)

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
                        Text(model.ip)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Theme.secondaryText)
                        Text(model.location)
                            .font(.system(size: 10))
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
        }
        .padding(.vertical, 5)
    }
}
