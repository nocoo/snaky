import SwiftUI

struct PingSection: View {
    let results: [PingResult]

    private let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(icon: "waveform.path", title: "Ping")
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(results, id: \.name) { result in
                    PingCell(model: PingRowModel(from: result))
                }
            }
        }
        .card()
    }
}

private struct PingCell: View {
    let model: PingRowModel

    var body: some View {
        HStack(spacing: 6) {
            FaviconView(name: model.name, isSuccess: model.isSuccess)
                .frame(width: 16, height: 16)
            Text(displayName)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(Theme.primaryText)
                .lineLimit(1)
            Spacer()
            Text(model.medianText)
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(model.latencyColor.color)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Theme.cardBackground.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private var displayName: String {
        model.name.hasPrefix("ping-") ? String(model.name.dropFirst(5)) : model.name
    }
}
