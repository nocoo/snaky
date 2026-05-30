import type { CftraceEndpoint, HttpHeaderEndpoint, PingTarget } from "./types.js";

export const BUILTIN_ENDPOINTS: (CftraceEndpoint | HttpHeaderEndpoint)[] = [
  // domestic
  { name: "netease", method: "http-header", url: "https://necaptcha.nosdn.127.net/ab7f4275c1744aa28e0a8f3a1c58c532.png", headers: ["cdn-user-ip"], category: "domestic", tier: 1 },
  { name: "bytedance", method: "http-header", url: "https://perfops.byte-test.com/500b-bench.jpg", headers: ["x-request-ip", "x-response-cinfo"], category: "domestic", tier: 1 },
  { name: "qualcomm-cn", method: "cftrace", domain: "www.qualcomm.cn", category: "domestic", tier: 1 },
  // ai
  { name: "anthropic", method: "cftrace", domain: "anthropic.com", category: "ai", tier: 1 },
  { name: "claude", method: "cftrace", domain: "claude.ai", category: "ai", tier: 1 },
  { name: "chatgpt", method: "cftrace", domain: "chatgpt.com", category: "ai", tier: 1 },
  { name: "openai", method: "cftrace", domain: "openai.com", category: "ai", tier: 1 },
  { name: "sora", method: "cftrace", domain: "sora.com", category: "ai", tier: 1 },
  { name: "grok", method: "cftrace", domain: "grok.com", category: "ai", tier: 1 },
  { name: "perplexity", method: "cftrace", domain: "www.perplexity.ai", category: "ai", tier: 1 },
  { name: "midjourney", method: "cftrace", domain: "midjourney.com", category: "ai", tier: 1 },
  // social
  { name: "discord", method: "cftrace", domain: "discord.com", fallbackDomain: "gateway.discord.gg", category: "social", tier: 1 },
  { name: "x", method: "cftrace", domain: "x.com", category: "social", tier: 1 },
  { name: "medium", method: "cftrace", domain: "medium.com", category: "social", tier: 1 },
  // crypto
  { name: "coinbase", method: "cftrace", domain: "coinbase.com", category: "crypto", tier: 1 },
  { name: "okx", method: "cftrace", domain: "www.okx.com", category: "crypto", tier: 1 },
  // tools
  { name: "zoom", method: "cftrace", domain: "zoom.us", category: "tools", tier: 1 },
  { name: "1password", method: "cftrace", domain: "1password.com", category: "tools", tier: 1 },
  { name: "wise", method: "cftrace", domain: "wise.com", category: "tools", tier: 1 },
  { name: "godaddy", method: "cftrace", domain: "godaddy.com", category: "tools", tier: 1 },
  { name: "producthunt", method: "cftrace", domain: "producthunt.com", category: "tools", tier: 1 },
  // dev
  { name: "cloudflare", method: "cftrace", domain: "www.cloudflare.com", category: "dev", tier: 1 },
  { name: "cdnjs", method: "cftrace", domain: "cdnjs.cloudflare.com", category: "dev", tier: 1 },
  { name: "npm", method: "cftrace", domain: "registry.npmjs.org", category: "dev", tier: 1 },
  { name: "unpkg", method: "cftrace", domain: "unpkg.com", category: "dev", tier: 1 },
  { name: "nodejs", method: "cftrace", domain: "nodejs.org", category: "dev", tier: 1 },
  { name: "gitlab", method: "cftrace", domain: "gitlab.com", category: "dev", tier: 1 },
  { name: "kali", method: "cftrace", domain: "kali.download", category: "dev", tier: 1 },
  { name: "bytedance-intl", method: "http-header", url: "https://perfops2.byte-test.com/500b-bench.jpg", headers: ["x-request-ip", "x-response-cinfo"], category: "dev", tier: 1 },
  // media
  { name: "crunchyroll", method: "cftrace", domain: "crunchyroll.com", category: "media", tier: 1 },
  // extended — ai
  { name: "deepseek", method: "cftrace", domain: "www.deepseek.com", category: "ai", tier: 2 },
  { name: "poe", method: "cftrace", domain: "poe.com", category: "ai", tier: 2 },
  { name: "replicate", method: "cftrace", domain: "replicate.com", category: "ai", tier: 2 },
  // extended — tools
  { name: "notion", method: "cftrace", domain: "www.notion.so", category: "tools", tier: 2 },
  { name: "linear", method: "cftrace", domain: "linear.app", category: "tools", tier: 2 },
  { name: "canva", method: "cftrace", domain: "www.canva.com", category: "tools", tier: 2 },
  // extended — dev
  { name: "docker", method: "cftrace", domain: "hub.docker.com", category: "dev", tier: 2 },
  // extended — crypto
  { name: "kraken", method: "cftrace", domain: "www.kraken.com", category: "crypto", tier: 2 },
];

export const BUILTIN_PING_TARGETS: PingTarget[] = [
  { name: "ping-bytedance", url: "https://perfops.byte-test.com/500b-bench.jpg", tag: "domestic", tier: 1 },
  { name: "ping-taobao", url: "https://www.taobao.com/favicon.ico", tag: "domestic", tier: 1 },
  { name: "ping-wechat", url: "https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico", tag: "domestic", tier: 1 },
  { name: "ping-github", url: "https://github.com/generate_204", tag: "international", tier: 1 },
  { name: "ping-cloudflare", url: "https://1.1.1.1/cdn-cgi/trace", tag: "international", tier: 1 },
  { name: "ping-youtube", url: "https://www.youtube.com/generate_204", tag: "international", tier: 1 },
];
