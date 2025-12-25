# 一句话介绍

家庭使用的轻量订阅管理工具，支持订阅记录、支出分析和TG通知功能。

<mark>纯AI实现</mark>

## 本地运行 (开发模式)

**前置要求：** Node.js

1. 安装依赖：`npm install`
2. 启动前端开发服务器：`npm run dev`
3. 启动后端（在 `server/` 目录下）：`npm install && npm start`

## Docker-Compose（我是这么用的）
1. **创建 `.env` 文件**

2. **配置环境变量**

   * **必填**（否则启动会直接报错）：
     * `ADMIN_USER`
     * `ADMIN_PASS`
     * `JWT_SECRET`

   * **可选**（有默认值或按功能启用）：
     * `PORT`（默认 `3001`）
     * `NOTIFY_INTERVAL_MS`（通知轮询间隔，默认 10 分钟）
     * `JSON_BODY_LIMIT`（默认 `2mb`）
     * `MAX_ICON_BYTES`（默认 `1mb`）
     * `PUBLIC_BASE_URL`（Telegram webhook 需要）
     * **邮件通知配置**：
       * `SMTP_HOST`
       * `SMTP_PORT`
       * `SMTP_USER`
       * `SMTP_PASS`
       * `SMTP_FROM`
     * `DEBUG_TELEGRAM`（设为 `1` 开启日志，没用过）

3. **启动服务**

   ```bash
   docker-compose up -d --build
