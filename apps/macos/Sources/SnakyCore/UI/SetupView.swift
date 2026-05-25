import SwiftUI

struct SetupView: View {
    var onBrowse: () -> Void = {}
    var onRedetect: () -> Void = {}

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(.yellow)

            Text("Snaky CLI Not Found")
                .font(.headline)

            Text("Install the CLI to use this app:")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            GroupBox {
                Text("npm install -g @nocoo/snaky")
                    .font(.system(.body, design: .monospaced))
                    .textSelection(.enabled)
            }

            HStack(spacing: 12) {
                Button("Browse...") { onBrowse() }
                Button("Re-detect") { onRedetect() }
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
