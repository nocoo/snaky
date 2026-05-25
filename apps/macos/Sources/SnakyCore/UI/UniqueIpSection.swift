import SwiftUI

struct UniqueIpSection: View {
    let ips: [UniqueIp]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(icon: "globe", title: "IP Summary", badge: "\(ips.count) IPs")
            VStack(spacing: 6) {
                ForEach(ips, id: \.ip) { entry in
                    HStack(spacing: 8) {
                        Text(flagEmoji(for: entry.location))
                            .font(.system(size: 14))
                        Text(entry.ip)
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .foregroundStyle(Theme.primaryText)
                        Spacer()
                        Badge(text: "×\(entry.count)")
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .card()
    }

    private func flagEmoji(for location: String?) -> String {
        guard let location, location.count == 2 else { return "🌐" }
        let base: UInt32 = 127_397
        let chars = location.uppercased().unicodeScalars.compactMap {
            Unicode.Scalar(base + $0.value)
        }
        return String(chars.map { Character($0) })
    }
}
