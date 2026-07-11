# Subm

家庭使用的轻量订阅管理工具，支持订阅记录、支出分析、汇率换算和 Telegram/邮件提醒。

## 要求

- Node.js 22.13 或更高版本（容器与 CI 使用 Node.js 24 LTS）
- npm 10 或更高版本
- Docker Compose（仅容器部署需要）

## 本地开发

1. 准备后端配置：

   ```bash
   cp server/.env.example server/.env
   ```

   修改 `server/.env`，至少设置 `ADMIN_USER`、`ADMIN_PASS`、`JWT_SECRET` 和
   `DATA_ENCRYPTION_KEY`。可分别用 `openssl rand -base64 48` 生成两个密钥。

2. 启动后端：

   ```bash
   cd server
   npm ci
   npm start
   ```

3. 在另一个终端启动前端：

   ```bash
   npm ci
   npm run dev
   ```

4. 打开 `http://127.0.0.1:3000`。Vite 会把 `/api` 代理到
   `http://127.0.0.1:3001`。若后端地址不同，可设置 `VITE_API_PROXY_TARGET`。

## Docker Compose

配置文件必须位于 `server/.env`，然后运行：

```bash
docker compose up -d --build
```

前端入口为 `http://localhost:3001`。后端只暴露在 Compose 私有网络，由 Nginx
代理 `/api`，不会默认映射到宿主机端口。

生产域名应通过逗号分隔的 `ALLOWED_ORIGINS` 明确配置；Telegram Webhook 还应设置
HTTPS `PUBLIC_BASE_URL`。`TRUST_PROXY` 默认仅信任回环及私有网络，适配本仓库的
Nginx → 后端拓扑。

## 环境变量

必填项：

- `ADMIN_USER`
- `ADMIN_PASS`：12–128 位，包含大写、小写、数字和符号
- `JWT_SECRET`：至少 32 个字符
- `DATA_ENCRYPTION_KEY`：至少 32 个字符，必须长期保存

首次启动后，`ADMIN_USER` 会写入持久凭据。后续若环境值与持久值不一致，服务会拒绝
启动，避免调度器静默切换到另一套空数据；改名需要显式迁移。

常用可选项：

- `PORT`（默认 `3001`）
- `ALLOWED_ORIGINS`（逗号分隔的完整 Origin）
- `TRUST_PROXY`
- `PUBLIC_BASE_URL`
- `NOTIFY_INTERVAL_MS`（默认 `600000`）
- `JSON_BODY_LIMIT`（默认 `2mb`）
- `MAX_ICON_BYTES`（默认 `1mb`）
- `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`
- `DEBUG_TELEGRAM=1`（仅排障使用；日志会脱敏 token）

## 验证

```bash
npm test
npm run type-check
npm run build

cd server
npm test
npm run test:coverage
```

CI 会执行前后端测试、生产构建、依赖审计，并拒绝跟踪真实 `.env` 或私钥文件。

## 数据存储

- 用户数据位于 `server/data/users/<user>/`，按订阅、通知和设置分文件保存。
- 写 API 使用 revision/`If-Match` 防止并发覆盖。
- 通知历史保留最近 90 天。
- 数据目录权限为 `0700`，JSON、凭据和密钥文件权限为 `0600`。
- 汇率 API Key 使用 AES-256-GCM 加密。丢失 `DATA_ENCRYPTION_KEY` 后无法解密已有
  API Key；该密钥不得与数据备份放在一起。

安全事件和密钥误提交处理见 [SECURITY.md](./SECURITY.md)。
