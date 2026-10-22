# Subm

家庭使用的轻量订阅管理工具，支持订阅记录、支出分析、汇率换算和 Telegram/邮件提醒。

## 界面与费用口径

- 概览优先展示月度、年度费用估算与待处理账单；手机账单列表无需横向拖动。
- 订阅支持搜索、筛选、排序、卡片/表格切换、批量操作与只读详情。
- 新增/编辑的核心信息前置、选填项折叠，手机保存按钮固定在底部。
- 支出统计展示本月分类金额与扣费分布，与概览共用原有账期汇总。
- 支持浅色、深色、系统跟随与四套强调色；沿用本地字体和 Lucide。

费用基于当前价格、汇率和日历账期估算，并非支付流水。自动续订状态没有对应数据，
详情明确显示“未记录”；订阅提醒偏好仍需配合全局规则和通知渠道才能发送。
设计规范见 [MASTER.md](design-system/subm/MASTER.md)。

## 要求

- 推荐 Node.js 24.22.1 或更新的 24.x 安全版本（容器与 CI 使用 Node.js 24 LTS）
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

本机 Compose 使用项目根目录的 `.env`（可从 `server/.env.example` 复制）。设置 `ALLOWED_ORIGINS=http://127.0.0.1:33001`；通过反向代理访问时改为实际站点域名。然后运行：

```bash
docker compose up -d --build
```

Dockerfile 的构建和运行阶段均固定使用 `node:24.22.1-alpine`，包含 2026-10-21
发布的 Node.js 安全修复。更新运行时时需同步修改两处基础镜像版本，并强制获取
基础镜像后重建、替换容器；仅重启现有容器不会更新 Node.js：

```bash
docker compose build --pull app
docker compose up -d --no-build app
docker compose exec -T app node --version
```

应用入口为 `http://127.0.0.1:33001`。一个 `subm` 容器运行单个 Node 进程，同时提供
前端、`/api` 和后台任务；端口仅绑定宿主机回环地址。

生产反向代理配置见 [`deploy/openresty.conf`](./deploy/openresty.conf)。将其包含在现有
站点的 `server` 块中，替换该站点原有的代理 location；域名、TLS 和证书继续由外层
OpenResty 管理。模板保留 9 MiB 总请求上限，以及 API 连接 5 秒、相邻上游响应读取
间隔 30 秒超时。网关生成的错误响应也包含安全响应头。直接运行应用仍有 JSON 和
上传文件自身的大小限制，完整生产网关约束需要同时配置这份模板。

生产域名应通过逗号分隔的 `ALLOWED_ORIGINS` 明确配置。
`TRUST_PROXY` 默认仅信任回环及私有网络，适配外层 OpenResty → Node 拓扑。
如果自行配置数字代理跳数，需要按实际路径调整，避免信任客户端伪造的转发头。

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
- `NOTIFY_INTERVAL_MS`（默认 `600000`）
- `TIMEZONE`（IANA 时区，默认 `Asia/Shanghai`）
- `JSON_BODY_LIMIT`（默认 `2mb`）
- `MAX_ICON_BYTES`（默认 `1mb`）
- `MAX_WALLPAPER_BYTES`（默认 `8mb`）
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
另构建统一容器，以合成配置验证静态文件、SPA、API、鉴权、安全头及缓存行为。

## 数据存储

- 用户数据位于 `server/data/users/<user>/`，按订阅、通知和设置分文件保存。
- 写 API 使用 revision/`If-Match` 防止并发覆盖。
- 通知历史保留最近 90 天。
- 数据目录权限为 `0700`，JSON、凭据和密钥文件权限为 `0600`。
- 汇率 API Key 使用 AES-256-GCM 加密。丢失 `DATA_ENCRYPTION_KEY` 后无法解密已有
  API Key；该密钥不得与数据备份放在一起。

安全事件和密钥误提交处理见 [SECURITY.md](./SECURITY.md)。

### Telegram 通知按钮

启用 Telegram 通知并填写 Bot Token、Chat ID 后，后台自动长轮询接收按钮操作，无需公网回调地址或额外前端配置。续订提醒提供“已续订”和“已弃用”按钮：前者保持生效中并推进一个账期，后者停用订阅并停止后续账单。按服务端 `TIMEZONE`（默认 Asia/Shanghai）的账单日结束后，未操作的生效中订阅自动推进账单，通知反馈自动记为已续订。已处理或过期按钮不会再次修改订阅。

后台启动及更换 Telegram 配置时会移除该 Bot 的旧 webhook（保留待处理更新）。同一 Bot 应仅由一个本项目后端实例接收更新，避免与其他机器人程序的 webhook / getUpdates 冲突。续订测试消息提供“测试续订 / 测试弃用”按钮，点击后在 Telegram 弹出提示并将原消息更新为测试结果、移除按钮，不修改真实订阅。月度汇总测试不含按钮。

### 本机 Compose 部署约定

`docker compose up -d --build` 构建统一镜像 `first_ai_website_try:latest` 并启动 `app`
服务。当前 Compose 从 `/opt/1panel/apps/First_AI_Website_Try/.env` 加载环境变量，并将
该目录下的 `Jan/` 挂载为 `/app/server/data`；迁移目录时请同步修改两个绝对路径。
入口保持 `http://127.0.0.1:33001`，容器内部端口为 `3001`。`Jan/` 已从 Git 和 Docker
构建上下文排除，源码修改不会自动重启已有容器。容器健康检查同时验证 API 与前端入口。

从原双容器版本升级时，先构建并验证新镜像，保存旧 Compose 与代理配置用于失败回退，
再停止 `subm-backend` 和 `subm-web`，确认旧后台已退出后启动新服务。确认站点代理模板
已生效，并完成公网验证后，清理旧容器和镜像。失败回退也须先停止新后台。整个过程中
同一 `Jan` 目录只能有一个后台实例写入或轮询 Telegram；不支持并行滚动升级或多 worker。

仪表盘和月度汇总按当前价格、当前汇率及推算账期估算支出，不代表历史支付流水。缺失汇率的订阅保留原币金额，并在美元合计旁提示未计入数量。

模块职责、设置更新协议与存储兼容约定见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
