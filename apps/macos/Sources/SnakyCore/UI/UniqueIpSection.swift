import SwiftUI

struct UniqueIpSection: View {
    let ips: [UniqueIp]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(icon: "globe", title: "IP Summary")
            VStack(spacing: 6) {
                ForEach(ips, id: \.ip) { entry in
                    HStack(spacing: 8) {
                        Text(Theme.flagEmoji(for: entry.location))
                            .font(.system(size: 14))
                        Text(entry.ip)
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .foregroundStyle(Theme.primaryText)
                        Spacer()
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .card()
    }
}
