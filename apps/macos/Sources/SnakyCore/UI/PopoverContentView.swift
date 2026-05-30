import SwiftUI

public struct PopoverContentView: View {
    @ObservedObject var viewModel: AppViewModel
    @ObservedObject var dnsLeakViewModel: DnsLeakViewModel
    @State private var selectedTab: AppTab = .probe

    public init(viewModel: AppViewModel, dnsLeakViewModel: DnsLeakViewModel) {
        self.viewModel = viewModel
        self.dnsLeakViewModel = dnsLeakViewModel
    }

    public var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    headerRow
                    TabPicker(selection: $selectedTab)

                    switch selectedTab {
                    case .probe:
                        probeContent
                    case .dnsLeak:
                        DnsLeakView(viewModel: dnsLeakViewModel)
                    }
                }
                .padding(16)
            }

            if viewModel.cliVersion != nil || viewModel.lastUpdated != nil || viewModel.statusMessage != nil {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [Color.clear, Theme.cardBorder, Color.clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(height: 1)
                HStack(spacing: 6) {
                    Circle()
                        .fill(footerStatusColor)
                        .frame(width: 6, height: 6)
                        .shadow(color: footerStatusColor.opacity(0.5), radius: 2)
                    if let status = viewModel.statusMessage {
                        Text(status)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Theme.secondaryText)
                    } else if let date = viewModel.lastUpdated {
                        Text("Updated \(date, style: .relative) ago")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.tertiaryText)
                    }
                    Spacer()
                    if let version = viewModel.cliVersion {
                        Text("snaky")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Theme.tertiaryText)
                            .textCase(.uppercase)
                            .tracking(0.5)
                        Text("v\(version)")
                            .font(.system(size: 11, weight: .medium, design: .monospaced))
                            .foregroundStyle(Theme.secondaryText)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(Theme.cardBackground)
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
        }
        .frame(width: 451, height: 818)
        .background(Theme.panelBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .onAppear { viewModel.refresh() }
    }

    private var headerRow: some View {
        HStack(alignment: .center, spacing: 10) {
            if let logoURL = Bundle.module.url(forResource: "logo", withExtension: "png", subdirectory: "Resources"),
               let nsImage = NSImage(contentsOf: logoURL) {
                Image(nsImage: nsImage)
                    .resizable()
                    .frame(width: 22, height: 22)
                    .clipShape(RoundedRectangle(cornerRadius: 5))
                    .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
            }
            VStack(alignment: .leading, spacing: 0) {
                Text("Snaky")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Theme.primaryText, Theme.secondaryText],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                Text("Network Probe")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(Theme.tertiaryText)
                    .textCase(.uppercase)
                    .tracking(0.5)
            }
            Spacer()
            if viewModel.state == .loading {
                ProgressView()
                    .controlSize(.mini)
                    .tint(.cyan)
            }
            headerButton(
                icon: viewModel.state == .loading ? "xmark" : "arrow.clockwise",
                colors: [.cyan, .blue]
            ) {
                if viewModel.state == .loading {
                    viewModel.cancel()
                } else {
                    viewModel.refresh()
                }
            }
            headerButton(icon: "power", colors: [.gray.opacity(0.7), .gray.opacity(0.5)]) {
                NSApplication.shared.terminate(nil)
            }
        }
        .padding(.bottom, 4)
    }

    private func headerButton(
        icon: String,
        colors: [Color],
        action: @escaping () -> Void
    ) -> some View {
        let bg = LinearGradient(
            colors: colors,
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        return Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(bg)
                .clipShape(RoundedRectangle(cornerRadius: 7))
                .shadow(color: colors.last?.opacity(0.35) ?? .clear, radius: 4, y: 1)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var loadingView: some View {
        if viewModel.previousResult != nil
            || !viewModel.streamingEntries.isEmpty
            || !viewModel.streamingPing.isEmpty {
            // We are streaming — show whatever we have so far.
            // previousResult is rebuilt by publishLive() each event, so this is fresh data.
            if let live = viewModel.previousResult {
                successView(live)
            }
        } else {
            SkeletonView()
        }
    }

    @ViewBuilder
    private var probeContent: some View {
        switch viewModel.state {
        case .idle:
            ContentUnavailableView("Ready", systemImage: "network", description: Text("Open to refresh"))
        case .loading:
            loadingView
        case .success(let output):
            successView(output)
        case .error(let error):
            if error == .notFound {
                SetupView(onBrowse: { viewModel.selectCLIPath() }, onRedetect: { viewModel.refresh() })
            } else {
                errorBanner(error)
                if let previous = viewModel.previousResult {
                    successView(previous)
                }
            }
        }
    }

    @ViewBuilder
    private func successView(_ output: FullOutput) -> some View {
        PingSection(
            resultsByName: pingResultsByName(output),
            history: viewModel.pingHistory,
            isStreaming: viewModel.pingInFlight
        )
        if let probe = output.split, !probe.uniqueIps.isEmpty {
            UniqueIpSection(ips: deduplicatedIps(probe.uniqueIps))
        }
        if let probe = output.split, !probe.results.isEmpty {
            ProbeSection(
                entries: probe.results,
                enabledTargets: viewModel.enabledProbeTargets,
                onToggle: viewModel.toggleProbeTarget,
                isStreaming: viewModel.probesInFlight
            )
        } else {
            ProbeSection(
                entries: [],
                enabledTargets: viewModel.enabledProbeTargets,
                onToggle: viewModel.toggleProbeTarget,
                isStreaming: viewModel.probesInFlight
            )
        }
    }

    private func deduplicatedIps(_ ips: [UniqueIp]) -> [UniqueIp] {
        var seen = Set<String>()
        return ips.filter { seen.insert($0.ip).inserted }
    }

    private func pingResultsByName(_ output: FullOutput) -> [String: PingResult] {
        var dict: [String: PingResult] = [:]
        for result in output.connect?.results ?? [] {
            dict[result.name] = result
        }
        return dict
    }

    private var footerStatusColor: Color {
        if viewModel.statusMessage != nil { return .orange }
        switch viewModel.state {
        case .loading: return .cyan
        case .success: return .green
        case .error: return .red
        case .idle: return Theme.tertiaryText
        }
    }

    private func errorBanner(_ error: CLIError) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text(errorMessage(error))
                .font(.system(size: 12))
                .foregroundStyle(Theme.primaryText)
            Spacer()
        }
        .padding(10)
        .background(Color.red.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.red.opacity(0.25), lineWidth: 1)
        )
    }

    private func errorMessage(_ error: CLIError) -> String {
        switch error {
        case .notFound:
            "CLI not found"
        case .fatal(let msg):
            msg
        case .crashed(let code):
            "CLI crashed (exit \(code))"
        case .timeout:
            "CLI timed out"
        case .decodingFailed(let msg):
            "Parse error: \(msg)"
        }
    }
}
