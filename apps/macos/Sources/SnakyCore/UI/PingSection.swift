import SwiftUI

struct PingSection: View {
    let results: [PingResult]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Ping")
                .font(.headline)
                .padding(.bottom, 2)
            ForEach(results, id: \.name) { result in
                PingRow(model: PingRowModel(from: result))
            }
        }
    }
}

private struct PingRow: View {
    let model: PingRowModel

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: model.isSuccess ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(model.isSuccess ? .green : .red)
                .font(.caption)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(model.name)
                        .font(.system(.body, design: .monospaced))
                        .lineLimit(1)
                    Text(model.tag)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 2) {
                    ForEach(Array(model.dots.enumerated()), id: \.offset) { _, dot in
                        Circle()
                            .fill(dot.isSuccess ? Color.green : Color.red)
                            .frame(width: 5, height: 5)
                    }
                }
            }
            Spacer()
            Text(model.medianText)
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(model.latencyColor.color)
        }
        .padding(.vertical, 2)
    }
}
