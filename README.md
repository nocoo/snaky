<p align="center">
  <img src="assets/brand/icon-rounded.png" alt="Snaky" width="128" height="128" />
</p>

<h1 align="center">Snaky</h1>

<p align="center"><strong>VPN / 代理分流检查工具</strong><br>查看出口 IP · 测量 HTTP 延迟 · 检查 DNS 解析器</p>

<p align="center">
  <a href="docs/README.en.md">English</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nocoo/snaky"><img src="https://img.shields.io/npm/v/@nocoo/snaky" alt="npm" /></a>
  <a href="https://github.com/nocoo/snaky/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/nocoo/snaky/ci.yml?branch=main" alt="CI" /></a>
  <img src="https://img.shields.io/badge/CLI-macOS%20%7C%20Linux-blue" alt="CLI: macOS and Linux" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22-339933" alt="Node.js >= 22" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

---

## 这是什么

Snaky 把常用站点的出口 IP、HTTP 连接延迟和 DNS 解析器放在一起查看，帮助你核对 VPN 或代理的分流是否符合预期。它提供 CLI 和原生 macOS 菜单栏应用，适合切换网络、修改代理规则后做一次检查，也可以把结果交给脚本处理。

## 功能

- **出口 IP 探测**：读取 Cloudflare trace 或指定 HTTP 响应头，按站点展示出口 IP，并汇总重复 IP；trace 可提供国家/地区和 CDN 节点信息。
- **HTTP 延迟测量**：预热后进行多轮请求，显示成功请求的延迟中位数和各轮结果。
- **DNS 解析器检查**：通过随机域名请求收集解析器出口 IP，按配置的预期范围或地理信息给出判断；依据不足时显示 `inconclusive`。
- **逐步显示结果**：终端 TUI 随探测完成更新；支持静态表格、最终 JSON 和逐事件 NDJSON 输出。
- **可调整的目标与代理**：内置目标按层级和分类组织，自定义目标可增删，目标可启停，支持配置覆盖、重试与备用域名；可自动识别或显式指定 HTTP 代理。
- **macOS 菜单栏**：查看连接延迟、出口 IP 汇总、站点探测和 DNS 检测进度，使用本机安装的 CLI 完成探测。

## 使用

### CLI

需要 Node.js ≥ 22，适用于 macOS 和 Linux。

```bash
npm install -g @nocoo/snaky
snaky --help
snaky split
```

| 命令 | 用途 |
| --- | --- |
| `snaky` | 同时运行连接、分流和 DNS 检查 |
| `snaky split [name...]` | 检查全部或指定站点的出口 IP |
| `snaky connect` | 测量 HTTP 连接延迟 |
| `snaky dns` | 检查 DNS 解析器 |
| `snaky list` | 列出当前启用的目标 |
| `snaky add <name> <domain>` | 添加支持 Cloudflare trace 的站点 |
| `snaky remove <name>` | 移除自定义目标或覆盖项；内置目标用 `disable` 禁用 |
| `snaky disable <name>` / `snaky enable <name>` | 禁用或启用目标 |
| `snaky config path` / `snaky config show` / `snaky config init` | 查看配置路径、生效配置，或创建配置文件 |

常用组合：

```bash
snaky split --tier 2                         # 核心及扩展目标
snaky split --category ai --json             # AI 分类，最终 JSON
snaky split --ndjson                         # 持续输出逐条事件
snaky split --proxy http://127.0.0.1:7890     # 指定 HTTP 代理
snaky split --no-proxy                      # 忽略代理环境变量和系统代理配置
snaky dns --extended                        # 8 轮 DNS 检查
```

默认使用 tier 1 目标。`--timeout <ms>` 调整分流探测超时，`--concurrency <n>` 调整分流探测并发数，`--no-color` 使用无色输出。代理选择顺序为 `--proxy`、代理环境变量、macOS 系统 HTTP(S) 代理；VPN 的系统级路由仍由 VPN 管理。

### macOS 应用

需要 macOS 14 或更新版本，以及已安装的 Node.js 和 Snaky CLI。从 [GitHub Releases](https://github.com/nocoo/snaky/releases/latest) 下载 DMG，将 Snaky 拖入 Applications，再通过 Finder 启动，或运行：

```bash
open /Applications/Snaky.app
```

应用会自动寻找 CLI；未找到时可重新检测或手动选择路径。通过 Finder 或 `open` 启动打包后的应用，以便菜单栏图标正确注册。

### 配置与 DNS 判断

默认配置文件为 `~/.config/snaky/config.json`，可用 `snaky config init` 创建空配置，或通过 `--config <path>` 指定其他文件。配置会与内置目标合并；完整生效值可用 `snaky config show` 查看。

出口 IP 探测和延迟测量无需 API key。若有 Echo API key，可在 `~/.snaky` 中配置，用于补充 IP 的地理位置、运营商信息和 DNS 地理判断：

```json
{
  "echoApiKey": "YOUR_ECHO_API_KEY"
}
```

DNS 检测会请求 `d.echo.nocoo.cloud` 下的随机域名，并从 Echo Collector 获取解析器出口 IP。可在配置的 `dnsLeak.expectedResolvers` 中填写预期的 IPv4 地址或 CIDR，优先按该列表判断。未配置列表时，当前实现依据出口与解析器的中国大陆 / 非中国大陆地理差异做启发式判断，需要 Echo key 和完整地理信息；缺少依据会返回 `inconclusive`。这项结果用于核对当前请求路径，不能覆盖所有应用的 DNS 行为。

## 开发

从仓库根目录执行以下命令。CLI 需要 Node.js ≥ 22 和 pnpm 10.34.4：

```bash
git clone https://github.com/nocoo/snaky.git
cd snaky
pnpm install --frozen-lockfile
pnpm build
node packages/cli/dist/index.js --help
```

`pnpm dev` 监听源码并重新构建；`pnpm lint` 检查代码风格，`pnpm typecheck` 检查 TypeScript 类型。

macOS 部分需要 macOS 14+ 和 Swift 6 工具链。编译命令：

```bash
swift build --package-path apps/macos
```

需要 `.app` 时，使用打包脚本并传入本机可用的签名身份。脚本默认使用维护者的 Apple Development 签名配置：

```bash
bash apps/macos/scripts/build.sh --sign "YOUR_SIGNING_IDENTITY"
open apps/macos/build/release/Snaky.app
```

```text
packages/cli/     CLI、探测引擎、配置和终端输出
apps/macos/       菜单栏应用、CLI 桥接和 Swift 测试
assets/brand/     项目标识资源
scripts/          版本和发布工具
docs/             设计文档与英文 README
```

## 测试

以下命令均从仓库根目录执行：

| 测试层 | 命令 |
| --- | --- |
| CLI 单元测试 | `pnpm test` |
| CLI 端到端测试 | `pnpm build && pnpm test:e2e` |
| macOS 单元测试 | `swift test --package-path apps/macos --skip IntegrationTests` |
| macOS 集成测试 | `swift test --package-path apps/macos --filter IntegrationTests` |

CLI 单元测试包含本地 HTTP 服务和模拟的 DNS 失败场景；端到端测试中的完整运行场景会访问外部探测服务。Swift 测试需要完整 Xcode，且开发者目录指向 Xcode；macOS 集成测试还需要已安装的 CLI 和网络连接，未找到 CLI 时会跳过。可用 `pnpm test:coverage` 生成 CLI 覆盖率报告。

## 技术栈

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Ink](https://img.shields.io/badge/Ink-222222)
![Swift](https://img.shields.io/badge/Swift-F05138?logo=swift&logoColor=white)
![SwiftUI](https://img.shields.io/badge/SwiftUI-007AFF)
![AppKit](https://img.shields.io/badge/AppKit-555555)

| 部分 | 实现 |
| --- | --- |
| CLI | TypeScript、Node.js、Ink / React、Undici |
| macOS 应用 | Swift、SwiftUI、AppKit，使用 Swift Package Manager |
| 构建与开发 | pnpm workspace、tsup、Biome |
| 测试 | Vitest、Swift Testing |

依赖版本以 [CLI package.json](packages/cli/package.json) 和 [Swift Package.swift](apps/macos/Package.swift) 为准。

## 文档

- [文档索引](docs/README.md)
- [TUI 与端点分层设计](docs/architecture/01-tui-overhaul.md)
- [macOS 菜单栏应用设计](docs/features/01-macos-menubar-app.md)
- [DNS 检测设计](docs/features/02-dns-leak-detection.md)
- [变更记录](CHANGELOG.md)

设计文档保留了早期方案和实现过程，部分命令与行为已演进；本 README 描述当前用法。

## 许可证

[MIT](LICENSE) © 2026
