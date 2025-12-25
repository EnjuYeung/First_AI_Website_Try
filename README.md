# 项目介绍

家庭使用的轻量订阅管理工具，支持订阅记录、支出分析和TG通知功能。

<mark>纯AI实现</mark>

## 部署 (Deployment)

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
