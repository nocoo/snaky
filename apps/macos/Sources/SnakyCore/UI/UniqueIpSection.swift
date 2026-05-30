import SwiftUI

struct UniqueIpSection: View {
    let ips: [UniqueIp]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(
                icon: "globe",
                title: "IP Summary",
                accentColors: [.green, .mint]
            )
            VStack(spacing: 6) {
                ForEach(ips, id: \.ip) { entry in
                    ipRow(entry)
                }
            }
        }
        .card()
    }

    private func ipRow(_ entry: UniqueIp) -> some View {
        let code = entry.detail?.countryCode ?? entry.location
        let flag = Theme.flagEmoji(for: code)

        return HStack(spacing: 8) {
            Text(flag)
                .font(.system(size: 14))
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.ip)
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(Theme.primaryText)
                Text(secondaryLine(entry, code: code))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.secondaryText)
                    .lineLimit(1)
            }
            Spacer()
            if let asn = entry.detail?.asn {
                Badge(text: "AS\(asn)")
            }
        }
        .padding(.vertical, 2)
    }

    private func secondaryLine(_ entry: UniqueIp, code: String?) -> String {
        if let detail = entry.detail {
            let line = detailLine(detail)
            if !line.isEmpty { return line }
        }
        // Fallback when echo enrichment unavailable: derive from country code
        var parts: [String] = []
        if let name = Theme.countryName(for: code) { parts.append(name) }
        if entry.count > 1 { parts.append("\(entry.count) hits") }
        return parts.isEmpty ? "—" : parts.joined(separator: " · ")
    }

    private func detailLine(_ detail: IpDetail) -> String {
        var parts: [String] = []
        let loc = [detail.country, detail.province, detail.city]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
        if !loc.isEmpty { parts.append(loc) }
        if let isp = detail.isp, !isp.isEmpty { parts.append(isp) }
        return parts.joined(separator: " — ")
    }
}
