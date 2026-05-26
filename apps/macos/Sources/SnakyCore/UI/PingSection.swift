import SwiftUI

struct PingSection: View {
    let results: [PingResult]
    var history: [String: [PingRoundDot]] = [:]

    private let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(icon: "waveform.path", title: "Ping")
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(results, id: \.name) { result in
                    PingCell(
                        model: PingRowModel(from: result),
                        historyDots: history[result.name] ?? []
                    )
                }
            }
        }
        .card()
    }
}

private struct PingCell: View {
    let model: PingRowModel
    let historyDots: [PingRoundDot]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                FaviconView(name: model.name, isSuccess: model.isSuccess)
                    .frame(width: 16, height: 16)
                Text(Theme.displayName(for: model.name))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                Spacer()
                Text(model.medianText)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(model.latencyColor.color)
            }

            if !historyDots.isEmpty {
                HStack(spacing: 2) {
                    ForEach(historyDots.indices, id: \.self) { idx in
                        Circle()
                            .fill(LatencyColor.from(ms: historyDots[idx].ms).color)
                            .frame(width: 4, height: 4)
                    }
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Theme.cardBackground.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}
