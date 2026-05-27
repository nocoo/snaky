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
                    .fill(Theme.cardBorder)
                    .frame(height: 1)
                HStack {
                    if let status = viewModel.statusMessage {
                        Text(status)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.secondaryText)
                    } else if let date = viewModel.lastUpdated {
                        Text("Updated \(date, style: .relative) ago")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.tertiaryText)
                    }
                    Spacer()
                    if let version = viewModel.cliVersion {
                        Text("snaky v\(version)")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.tertiaryText)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
        }
        .frame(width: 451, height: 818)
        .background(Theme.panelBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .onAppear { viewModel.refresh() }
    }

    private var headerRow: some View {
        HStack(alignment: .center) {
            if let logoURL = Bundle.module.url(forResource: "logo", withExtension: "png", subdirectory: "Resources"),
               let nsImage = NSImage(contentsOf: logoURL) {
                Image(nsImage: nsImage)
                    .resizable()
                    .frame(width: 20, height: 20)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            Text("Snaky")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.primaryText)
            Spacer()
            if viewModel.state == .loading {
                ProgressView()
                    .controlSize(.mini)
                    .tint(Theme.sectionTitle)
            }
            Button {
                if viewModel.state == .loading {
                    viewModel.cancel()
                } else {
                    viewModel.refresh()
                }
            } label: {
                Image(systemName: viewModel.state == .loading ? "xmark" : "arrow.clockwise")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.sectionTitle)
                    .frame(width: 26, height: 26)
                    .background(Theme.sectionTitle.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 5))
            }
            .buttonStyle(.plain)
            Button {
                NSApplication.shared.terminate(nil)
            } label: {
                Image(systemName: "power")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(width: 26, height: 26)
                    .background(Theme.secondaryText.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 5))
            }
            .buttonStyle(.plain)
        }
        .padding(.bottom, 4)
    }

    @ViewBuilder
    private var loadingView: some View {
        if let previous = viewModel.previousResult {
            successView(previous)
                .opacity(0.5)
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
        if let ping = output.connect, !ping.results.isEmpty {
            PingSection(results: ping.results, history: viewModel.pingHistory)
        }
        if let probe = output.split, !probe.uniqueIps.isEmpty {
            UniqueIpSection(ips: deduplicatedIps(probe.uniqueIps))
        }
        if let probe = output.split, !probe.results.isEmpty {
            ProbeSection(
                entries: probe.results,
                enabledTargets: viewModel.enabledProbeTargets,
                onToggle: viewModel.toggleProbeTarget
            )
        } else {
            ProbeSection(
                entries: [],
                enabledTargets: viewModel.enabledProbeTargets,
                onToggle: viewModel.toggleProbeTarget
            )
        }
        if output.connect?.results.isEmpty ?? true && output.split == nil {
            ContentUnavailableView(
                "No Endpoints",
                systemImage: "tray",
                description: Text("No endpoints configured")
            )
        }
    }

    private func deduplicatedIps(_ ips: [UniqueIp]) -> [UniqueIp] {
        var seen = Set<String>()
        return ips.filter { seen.insert($0.ip).inserted }
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
