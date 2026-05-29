import SwiftUI

struct ProbeSection: View {
    let entries: [ProbeEntry]
    let enabledTargets: Set<String>
    let onToggle: (String) -> Void
    var isStreaming: Bool = false

    private var resultsByName: [String: ProbeEntry] {
        Dictionary(entries.map { ($0.name, $0) }, uniquingKeysWith: { first, _ in first })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(icon: "arrow.triangle.branch", title: "Probes")
            VStack(spacing: 12) {
                ForEach(ProbeTargetRegistry.grouped(), id: \.category) { group in
                    ProbeGroupView(
                        category: group.category,
                        targets: group.targets,
                        resultsByName: resultsByName,
                        enabledTargets: enabledTargets,
                        isStreaming: isStreaming,
                        onToggle: onToggle
                    )
                }
            }
        }
        .card()
    }
}

private struct ProbeGroupView: View {
    let category: String
    let targets: [ProbeTarget]
    let resultsByName: [String: ProbeEntry]
    let enabledTargets: Set<String>
    let isStreaming: Bool
    let onToggle: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(ProbeTargetRegistry.categoryDisplayNames[category] ?? category)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.tertiaryText)
                .textCase(.uppercase)
                .padding(.bottom, 2)

            VStack(spacing: 2) {
                ForEach(targets, id: \.name) { target in
                    let enabled = enabledTargets.contains(target.name)
                    let entry = resultsByName[target.name]
                    ProbeTargetRow(
                        target: target,
                        entry: entry,
                        isEnabled: enabled,
                        isStreaming: isStreaming,
                        onToggle: { onToggle(target.name) }
                    )
                }
            }
        }
    }
}

private struct ProbeTargetRow: View {
    let target: ProbeTarget
    let entry: ProbeEntry?
    let isEnabled: Bool
    let isStreaming: Bool
    let onToggle: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Button(action: onToggle) {
                Image(systemName: isEnabled ? "circle.fill" : "circle")
                    .font(.system(size: 10))
                    .foregroundStyle(isEnabled ? Theme.sectionTitle : Theme.tertiaryText)
            }
            .buttonStyle(.plain)
            .frame(width: 16, height: 16)

            if isEnabled, let entry {
                enabledRow(entry)
            } else {
                Text(Theme.displayName(for: target.name))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                if target.tier == 2 {
                    Badge(text: "T2", color: Theme.tertiaryText, background: Theme.tertiaryText.opacity(0.15))
                }
                Spacer()
                if isEnabled && isStreaming && entry == nil {
                    ProgressView()
                        .controlSize(.mini)
                        .tint(Theme.tertiaryText)
                }
            }
        }
        .padding(.vertical, 4)
        .opacity(isEnabled ? 1.0 : 0.45)
        .animation(.easeInOut(duration: 0.2), value: entry?.ok)
    }

    @ViewBuilder
    private func enabledRow(_ entry: ProbeEntry) -> some View {
        FaviconView(name: entry.name, isSuccess: entry.ok)
            .frame(width: 24, height: 24)

        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                Text(Theme.displayName(for: entry.name))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                if entry.usedFallback {
                    Badge(text: "fallback", color: .orange, background: .orange.opacity(0.15))
                }
            }
            HStack(spacing: 8) {
                if entry.ok {
                    Text(Theme.flagEmoji(for: entry.location == "—" ? nil : entry.location))
                        .font(.system(size: 10))
                    Text(entry.ip ?? "—")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(Theme.secondaryText)
                    Text(entry.colo ?? "—")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.tertiaryText)
                } else {
                    Text(entry.error?.code.rawValue ?? "ERROR")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.red)
                }
            }
        }
        Spacer()
        Text(latencyText(entry))
            .font(.system(size: 12, weight: .semibold, design: .monospaced))
            .foregroundStyle(LatencyColor.from(ms: entry.responseTimeMs).color)
            .frame(minWidth: 50, alignment: .trailing)
    }

    private func latencyText(_ entry: ProbeEntry) -> String {
        if let ms = entry.responseTimeMs {
            return "\(Int(ms))ms"
        }
        return "—"
    }
}
