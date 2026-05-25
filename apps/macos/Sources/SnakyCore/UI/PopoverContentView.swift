import SwiftUI

public struct PopoverContentView: View {
    @ObservedObject var viewModel: AppViewModel

    public init(viewModel: AppViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                headerRow
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
            .padding(16)
            .padding(.bottom, 40)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .frame(width: 380, height: 620)
        .background(Theme.panelBackground)
        .onAppear { viewModel.refresh() }
        .safeAreaInset(edge: .bottom) {
            if viewModel.cliVersion != nil || viewModel.lastUpdated != nil || viewModel.statusMessage != nil {
                VStack(spacing: 0) {
                    Rectangle()
                        .fill(Theme.cardBorder)
                        .frame(height: 1)
                    HStack {
                        if let status = viewModel.statusMessage {
                            Text(status)
                                .font(.system(size: 10))
                                .foregroundStyle(Theme.secondaryText)
                        } else if let date = viewModel.lastUpdated {
                            Text("Updated \(date, style: .relative) ago")
                                .font(.system(size: 10))
                                .foregroundStyle(Theme.tertiaryText)
                        }
                        Spacer()
                        if let version = viewModel.cliVersion {
                            Text("snaky v\(version)")
                                .font(.system(size: 10))
                                .foregroundStyle(Theme.tertiaryText)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Theme.panelBackground)
                }
            }
        }
    }

    private var headerRow: some View {
        HStack(alignment: .center) {
            Image(systemName: "network")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.sectionTitle)
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
                Text(viewModel.state == .loading ? "Cancel" : "Refresh")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.sectionTitle)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Theme.sectionTitle.opacity(0.12))
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
        }
    }

    @ViewBuilder
    private func successView(_ output: FullOutput) -> some View {
        if let probe = output.probe {
            if !probe.uniqueIps.isEmpty {
                UniqueIpSection(ips: probe.uniqueIps)
            }
            if !probe.results.isEmpty {
                ProbeSection(entries: probe.results)
            }
        }
        if let ping = output.ping, !ping.results.isEmpty {
            PingSection(results: ping.results)
        }
        if output.probe?.results.isEmpty ?? true && output.ping?.results.isEmpty ?? true {
            ContentUnavailableView(
                "No Endpoints",
                systemImage: "tray",
                description: Text("No endpoints configured")
            )
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
