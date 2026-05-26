import SwiftUI

enum AppTab: String, CaseIterable {
    case probe = "Probe"
    case dnsLeak = "DNS Leak"
}

struct TabPicker: View {
    @Binding var selection: AppTab

    var body: some View {
        HStack(spacing: 4) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        selection = tab
                    }
                } label: {
                    Text(tab.rawValue)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(selection == tab ? Theme.sectionTitle : Theme.secondaryText)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                        .background(
                            selection == tab
                                ? Theme.sectionTitle.opacity(0.15)
                                : Color.clear
                        )
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }
}
