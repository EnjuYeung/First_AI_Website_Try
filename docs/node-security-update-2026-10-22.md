# Node.js 安全更新与部署验证

日期：2026-10-22。项目：Subm；站点：https://okane.zedy.cc 。

## 更新内容

- Dockerfile 的构建与生产阶段从浮动 `node:24-alpine` 固定到 `node:24.22.1-alpine`。
- 已强制拉取基础镜像并执行 `docker compose build --pull app`。
- 基础镜像摘要：`sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53`。
- 线上 Node.js 从 24.22.0 更新至 24.22.1，内置 OpenSSL 为 3.5.9，Undici 为 7.30.1。
- 开发依赖更新至 Vite 6.4.5、Vitest 4.1.12、Undici 7.30.1，保留现有主版本。
- 镜像安装依赖时使用 `--no-audit`，避免审计服务超时阻塞安全版本部署；CI 保留前后端独立 `npm audit --audit-level=high` 检查。
- 将 2026-10-17 已上线但尚未提交的界面重构源码同步纳入版本管理。

本轮运行时更新包含 Brotli 解码器漏洞 CVE-2026-111497 等修复。项目的全局
`express.json()` 位于鉴权前，并默认接受 Brotli 请求体，因此优先更新实际运行的容器。
参见 [Node.js 官方公告](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 更新后的前端测试 | 17 个文件，55 项通过 |
| 后端测试 | 115 项通过 |
| TypeScript 与 Vite 生产构建 | 通过 |
| Docker 生产镜像构建 | 通过，使用 Node.js 24.22.1 |
| 后端依赖审计 | 0 漏洞 |
| 前端依赖审计 | 重试成功，包含开发依赖的完整审计为 0 漏洞 |
| 独立容器 HTTP 检查 | 前端、SPA、API、鉴权、安全头、缓存行为通过 |
| 独立容器 Brotli 检查 | 正常压缩 JSON 可解析并返回预期业务校验错误；未执行漏洞利用载荷 |
| 独立容器 SIGTERM | 正常退出，退出码 143 |
| 线上本机及公网 HTTP 检查 | 均通过 |
| 线上运行状态 | healthy，重启次数 0 |
| 前端产物 | 33 个文件的 SHA-256 与更新前完全一致 |

生产镜像：`sha256:7509d62c5208599d6b020140e88e25e265b25d69aa23861a6cc42fd413223391`。
原镜像保留为 `first_ai_website_try:pre-node-security-20261022`。
验证日志位于本机 `/root/.codex/artifacts/subm-node-security-2026-10-22/`。
前端审计初次复查遇到接口超时，随后使用 npm 官方 registry 重试成功；完整结果保存为
该目录下的 `audit-frontend-retry.json`，所有严重程度的漏洞计数均为 0。

隔离容器使用合成配置和独立临时数据，验证完成后已删除。线上检查仅访问公开页面、
健康接口及未登录鉴权行为；未使用生产账号，未手动修改业务数据或凭据。
生产 `.env`、`Jan/` 与密钥文件均未纳入本次源码提交。
