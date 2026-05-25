import SwiftUI

public struct PopoverContentView: View {
    @ObservedObject var viewModel: AppViewModel

    public init(viewModel: AppViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
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
            .padding()
        }
        .frame(width: 360, height: 600)
        .onAppear { viewModel.refresh() }
    }

    private var headerRow: some View {
        HStack {
            Text("Snaky").font(.headline)
            Spacer()
            if viewModel.state == .loading {
                ProgressView().controlSize(.mini)
            }
            Button(viewModel.state == .loading ? "Cancel" : "Refresh") {
                if viewModel.state == .loading {
                    viewModel.cancel()
                } else {
                    viewModel.refresh()
                }
            }
            .buttonStyle(.borderless)
        }
    }

    @ViewBuilder
    private var loadingView: some View {
        if let previous = viewModel.previousResult {
            successView(previous)
                .opacity(0.6)
        }
    }

    @ViewBuilder
    private func successView(_ output: FullOutput) -> some View {
        if let probe = output.probe {
            if !probe.uniqueIps.isEmpty {
                UniqueIpSection(ips: probe.uniqueIps)
                Divider()
            }
            if !probe.results.isEmpty {
                ProbeSection(entries: probe.results)
                Divider()
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
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
            Text(errorMessage(error))
                .font(.caption)
            Spacer()
        }
        .padding(8)
        .background(.red.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 6))
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
