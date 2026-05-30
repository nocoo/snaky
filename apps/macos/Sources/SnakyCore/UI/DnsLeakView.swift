import SwiftUI

// swiftlint:disable type_body_length

struct DnsLeakView: View {
    @ObservedObject var viewModel: DnsLeakViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
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
        .padding(.bottom, 4)
    }

    // MARK: - Buttons

    private var buttonRow: some View {
        HStack(spacing: 10) {
            primaryButton(
                title: "Quick Test",
                icon: "bolt.fill",
                gradient: Gradient(colors: [.blue.opacity(0.95), .cyan.opacity(0.95)]),
                action: { viewModel.runTest(extended: false) }
            )
            primaryButton(
                title: "Deep Scan",
                icon: "scope",
                gradient: Gradient(colors: [.indigo.opacity(0.95), .purple.opacity(0.95)]),
                action: { viewModel.runTest(extended: true) }
            )
            Spacer(minLength: 0)
        }
    }

    private func primaryButton(
        title: String,
        icon: String,
        gradient: Gradient,
        action: @escaping () -> Void
    ) -> some View {
        let bg = LinearGradient(
            gradient: gradient,
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        return Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .bold))
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(bg)
            .clipShape(Capsule())
            .shadow(color: gradient.stops.last?.color.opacity(0.35) ?? .clear, radius: 6, y: 2)
            .opacity(viewModel.state == .loading ? 0.5 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(viewModel.state == .loading)
    }

    // MARK: - Idle / Loading

    private var idleView: some View {
        let halo = LinearGradient(
            colors: [.cyan.opacity(0.18), .blue.opacity(0.10)],
            startPoint: .top,
            endPoint: .bottom
        )
        let iconGradient = LinearGradient(
            colors: [.cyan, .blue],
            startPoint: .top,
            endPoint: .bottom
        )
        return VStack(spacing: 16) {
            Spacer(minLength: 0)
            ZStack {
                Circle()
                    .fill(halo)
                    .frame(width: 96, height: 96)
                Image(systemName: "shield.lefthalf.filled.badge.checkmark")
                    .font(.system(size: 48, weight: .light))
                    .foregroundStyle(iconGradient)
            }
            VStack(spacing: 6) {
                Text("DNS Leak Test")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.primaryText)
                Text("Verify your DNS queries don't bypass the proxy")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.secondaryText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 300)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, minHeight: 560)
    }

    @ViewBuilder
    private var loadingView: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 0)
            LoadingHaloView()
            VStack(spacing: 8) {
                Text(loadingTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.primaryText)
                if let progress = viewModel.progress {
                    progressDetail(progress)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, minHeight: 560)
    }

    private var loadingTitle: String {
        guard let progress = viewModel.progress else { return "Starting…" }
        switch progress.phase {
        case .fetchingIp: return "Fetching your IP"
        case .sendingQueries: return "Sending DNS queries"
        case .collecting: return "Collecting results"
        case .enriching: return "Enriching resolver info"
        case .other: return progress.message
        }
    }

    @ViewBuilder
    private func progressDetail(_ progress: DnsLeakProgress) -> some View {
        if progress.phase == .sendingQueries,
           let cur = progress.currentRound,
           let total = progress.totalRounds {
            VStack(spacing: 6) {
                Text("Round \(cur) of \(total)")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(Theme.sectionTitle)
                ProgressBar(value: Double(cur) / Double(total))
                    .frame(width: 220, height: 6)
            }
        } else {
            Text(progress.message)
                .font(.system(size: 11))
                .foregroundStyle(Theme.secondaryText)
                .lineLimit(1)
        }
    }

    // MARK: - Result

    @ViewBuilder
    private func resultView(_ output: DnsLeakOutput) -> some View {
        verdictHero(output)

        if let userIp = output.userIp {
            userIpRow(userIp: userIp, code: output.userCountryCode)
        }

        if output.dnsServers.isEmpty {
            emptyResolversView
        } else {
            resolverList(output.dnsServers)
        }
    }

    private func userIpRow(userIp: String, code: String?) -> some View {
        HStack(spacing: 8) {
            Text(Theme.flagEmoji(for: code))
                .font(.system(size: 16))
            VStack(alignment: .leading, spacing: 1) {
                Text("Your IP")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.tertiaryText)
                    .textCase(.uppercase)
                Text(userIp)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(Theme.primaryText)
            }
            Spacer()
            if let code {
                Text(Theme.countryName(for: code) ?? code)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .padding(10)
        .background(Theme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func verdictHero(_ output: DnsLeakOutput) -> some View {
        let palette = VerdictPalette.from(output.verdict)
        let iconBg = LinearGradient(
            colors: palette.iconColors,
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        let cardBg = LinearGradient(
            colors: palette.bgColors,
            startPoint: .leading,
            endPoint: .trailing
        )
        return HStack(spacing: 14) {
            Image(systemName: palette.icon)
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 48, height: 48)
                .background(iconBg)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .shadow(color: palette.iconColors.last?.opacity(0.4) ?? .clear, radius: 8, y: 3)
            VStack(alignment: .leading, spacing: 3) {
                Text(palette.title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.primaryText)
                Text(palette.subtitle(count: output.count))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.secondaryText)
            }
            Spacer()
        }
        .padding(12)
        .background(cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(palette.iconColors.last?.opacity(0.35) ?? .clear, lineWidth: 1)
        )
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
        VStack(spacing: 6) {
            ForEach(Array(servers.enumerated()), id: \.offset) { _, server in
                resolverRow(server)
            }
        }
    }

    private func resolverRow(_ server: DnsServer) -> some View {
        let leakBg = LinearGradient(
            colors: [.red, .pink],
            startPoint: .leading,
            endPoint: .trailing
        )
        return HStack(spacing: 10) {
            Text(Theme.flagEmoji(for: server.countryCode))
                .font(.system(size: 16))
                .frame(width: 22)

            VStack(alignment: .leading, spacing: 2) {
                Text(server.ip)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(Theme.primaryText)
                HStack(spacing: 6) {
                    if let isp = server.isp, !isp.isEmpty, isp != "0" {
                        Text(isp)
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.secondaryText)
                            .lineLimit(1)
                    }
                    if let code = server.countryCode {
                        Text(Theme.countryName(for: code) ?? code)
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
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(leakBg)
                    .clipShape(Capsule())
            } else {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(.green)
                    .font(.system(size: 16))
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Theme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(server.leaked ? Color.red.opacity(0.4) : Color.clear, lineWidth: 1)
        )
    }

    private func errorView(_ error: CLIError) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .font(.system(size: 18))
            Text(errorMessage(error))
                .font(.system(size: 12))
                .foregroundStyle(Theme.primaryText)
            Spacer()
        }
        .padding(12)
        .background(Color.orange.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.orange.opacity(0.35), lineWidth: 1)
        )
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

// swiftlint:enable type_body_length

// MARK: - VerdictPalette

private struct VerdictPalette {
    let icon: String
    let iconColors: [Color]
    let bgColors: [Color]
    let title: String
    let subtitleCount: (Int) -> String

    func subtitle(count: Int) -> String { subtitleCount(count) }

    static func from(_ verdict: DnsLeakVerdict) -> VerdictPalette {
        switch verdict {
        case .noLeak:
            return VerdictPalette(
                icon: "checkmark.shield.fill",
                iconColors: [.green, .mint],
                bgColors: [Color.green.opacity(0.16), Color.mint.opacity(0.08)],
                title: "No DNS Leak",
                subtitleCount: { "\($0) resolver\($0 != 1 ? "s" : "") observed" }
            )
        case .leak:
            return VerdictPalette(
                icon: "exclamationmark.shield.fill",
                iconColors: [.red, .pink],
                bgColors: [Color.red.opacity(0.16), Color.pink.opacity(0.10)],
                title: "DNS Leak Detected",
                subtitleCount: { "\($0) resolver\($0 != 1 ? "s" : "") — see flagged rows" }
            )
        case .inconclusive:
            return VerdictPalette(
                icon: "questionmark.diamond.fill",
                iconColors: [.orange, .yellow],
                bgColors: [Color.orange.opacity(0.14), Color.yellow.opacity(0.08)],
                title: "Inconclusive",
                subtitleCount: { _ in "Unable to determine leak status" }
            )
        }
    }
}

// MARK: - Visual Components

private struct LoadingHaloView: View {
    @State private var rotation: Double = 0
    @State private var pulse: CGFloat = 1.0

    var body: some View {
        let halo = RadialGradient(
            colors: [.cyan.opacity(0.30), .clear],
            center: .center,
            startRadius: 8,
            endRadius: 60
        )
        let arc = AngularGradient(
            gradient: Gradient(colors: [.cyan.opacity(0), .cyan, .blue, .cyan.opacity(0)]),
            center: .center
        )
        let glyph = LinearGradient(
            colors: [.cyan, .blue],
            startPoint: .top,
            endPoint: .bottom
        )
        return ZStack {
            Circle()
                .fill(halo)
                .frame(width: 120, height: 120)
                .scaleEffect(pulse)

            Circle()
                .trim(from: 0.05, to: 0.85)
                .stroke(arc, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .frame(width: 84, height: 84)
                .rotationEffect(.degrees(rotation))

            Image(systemName: "magnifyingglass.circle")
                .font(.system(size: 36, weight: .light))
                .foregroundStyle(glyph)
        }
        .onAppear {
            withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                rotation = 360
            }
            withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true)) {
                pulse = 1.12
            }
        }
    }
}

private struct ProgressBar: View {
    let value: Double  // 0...1

    var body: some View {
        let fill = LinearGradient(
            colors: [.cyan, .blue, .indigo],
            startPoint: .leading,
            endPoint: .trailing
        )
        return GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Theme.cardBackground)
                Capsule()
                    .fill(fill)
                    .frame(width: max(8, geo.size.width * CGFloat(value.clamped(to: 0...1))))
                    .animation(.easeInOut(duration: 0.4), value: value)
            }
        }
    }
}

private extension Comparable {
    func clamped(to limits: ClosedRange<Self>) -> Self {
        return min(max(self, limits.lowerBound), limits.upperBound)
    }
}
