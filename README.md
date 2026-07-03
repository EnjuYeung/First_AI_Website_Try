# 项目介绍

家庭使用的轻量订阅管理工具，支持订阅记录、支出分析和TG通知功能。

<mark>纯AI实现</mark>

## 部署

### 本地运行 (开发模式)
**前置要求：** Node.js

1. **安装依赖**：`npm install`
2. **前端启动**：`npm run dev`
3. **后端启动**（进入 `server/`）：`npm install && npm start`

---

### Docker-Compose 部署
1. **创建配置文件** 新建 `.env` 文件。

2. **配置环境变量**
   * **必填项**（缺少将导致启动报错）：
     * `ADMIN_USER` / `ADMIN_PASS`
     * `JWT_SECRET`
     * `DATA_ENCRYPTION_KEY`（用于 AES-256-GCM 加密 API Key，可用 `openssl rand -base64 32` 生成）
     * `ADMIN_PASS` 必须为 12–128 位，并包含大写、小写、数字和符号
     * `JWT_SECRET` 与 `DATA_ENCRYPTION_KEY` 均不得少于 32 个字符
   * **可选项**（按需启用）：
     * `PORT`（默认 `3001`）
     * `NOTIFY_INTERVAL_MS`（默认 `600000`，即10分钟）
     * `JSON_BODY_LIMIT`（默认2mb）
     * `MAX_ICON_BYTES`（默认1mb）
     * `PUBLIC_BASE_URL`（Telegram Webhook 建议配置）
     * **邮件通知 (SMTP)**：
       > `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
     * `DEBUG_TELEGRAM`（设为 `1` 开启日志）

3. **启动**
   ```bash
   docker-compose up -d --build
   ```

## 数据存储

- 用户数据按功能保存到 `server/data/users/<user>/`：
  - `subscriptions.json`
  - `notifications.json`
  - `settings.json`
- 旧版 `server/data/<user>.json` 会在首次启动时原子迁移，确认分区文件写入后删除。
- 每个分区文件都有独立 `revision`；写 API 使用 `If-Match`，版本不一致返回 `409 revision_conflict`。
- 通知历史自动保留最近 90 天。
- 数据目录权限为 `0700`，JSON、凭据及密钥文件权限为 `0600`。
- 汇率 API Key 使用 `DATA_ENCRYPTION_KEY` 进行 AES-256-GCM 加密。该环境变量必须长期保存且不得与数据文件一同备份；丢失后无法解密已有 API Key。
