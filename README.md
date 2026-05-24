<h1 align="center">Snaky</h1>

<p align="center"><strong>VPN 分流路由探测器</strong><br>探测出口 IP · 测量连接延迟 · 验证分流规则</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-blue" alt="platform" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-green" alt="node" />
  <img src="https://img.shields.io/badge/tests-232%20passed-brightgreen" alt="tests" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="license" />
</p>

---

## 这是什么

Snaky 是一个 CLI 工具，用于检测当前网络环境下各站点的出口 IP 和连接延迟。它通过 Cloudflare CDN trace、HTTP 响应头等多种探测方式，帮助你验证 VPN/代理的分流规则是否按预期工作。

```
┌─────────┐     ┌──────────┐     ┌──────────────┐
│  snaky  │────▶│  probes  │────▶│  CF trace    │
│   CLI   │     │  engine  │────▶│  HTTP header │
└─────────┘     └──────────┘────▶│  HTTP ping   │
      │                          └──────────────┘
      ▼
┌──────────┐
│  JSON /  │
│  Table   │
└──────────┘
```

## 功能

### 探测引擎

- **cftrace** — 通过 Cloudflare `/cdn-cgi/trace` 获取出口 IP、地理位置、PoP 节点
- **http-header** — 从 HTTP 响应头（如 `x-real-ip`）提取出口 IP
- **http-ping** — 多轮 HTTP 延迟测量，取中位数，自动预热

### 执行特性

- **并发控制** — 可配置并发数，探测与 ping 并行执行
- **重试与回退** — 指数退避重试，支持 fallback 域名（主域一次机会，备域享有完整重试预算）
- **超时控制** — 每个请求独立超时，AbortSignal 精确终止

### 配置管理

- **内置端点** — 预配置 30+ 常用站点（AI、社交、开发工具、加密货币等）
- **用户自定义** — 添加/删除/启用/禁用端点，支持覆盖内置
- **分类筛选** — 按 category 过滤探测目标

### 输出

- **JSON** — 结构化输出，适合脚本消费和 Swift Decodable 解析
- **彩色表格** — 终端友好的人类可读格式，支持 `--no-color`

## 安装

```bash
# 从源码构建（暂未发布 npm）
git clone https://github.com/nicepkg/snaky.git
cd snaky
pnpm install && pnpm build
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `snaky` | 运行全部：探测 + ping |
| `snaky probe [name...]` | 探测指定端点的出口 IP |
| `snaky ping` | 仅连接延迟测试 |
| `snaky list` | 列出所有端点 |
| `snaky add <name> <domain>` | 添加 cftrace 端点 |
| `snaky remove <name>` | 删除端点 |
| `snaky disable <name>` | 禁用端点 |
| `snaky enable <name>` | 启用端点 |
| `snaky config path` | 输出配置文件路径 |
| `snaky config show` | 输出当前生效配置 |
| `snaky config init` | 创建配置文件 |

| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |
| `--timeout <ms>` | 单次请求超时（默认 5000） |
| `--concurrency <n>` | 最大并发数（默认 10） |
| `--category <cat>` | 按分类过滤 |
| `--config <path>` | 自定义配置文件 |
| `--no-color` | 禁用彩色输出 |

## 项目结构

```
snaky/
├── packages/cli/          # CLI 主包
│   ├── src/
│   │   ├── cli.ts         # 入口，命令调度
│   │   ├── cli/           # 参数解析、退出码
│   │   ├── config/        # 配置加载、校验、变更
│   │   ├── parsers/       # cftrace / header 响应解析
│   │   ├── probes/        # 探测执行（cftrace, header, ping）
│   │   ├── runner/        # 并发编排、多轮 ping
│   │   └── output/        # JSON / 表格格式化
│   ├── tests/e2e/         # 端到端测试
│   └── dist/              # 构建产物
└── apps/                  # macOS 菜单栏应用（规划中）
```

## 技术栈

| 层 | 技术 |
|----|------|
| 运行时 | [Node.js](https://nodejs.org) ≥ 20 |
| 语言 | [TypeScript](https://www.typescriptlang.org) 5.8 (strict) |
| 构建 | [tsup](https://tsup.egoist.dev) (esbuild) |
| 测试 | [Vitest](https://vitest.dev) + v8 coverage |
| 代码规范 | [Biome](https://biomejs.dev) |
| 包管理 | [pnpm](https://pnpm.io) workspace |
| Git hooks | [Husky](https://typicode.github.io/husky) v9 |

## 开发

环境要求：Node.js ≥ 20, pnpm ≥ 9

```bash
pnpm install       # 安装依赖
pnpm build         # 构建 CLI
pnpm dev           # 监听模式构建
```

| 命令 | 说明 |
|------|------|
| `pnpm test` | 运行单元测试 |
| `pnpm test:coverage` | 覆盖率报告（≥95% line, ≥90% branch） |
| `pnpm test:e2e` | 端到端测试 |
| `pnpm lint` | Biome 代码检查 |
| `pnpm typecheck` | TypeScript 类型检查 |

## 测试

| 层 | 内容 | 触发时机 |
|----|------|---------|
| L1 单元测试 | 解析器、配置、探测逻辑 (221 tests) | pre-commit |
| L2 端到端 | 二进制调用、JSON 输出、退出码 (11 tests) | pre-push |
| G1 静态检查 | tsc --noEmit + biome check | pre-commit |

## License

[MIT](LICENSE) © 2026
