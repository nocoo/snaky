import Foundation

public struct ProbeTarget: Sendable {
    public let name: String
    public let category: String
    public let tier: Int
}

public enum ProbeTargetRegistry {
    public static let allTargets: [ProbeTarget] = [
        // domestic
        ProbeTarget(name: "netease", category: "domestic", tier: 1),
        ProbeTarget(name: "bytedance", category: "domestic", tier: 1),
        ProbeTarget(name: "qualcomm-cn", category: "domestic", tier: 1),
        // ai
        ProbeTarget(name: "anthropic", category: "ai", tier: 1),
        ProbeTarget(name: "claude", category: "ai", tier: 1),
        ProbeTarget(name: "chatgpt", category: "ai", tier: 1),
        ProbeTarget(name: "openai", category: "ai", tier: 1),
        ProbeTarget(name: "sora", category: "ai", tier: 1),
        ProbeTarget(name: "grok", category: "ai", tier: 1),
        ProbeTarget(name: "perplexity", category: "ai", tier: 1),
        ProbeTarget(name: "midjourney", category: "ai", tier: 1),
        ProbeTarget(name: "deepseek", category: "ai", tier: 2),
        ProbeTarget(name: "cursor", category: "ai", tier: 2),
        ProbeTarget(name: "poe", category: "ai", tier: 2),
        ProbeTarget(name: "huggingface", category: "ai", tier: 2),
        ProbeTarget(name: "replicate", category: "ai", tier: 2),
        // social
        ProbeTarget(name: "discord", category: "social", tier: 1),
        ProbeTarget(name: "x", category: "social", tier: 1),
        ProbeTarget(name: "medium", category: "social", tier: 1),
        ProbeTarget(name: "reddit", category: "social", tier: 2),
        ProbeTarget(name: "tumblr", category: "social", tier: 2),
        ProbeTarget(name: "telegram", category: "social", tier: 2),
        // crypto
        ProbeTarget(name: "coinbase", category: "crypto", tier: 1),
        ProbeTarget(name: "okx", category: "crypto", tier: 1),
        ProbeTarget(name: "binance", category: "crypto", tier: 2),
        ProbeTarget(name: "kraken", category: "crypto", tier: 2),
        // tools
        ProbeTarget(name: "zoom", category: "tools", tier: 1),
        ProbeTarget(name: "1password", category: "tools", tier: 1),
        ProbeTarget(name: "wise", category: "tools", tier: 1),
        ProbeTarget(name: "godaddy", category: "tools", tier: 1),
        ProbeTarget(name: "producthunt", category: "tools", tier: 1),
        ProbeTarget(name: "notion", category: "tools", tier: 2),
        ProbeTarget(name: "linear", category: "tools", tier: 2),
        ProbeTarget(name: "canva", category: "tools", tier: 2),
        ProbeTarget(name: "figma", category: "tools", tier: 2),
        ProbeTarget(name: "vercel", category: "tools", tier: 2),
        // dev
        ProbeTarget(name: "cloudflare", category: "dev", tier: 1),
        ProbeTarget(name: "cdnjs", category: "dev", tier: 1),
        ProbeTarget(name: "npm", category: "dev", tier: 1),
        ProbeTarget(name: "unpkg", category: "dev", tier: 1),
        ProbeTarget(name: "nodejs", category: "dev", tier: 1),
        ProbeTarget(name: "gitlab", category: "dev", tier: 1),
        ProbeTarget(name: "kali", category: "dev", tier: 1),
        ProbeTarget(name: "bytedance-intl", category: "dev", tier: 1),
        ProbeTarget(name: "docker", category: "dev", tier: 2),
        ProbeTarget(name: "pypi", category: "dev", tier: 2),
        ProbeTarget(name: "crates", category: "dev", tier: 2),
        ProbeTarget(name: "hackernews", category: "dev", tier: 2),
        // media
        ProbeTarget(name: "crunchyroll", category: "media", tier: 1),
        ProbeTarget(name: "spotify", category: "media", tier: 2),
        ProbeTarget(name: "soundcloud", category: "media", tier: 2),
        ProbeTarget(name: "twitch", category: "media", tier: 2),
    ]

    public static let categoryOrder: [String] = [
        "domestic", "ai", "social", "crypto", "tools", "dev", "media",
    ]

    public static let categoryDisplayNames: [String: String] = [
        "domestic": "国内",
        "ai": "AI",
        "social": "社交",
        "crypto": "加密货币",
        "tools": "工具",
        "dev": "开发",
        "media": "流媒体",
    ]

    public static let tier1Names: Set<String> = Set(
        allTargets.filter { $0.tier == 1 }.map(\.name)
    )

    public static func grouped() -> [(category: String, targets: [ProbeTarget])] {
        categoryOrder.compactMap { cat in
            let targets = allTargets
                .filter { $0.category == cat }
                .sorted { $0.tier < $1.tier }
            guard !targets.isEmpty else { return nil }
            return (category: cat, targets: targets)
        }
    }
}
