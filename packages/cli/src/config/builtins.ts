import type { CftraceEndpoint, HttpHeaderEndpoint, PingTarget } from "./types.js";

export const BUILTIN_ENDPOINTS: (CftraceEndpoint | HttpHeaderEndpoint)[] = [
  // domestic
  { name: "netease", method: "http-header", url: "https://necaptcha.nosdn.127.net/ab7f4275c1744aa28e0a8f3a1c58c532.png", headers: ["cdn-user-ip"], category: "domestic" },
  { name: "bytedance", method: "http-header", url: "https://perfops.byte-test.com/500b-bench.jpg", headers: ["x-request-ip", "x-response-cinfo"], category: "domestic" },
  { name: "qualcomm-cn", method: "cftrace", domain: "www.qualcomm.cn", category: "domestic" },
  // ai
  { name: "anthropic", method: "cftrace", domain: "anthropic.com", category: "ai" },
  { name: "claude", method: "cftrace", domain: "claude.ai", category: "ai" },
  { name: "chatgpt", method: "cftrace", domain: "chatgpt.com", category: "ai" },
  { name: "openai", method: "cftrace", domain: "openai.com", category: "ai" },
  { name: "sora", method: "cftrace", domain: "sora.com", category: "ai" },
  { name: "grok", method: "cftrace", domain: "grok.com", category: "ai" },
  { name: "perplexity", method: "cftrace", domain: "www.perplexity.ai", category: "ai" },
  { name: "midjourney", method: "cftrace", domain: "midjourney.com", category: "ai" },
  // social
  { name: "discord", method: "cftrace", domain: "discord.com", fallbackDomain: "gateway.discord.gg", category: "social" },
  { name: "x", method: "cftrace", domain: "x.com", category: "social" },
  { name: "medium", method: "cftrace", domain: "medium.com", category: "social" },
  // crypto
  { name: "coinbase", method: "cftrace", domain: "coinbase.com", category: "crypto" },
  { name: "okx", method: "cftrace", domain: "www.okx.com", category: "crypto" },
  // tools
  { name: "zoom", method: "cftrace", domain: "zoom.us", category: "tools" },
  { name: "1password", method: "cftrace", domain: "1password.com", category: "tools" },
  { name: "wise", method: "cftrace", domain: "wise.com", category: "tools" },
  { name: "godaddy", method: "cftrace", domain: "godaddy.com", category: "tools" },
  { name: "producthunt", method: "cftrace", domain: "producthunt.com", category: "tools" },
  // dev
  { name: "cloudflare", method: "cftrace", domain: "www.cloudflare.com", category: "dev" },
  { name: "cdnjs", method: "cftrace", domain: "cdnjs.cloudflare.com", category: "dev" },
  { name: "npm", method: "cftrace", domain: "registry.npmjs.org", category: "dev" },
  { name: "unpkg", method: "cftrace", domain: "unpkg.com", category: "dev" },
  { name: "nodejs", method: "cftrace", domain: "nodejs.org", category: "dev" },
  { name: "gitlab", method: "cftrace", domain: "gitlab.com", category: "dev" },
  { name: "kali", method: "cftrace", domain: "kali.download", category: "dev" },
  { name: "bytedance-intl", method: "http-header", url: "https://perfops2.byte-test.com/500b-bench.jpg", headers: ["x-request-ip", "x-response-cinfo"], category: "dev" },
  // media
  { name: "crunchyroll", method: "cftrace", domain: "crunchyroll.com", category: "media" },
];

export const BUILTIN_PING_TARGETS: PingTarget[] = [
  { name: "ping-bytedance", url: "https://perfops.byte-test.com/500b-bench.jpg", tag: "domestic" },
  { name: "ping-taobao", url: "https://www.taobao.com/favicon.ico", tag: "domestic" },
  { name: "ping-wechat", url: "https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico", tag: "domestic" },
  { name: "ping-github", url: "https://github.com/generate_204", tag: "international" },
  { name: "ping-cloudflare", url: "https://1.1.1.1/cdn-cgi/trace", tag: "international" },
  { name: "ping-youtube", url: "https://www.youtube.com/generate_204", tag: "international" },
];
