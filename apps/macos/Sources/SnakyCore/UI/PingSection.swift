import SwiftUI

struct PingSection: View {
    let results: [PingResult]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(icon: "waveform.path", title: "Ping", badge: "\(results.count)")
            VStack(spacing: 2) {
                ForEach(results, id: \.name) { result in
                    PingRow(model: PingRowModel(from: result))
                }
            }
        }
        .card()
    }
}

private struct PingRow: View {
    let model: PingRowModel

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Circle()
                .fill(model.isSuccess ? Color.green : Color.red)
                .frame(width: 7, height: 7)
                .offset(y: 4)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(model.name)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(Theme.primaryText)
                        .lineLimit(1)
                    Badge(text: model.tag)
                }
                HStack(spacing: 2) {
                    ForEach(Array(model.dots.enumerated()), id: \.offset) { _, dot in
                        let barHeight = dot.isSuccess
                            ? CGFloat(min(max(dot.ms / 30.0, 0.3), 1.0)) * 10
                            : CGFloat(3)
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(dot.isSuccess ? Color.green.opacity(0.8) : Color.red.opacity(0.6))
                            .frame(width: 4, height: barHeight)
                    }
                }
                .frame(height: 10, alignment: .bottom)
            }
            Spacer()
            Text(model.medianText)
                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                .foregroundStyle(model.latencyColor.color)
                .frame(minWidth: 50, alignment: .trailing)
        }
        .padding(.vertical, 5)
    }
}
