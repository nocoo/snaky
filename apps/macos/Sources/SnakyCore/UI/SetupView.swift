import SwiftUI

struct SetupView: View {
    var onBrowse: () -> Void = {}
    var onRedetect: () -> Void = {}

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36, weight: .light))
                .foregroundStyle(.orange)

            Text("Snaky CLI Not Found")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.primaryText)

            Text("Install the CLI to use this app:")
                .font(.system(size: 12))
                .foregroundStyle(Theme.secondaryText)

            Text("npm install -g @nocoo/snaky")
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundStyle(Theme.sectionTitle)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Theme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Theme.cardBorder, lineWidth: 1)
                )
                .textSelection(.enabled)

            HStack(spacing: 12) {
                Button("Browse...") { onBrowse() }
                    .buttonStyle(ThemedButtonStyle())
                Button("Re-detect") { onRedetect() }
                    .buttonStyle(ThemedPrimaryButtonStyle())
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct ThemedButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Theme.secondaryText)
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(Theme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Theme.cardBorder, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.7 : 1.0)
    }
}

private struct ThemedPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Theme.sectionTitle)
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .background(Theme.sectionTitle.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Theme.sectionTitle.opacity(0.3), lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.7 : 1.0)
    }
}
