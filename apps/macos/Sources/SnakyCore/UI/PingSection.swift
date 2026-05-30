import SwiftUI

struct PingSection: View {
    let resultsByName: [String: PingResult]
    let history: [String: [PingRoundDot]]
    let isStreaming: Bool

    private let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(
                icon: "waveform.path",
                title: "Connectivity",
                accentColors: [.cyan, .blue]
            )
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(PingTargetRegistry.allTargets, id: \.name) { target in
                    PingCell(
                        targetName: target.name,
                        result: resultsByName[target.name],
                        historyDots: history[target.name] ?? [],
                        isStreaming: isStreaming
                    )
                }
            }
        }
        .card()
    }
}

private struct PingCell: View {
    let targetName: String
    let result: PingResult?
    let historyDots: [PingRoundDot]
    let isStreaming: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                FaviconView(name: targetName, isSuccess: result?.ok ?? true)
                    .frame(width: 16, height: 16)
                Text(Theme.displayName(for: targetName))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                Spacer()
                if let result {
                    let model = PingRowModel(from: result)
                    Text(model.medianText)
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(model.latencyColor.color)
                } else if isStreaming {
                    ProgressView()
                        .controlSize(.mini)
                        .tint(Theme.tertiaryText)
                } else {
                    Text("—")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.tertiaryText)
                }
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
