import SwiftUI

struct DnsLeakView: View {
    @ObservedObject var viewModel: DnsLeakViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            buttonRow

            switch viewModel.state {
            case .idle:
                idleView
            case .loading:
                loadingView
            case .success(let output):
                resultView(output)
            case .error(let error):
                errorView(error)
            }
        }
    }

    private var buttonRow: some View {
        HStack(spacing: 8) {
            Button {
                viewModel.runTest()
            } label: {
                Label("Run Test", systemImage: "play.fill")
                    .font(.system(size: 12, weight: .medium))
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.sectionTitle)
            .disabled(viewModel.state == .loading)

            Button {
                viewModel.runTest(extended: true)
            } label: {
                Label("Extended", systemImage: "play.fill")
                    .font(.system(size: 12, weight: .medium))
            }
            .buttonStyle(.bordered)
            .disabled(viewModel.state == .loading)

            if viewModel.state == .loading {
                ProgressView()
                    .controlSize(.mini)
                    .padding(.leading, 4)
            }

            Spacer()
        }
    }

    private var idleView: some View {
        VStack(spacing: 8) {
            Image(systemName: "network.badge.shield.half.filled")
                .font(.system(size: 28))
                .foregroundStyle(Theme.secondaryText)
            Text("Press Run to check for DNS leaks")
                .font(.system(size: 12))
                .foregroundStyle(Theme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }

    private var loadingView: some View {
        VStack(spacing: 8) {
            ProgressView()
                .controlSize(.regular)
            Text("Resolving DNS...")
                .font(.system(size: 12))
                .foregroundStyle(Theme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }

    @ViewBuilder
    private func resultView(_ output: DnsLeakOutput) -> some View {
        if let userIp = output.userIp {
            HStack(spacing: 6) {
                Text(Theme.flagEmoji(for: output.userCountryCode))
                Text("Your IP: \(userIp)")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.primaryText)
                if let code = output.userCountryCode {
                    Text("(\(code))")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.secondaryText)
                }
            }
        }

        verdictBadge(output.verdict, count: output.count)

        if output.dnsServers.isEmpty {
            emptyResolversView
        } else {
            resolverList(output.dnsServers)
        }
    }

    private func verdictBadge(
        _ verdict: DnsLeakVerdict,
        count: Int
    ) -> some View {
        HStack(spacing: 6) {
            Image(systemName: verdictIcon(verdict))
                .foregroundStyle(verdictColor(verdict))
            Text(verdictText(verdict, count: count))
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(verdictColor(verdict))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(verdictColor(verdict).opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private var emptyResolversView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("No DNS resolvers detected")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.primaryText)
            Text("DNS may be encrypted (DoH/DoT) or probe unavailable")
                .font(.system(size: 11))
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func resolverList(_ servers: [DnsServer]) -> some View {
        VStack(spacing: 4) {
            ForEach(Array(servers.enumerated()), id: \.offset) { _, server in
                resolverRow(server)
            }
        }
    }

    private func resolverRow(_ server: DnsServer) -> some View {
        HStack(spacing: 8) {
            Text(Theme.flagEmoji(for: server.countryCode))
                .font(.system(size: 14))

            VStack(alignment: .leading, spacing: 2) {
                Text(server.ip)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(Theme.primaryText)
                HStack(spacing: 4) {
                    if let isp = server.isp {
                        Text(isp)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.secondaryText)
                    }
                    if let code = server.countryCode {
                        Text(code)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.tertiaryText)
                    }
                }
            }

            Spacer()

            if server.leaked {
                Text("LEAK")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.red.opacity(0.8))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .font(.system(size: 14))
            }
        }
        .padding(8)
        .background(Theme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func errorView(_ error: CLIError) -> some View {
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
    }

    // MARK: - Helpers

    private func verdictIcon(_ verdict: DnsLeakVerdict) -> String {
        switch verdict {
        case .noLeak: "checkmark.shield.fill"
        case .leak: "exclamationmark.shield.fill"
        case .inconclusive: "questionmark.diamond.fill"
        }
    }

    private func verdictColor(_ verdict: DnsLeakVerdict) -> Color {
        switch verdict {
        case .noLeak: .green
        case .leak: .red
        case .inconclusive: .orange
        }
    }

    private func verdictText(
        _ verdict: DnsLeakVerdict,
        count: Int
    ) -> String {
        switch verdict {
        case .noLeak:
            "No DNS leak detected (\(count) resolver\(count != 1 ? "s" : ""))"
        case .leak:
            "DNS leak detected!"
        case .inconclusive:
            "Unable to determine leak status"
        }
    }

    private func errorMessage(_ error: CLIError) -> String {
        switch error {
        case .notFound: "CLI not found"
        case .fatal(let msg): msg
        case .crashed(let code): "CLI crashed (exit \(code))"
        case .timeout: "CLI timed out"
        case .decodingFailed(let msg): "Parse error: \(msg)"
        }
    }
}
