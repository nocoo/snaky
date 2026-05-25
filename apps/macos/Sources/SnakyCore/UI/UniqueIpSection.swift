import SwiftUI

struct UniqueIpSection: View {
    let ips: [UniqueIp]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("IP Summary")
                .font(.headline)
                .padding(.bottom, 2)
            ForEach(ips, id: \.ip) { entry in
                HStack {
                    Text(flagEmoji(for: entry.location))
                        .font(.body)
                    Text(entry.ip)
                        .font(.system(.body, design: .monospaced))
                    Spacer()
                    Text("×\(entry.count)")
                        .foregroundStyle(.secondary)
                }
            }
        }
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
