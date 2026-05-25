import SwiftUI

struct ProbeSection: View {
    let entries: [ProbeEntry]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Probes")
                .font(.headline)
                .padding(.bottom, 2)
            ForEach(entries, id: \.name) { entry in
                ProbeRow(model: ProbeRowModel(from: entry))
            }
        }
    }
}

private struct ProbeRow: View {
    let model: ProbeRowModel

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: model.isSuccess ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(model.isSuccess ? .green : .red)
                .font(.caption)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text(model.name)
                        .font(.system(.body, design: .monospaced))
                        .lineLimit(1)
                    if model.usedFallback {
                        Text("fallback")
                            .font(.caption2)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(.orange.opacity(0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 3))
                    }
                }
                HStack(spacing: 8) {
                    if model.isSuccess {
                        Text(model.ip)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(model.location)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(model.colo)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text(model.errorCode ?? "ERROR")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
            }
            Spacer()
            Text(model.latencyText)
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(model.latencyColor.color)
        }
        .padding(.vertical, 2)
    }
}
