import SwiftUI

enum AppTab: String, CaseIterable {
    case probe = "Probe"
    case dnsLeak = "DNS Leak"

    var icon: String {
        switch self {
        case .probe: return "arrow.triangle.branch"
        case .dnsLeak: return "shield.lefthalf.filled"
        }
    }

    var accentColors: [Color] {
        switch self {
        case .probe: return [.indigo, .purple]
        case .dnsLeak: return [.cyan, .blue]
        }
    }
}

struct TabPicker: View {
    @Binding var selection: AppTab

    var body: some View {
        HStack(spacing: 4) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) {
                        selection = tab
                    }
                } label: {
                    tabLabel(tab, selected: selection == tab)
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    @ViewBuilder
    private func tabLabel(_ tab: AppTab, selected: Bool) -> some View {
        let activeBg = LinearGradient(
            colors: tab.accentColors,
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        HStack(spacing: 5) {
            Image(systemName: tab.icon)
                .font(.system(size: 10, weight: .bold))
            Text(tab.rawValue)
                .font(.system(size: 11, weight: .semibold))
        }
        .foregroundStyle(selected ? .white : Theme.secondaryText)
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        .background(
            ZStack {
                if selected {
                    activeBg
                } else {
                    Color.white.opacity(0.04)
                }
            }
        )
        .clipShape(Capsule())
        .shadow(
            color: selected ? (tab.accentColors.last?.opacity(0.35) ?? .clear) : .clear,
            radius: 4,
            y: 1
        )
    }
}
