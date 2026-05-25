import SwiftUI

enum Theme {
    static let panelBackground = Color(red: 0.05, green: 0.06, blue: 0.09)
    static let cardBackground = Color(red: 0.10, green: 0.12, blue: 0.16)
    static let cardBorder = Color.white.opacity(0.06)
    static let sectionTitle = Color(red: 0.30, green: 0.82, blue: 0.77)
    static let badgeBackground = Color(red: 0.35, green: 0.30, blue: 0.15)
    static let badgeText = Color(red: 0.85, green: 0.72, blue: 0.35)
    static let primaryText = Color.white.opacity(0.92)
    static let secondaryText = Color.white.opacity(0.55)
    static let tertiaryText = Color.white.opacity(0.35)

    static func flagEmoji(for location: String?) -> String {
        guard let location, location.count == 2 else { return "🌐" }
        let base: UInt32 = 127_397
        let chars = location.uppercased().unicodeScalars.compactMap {
            Unicode.Scalar(base + $0.value)
        }
        return String(chars.map { Character($0) })
    }

    // swiftlint:disable:next cyclomatic_complexity function_body_length
    static func displayName(for key: String) -> String {
        let stripped = key.hasPrefix("ping-") ? String(key.dropFirst(5)) : key
        switch stripped {
        case "netease": return "网易"
        case "bytedance", "bytedance-intl": return "字节跳动"
        case "qualcomm-cn": return "高通中国"
        case "taobao": return "淘宝"
        case "wechat": return "微信"
        case "anthropic": return "Anthropic"
        case "claude": return "Claude"
        case "chatgpt": return "ChatGPT"
        case "openai": return "OpenAI"
        case "sora": return "Sora"
        case "grok": return "Grok"
        case "perplexity": return "Perplexity"
        case "midjourney": return "Midjourney"
        case "deepseek": return "DeepSeek"
        case "cursor": return "Cursor"
        case "poe": return "Poe"
        case "huggingface": return "Hugging Face"
        case "replicate": return "Replicate"
        case "discord": return "Discord"
        case "x": return "X"
        case "medium": return "Medium"
        case "reddit": return "Reddit"
        case "tumblr": return "Tumblr"
        case "telegram": return "Telegram"
        case "coinbase": return "Coinbase"
        case "okx": return "OKX"
        case "binance": return "Binance"
        case "kraken": return "Kraken"
        case "zoom": return "Zoom"
        case "1password": return "1Password"
        case "wise": return "Wise"
        case "godaddy": return "GoDaddy"
        case "producthunt": return "Product Hunt"
        case "notion": return "Notion"
        case "linear": return "Linear"
        case "canva": return "Canva"
        case "figma": return "Figma"
        case "vercel": return "Vercel"
        case "cloudflare": return "Cloudflare"
        case "cdnjs": return "cdnjs"
        case "npm": return "npm"
        case "unpkg": return "unpkg"
        case "nodejs": return "Node.js"
        case "gitlab": return "GitLab"
        case "github": return "GitHub"
        case "kali": return "Kali"
        case "docker": return "Docker"
        case "pypi": return "PyPI"
        case "crates": return "crates.io"
        case "hackernews": return "Hacker News"
        case "crunchyroll": return "Crunchyroll"
        case "spotify": return "Spotify"
        case "soundcloud": return "SoundCloud"
        case "twitch": return "Twitch"
        case "youtube": return "YouTube"
        default: return stripped
        }
    }
}

struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(12)
            .background(Theme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Theme.cardBorder, lineWidth: 1)
            )
    }
}

extension View {
    func card() -> some View {
        modifier(CardModifier())
    }
}

struct Badge: View {
    let text: String
    var color: Color = Theme.badgeText
    var background: Color = Theme.badgeBackground

    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .medium, design: .monospaced))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

struct SectionHeader: View {
    let icon: String
    let title: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.sectionTitle)
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.sectionTitle)
            Spacer()
        }
    }
}
