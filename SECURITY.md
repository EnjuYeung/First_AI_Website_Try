# Security Policy

## Secrets

真实凭据只能放在未跟踪的 `server/.env` 或部署平台的 secret store 中。不要把
密码、JWT 密钥、Telegram Bot Token、SMTP 凭据、API Key、私钥或生产数据提交到
Git。

如果密钥曾进入 Git 历史：

1. 先在实际服务端轮换或吊销密钥；删除文件或重写历史不能让旧密钥失效。
2. 轮换 `JWT_SECRET` 后重启服务，使现有 JWT 全部失效。
3. 通过应用的修改密码流程轮换持久化管理员密码。
4. 评估日志、fork、缓存、镜像和备份中的副本。
5. 再使用 `git filter-repo` 等工具清理所有分支和标签，并在强制推送前协调所有克隆。

`DATA_ENCRYPTION_KEY` 的轮换需要先迁移已加密的汇率 API Key；不要直接替换后丢弃
旧密钥。

## Reporting

请通过仓库所有者的私密渠道报告漏洞，不要在公开 Issue 中附带可用凭据、TOTP
seed 或完整利用代码。
