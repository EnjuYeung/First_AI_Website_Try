# 项目代码 Review

日期：2026-09-27。审查基线：`09e9fbe` 加当前工作区，包括未提交的 Telegram 轮询及通知改动。

按**单人自用**评估，最值得先修的是数据一致性和实际交互问题。当前前后端测试与构建均通过，但额外复现确认了版本冲突覆盖、首次通知配置失败、金额换算不一致等现有测试未覆盖的问题。JSON 文件存储、现有组件拆分和后台定时任务总体适合这个使用规模，可以在现有结构上修正。

本次只输出报告，未修改业务代码。验证使用临时目录、合成数据、模拟接口和本地 HTTP 服务；未读取真实凭据内容，未向真实 Telegram、邮件或汇率服务发送请求。

## 1. 问题优先级

- **P1：优先修复。** 会覆盖已有业务状态，或直接阻断正常配置。
- **P2：随后修复。** 有明确触发条件，会造成错误结果、资源损坏、状态不一致或部署误操作。
- **P3：按需整理。** 对个人使用影响较小，主要影响记录准确性、维护和资源消耗。

| 编号 | 优先级 | 问题 | 主要影响 |
| --- | --- | --- | --- |
| R01 | P1 | 409 冲突后直接用新 revision 重发旧对象 | 可以撤销 Telegram 刚完成的弃用或续订操作 |
| R02 | P1 | 通知开关先保存，配置输入框后显示 | 默认空配置无法正常启用 Telegram / 邮件 |
| R03 | P2 | 缺失汇率时前端按 1:1，后端按 0 处理 | 仪表盘、筛选和月度汇总金额不一致 |
| R04 | P2 | 已发出的旧刷新响应覆盖后续保存结果 | 页面状态与 revision 倒退，后续保存可能扩大影响 |
| R05 | P2 | 保存订阅期间关闭表单会清理正在提交的图标 | 保存成功的订阅引用已删除文件 |
| R06 | P2 | 2FA 状态同时来自局部覆盖值和全局设置 | 开关、说明、验证码输入框互相矛盾 |
| R07 | P2 | 时间轴更新日期，父级统计不随跨日刷新 | 月份标签更新后仍展示上个月账单与统计 |
| R08 | P2 | Telegram 超时只覆盖响应头阶段 | 读取响应体可能长时间挂住轮询或通知调度 |
| R09 | P2 | Compose 与 README、运行数据排除规则不一致 | 按文档无法可靠构建部署，运行数据进入构建上下文 |
| R10 | P3 | 通知归属在 ID 失配时仍按名称回退 | 已删除订阅的提醒被另一条同名订阅标记为续订 |
| R11 | P3 | 冷启动读取时的通知过期清理没有落盘 | 返回结果已过滤，磁盘文件仍保留过期记录 |

## 2. 功能与逻辑问题

### R01 · 409 自动重试绕过了原本的版本保护

位置：[hooks/useAppData.ts:156](/opt/1panel/apps/First_AI_Website_Try/hooks/useAppData.ts:156)、[hooks/useAppData.ts:214](/opt/1panel/apps/First_AI_Website_Try/hooks/useAppData.ts:214)、[dataRoutes.js:142](/opt/1panel/apps/First_AI_Website_Try/server/lib/routes/dataRoutes.js:142)。

`persistFeature()` 收到 `RevisionConflictError` 后，只更新 `revisionsRef`，随后再次执行原来的 `operation`。编辑订阅时，这个闭包持有表单里的整条旧订阅；后端 PUT 又会整条替换已有记录。它没有读取、比较或合并发生冲突的字段。

**触发过程：**

1. 网页打开一条生效中的订阅进行编辑，表单保存了旧快照。
2. 自己在 Telegram 中点击“已弃用”，后台把该订阅改为 `cancelled`，revision 增加。
3. 网页只修改备注并保存，第一次 PUT 得到 409。
4. 前端自动带新 revision 重发原对象，其中仍然是 `status: active` 和旧账期，弃用结果被覆盖。

只有一个使用者也会触发：网页、Telegram 和后台任务本身就有多个写入来源。相同机制也会覆盖另一浏览器标签页刚修改的通知配置。普通设置接口已保护汇率及 2FA 等服务端字段，因此这里并不声称这些受保护字段也能通过通用设置 PUT 被覆盖。

**验证：**隔离 Hook 测试模拟 `currentRevision: 2` 的 409，确认第二次 `updateSubscription()` 请求直接使用 revision 2，并继续携带旧的 `active` 状态；后端整条替换行为通过路由实现核对。

**建议：**针对编辑订阅和整包设置，409 后先拉取最新数据并提示重新确认，保留表单草稿。需要自动合并时，只提交用户实际修改的字段，并检查这些字段是否也被远端改过；不要仅更换版本号重放旧对象。个人使用先实现“提示冲突并保留草稿”就足够。

### R02 · 首次启用通知形成配置死结，并且每次输入都落盘

位置：[NotificationsTab.tsx:129](/opt/1panel/apps/First_AI_Website_Try/components/settings/tabs/NotificationsTab.tsx:129)、[NotificationsTab.tsx:153](/opt/1panel/apps/First_AI_Website_Try/components/settings/tabs/NotificationsTab.tsx:153)、[dataSchema.js:164](/opt/1panel/apps/First_AI_Website_Try/shared/dataSchema.js:164)、[hooks/useAppData.ts:177](/opt/1panel/apps/First_AI_Website_Try/hooks/useAppData.ts:177)。

默认设置中，Telegram 和邮件均关闭，Token、Chat ID、邮箱均为空。界面只有在 `enabled` 为真时才显示输入框，但点击开关会立即调用 `onUpdateSettings()` 保存。后端则要求启用 Telegram 时 Token 和 Chat ID 非空，启用邮件时地址合法。

结果是开关刚打开就收到校验错误，然后 `useAppData` 拉回旧设置，开关关闭，输入框消失。重新配置已启用通道时，清空邮箱、输入半截地址也会触发同一问题。

此外，Token、Chat ID、邮箱的每个 `onChange` 都发送完整设置，进入全局串行保存队列。输入 30 次就是 30 次保存，不会合并中间值；网络较慢时，其他保存操作也要等待队列。

**验证：**组件操作配合真实 `validateSettings()`，分别得到 `invalid_telegram_settings` 和 `invalid_email_settings`；恢复旧值后，对应输入框消失。现有通知组件测试把保存全部模拟为成功，没有经过该校验链。

**建议：**通道配置使用局部草稿，允许先填写完整信息，再一次性校验、保存并启用。测试连接应等待保存成功，或明确测试当前草稿。这样同时解决配置死结和逐字符保存的冗余请求。

### R03 · 缺失汇率被转换成确定的错误金额

位置：[services/currency.ts:17](/opt/1panel/apps/First_AI_Website_Try/services/currency.ts:17)、[monthlySummary.js:30](/opt/1panel/apps/First_AI_Website_Try/server/lib/monthlySummary.js:30)、[CurrencyTab.tsx:105](/opt/1panel/apps/First_AI_Website_Try/components/settings/tabs/CurrencyTab.tsx:105)。

前端 `convertToUSD()` 在找不到汇率时直接返回原金额；后端 `toUsd()` 在同样情况下返回 0。添加币种只更新币种列表，不会同时补充汇率，因此新增 JPY 后、汇率刷新成功前就能遇到这个分支；未配置汇率 API 时还会一直保持这个状态。

**验证：**默认汇率没有 JPY，一条 `10000 JPY` 月付订阅，在前端得到 `10000 USD`，同一月份后端汇总得到 `0 USD`。金额筛选和排序也调用前端转换函数，受到影响。月度模板还会省略零金额行，使漏算更难被察觉。

**建议：**把换算规则放到 `shared`，缺失汇率返回明确的“无法换算”状态。原币金额仍然展示，合计标识有多少条未计入；避免把未知金额当作 1:1 或 0。新增币种时可提示刷新汇率。

### R04 · 刷新与保存的并发保护只覆盖一个方向

位置：[hooks/useAppData.ts:76](/opt/1panel/apps/First_AI_Website_Try/hooks/useAppData.ts:76)、[hooks/useAppData.ts:105](/opt/1panel/apps/First_AI_Website_Try/hooks/useAppData.ts:105)。

`loadRemoteData()` 在发起 GET 前等待已有保存队列，能保护“先保存、后刷新”。但 GET 开始后仍然可以保存；GET 返回时无条件覆盖全部状态和 revision，没有判断请求期间是否已经发生了更新。

**验证顺序：**GET 获取旧设置后延迟返回 → PUT 新设置成功，revision 为 2 → 旧 GET 返回，恢复旧设置及 revision 1。隔离测试确认，新分类从界面消失，下一次保存也重新使用了 revision 1。

**影响：**第一次主要是前端状态倒退；下一次基于旧状态的设置保存再结合 R01 的自动重试，可以把倒退后的状态写回服务器。首次加载和自动焦点刷新也走这条路径。

**建议：**记录刷新开始时的各功能 mutation version，返回时只应用期间没有变化的部分；或者统一读写协调，使旧快照不会覆盖后续成功写入。首次数据加载失败时也应有明确错误状态，避免直接以默认设置进入可保存界面。

### R05 · 关闭正在保存的表单会删除已提交的图标

位置：[SubscriptionForm.tsx:177](/opt/1panel/apps/First_AI_Website_Try/components/SubscriptionForm.tsx:177)、[SubscriptionForm.tsx:218](/opt/1panel/apps/First_AI_Website_Try/components/SubscriptionForm.tsx:218)、[SubscriptionForm.tsx:256](/opt/1panel/apps/First_AI_Website_Try/components/SubscriptionForm.tsx:256)、[dataRoutes.js:292](/opt/1panel/apps/First_AI_Website_Try/server/lib/routes/dataRoutes.js:292)。

提交按钮在 `isSubmitting` 时禁用，但关闭按钮和 Escape 仍调用 `closeAndDiscardUploads()`。该函数立即删除 `temporaryUploads` 中的所有文件。正在提交的 `iconUrl` 只有在 `await onSave()` 成功之后才从集合中移除。

**触发：**上传图标 → 点击保存 → 请求完成前关闭弹窗。删除接口不会检查文件是否已被订阅引用，于是保存仍可能成功，图标文件却已经删除。随后快速打开另一条订阅时，旧提交完成后无条件 `onClose()` 也可能关闭新的表单。

**验证：**延迟保存 Promise 的组件测试确认，提交 payload 包含上传 URL，同时关闭操作已经调用 `deleteUploadedIcon()` 删除这个 URL。

**建议：**最小修复是在保存完成前禁止关闭及 Escape，提交成功后再清理未使用文件。如果保留可关闭操作，需要按表单会话隔离提交结果和文件所有权。删除上传文件前，后端也应检查是否仍被正式数据引用。

### R06 · 2FA 保存成功后没有更新共享状态

位置：[hooks/useSecuritySettings.ts:69](/opt/1panel/apps/First_AI_Website_Try/hooks/useSecuritySettings.ts:69)、[hooks/useSecuritySettings.ts:82](/opt/1panel/apps/First_AI_Website_Try/hooks/useSecuritySettings.ts:82)、[SecurityTab.tsx:82](/opt/1panel/apps/First_AI_Website_Try/components/settings/tabs/SecurityTab.tsx:82)、[SecurityTab.tsx:90](/opt/1panel/apps/First_AI_Website_Try/components/settings/tabs/SecurityTab.tsx:90)。

启用或关闭成功后，Hook 只修改 `twoFactorEnabledOverride`。开关读取这个覆盖值，说明文字和关闭用的验证码输入框却读取 `settings.security.twoFactorEnabled`。共享设置没有同步。

**验证：**启用成功后，开关为开启状态，说明仍显示关闭，关闭 2FA 所需的验证码输入框也不存在。离开整个设置页再回来时，局部覆盖值消失，会再次显示旧状态，直到重新拉取数据。

**影响：**这是前端状态问题，并不表示后台 2FA 没有启用。但用户无法依据当前界面可靠判断状态，也可能无法立即完成关闭操作。

**建议：**接口成功后更新共享的 `security` 状态及 revision，或者重新加载权威状态；开关、说明和输入框全部读取同一个状态来源，移除长期存在的局部覆盖值。

### R07 · 跨日、跨月后时间轴与账单数据不同步

位置：[Dashboard.tsx:43](/opt/1panel/apps/First_AI_Website_Try/components/Dashboard.tsx:43)、[RenewalRail.tsx:64](/opt/1panel/apps/First_AI_Website_Try/components/RenewalRail.tsx:64)、[hooks/useAppData.ts:116](/opt/1panel/apps/First_AI_Website_Try/hooks/useAppData.ts:116)。

`RenewalRail` 每 30 秒更新自己的时钟和月份标签，但父组件 `Dashboard` 的统计只在父级重新渲染时重新计算。`useAppData` 依赖焦点/可见性事件刷新，没有针对一直处于前台的页面进行跨日更新。

**验证：**把时间设为上海时区 9 月 30 日 23:59:50，保持页面前台并推进 30 秒。时间轴标题变为 `October 2026`，账单事件仍然包含 `2026-09-30`，统计仍沿用 9 月的数据。

**建议：**由共享的服务端日期状态触发跨日更新；检测到日期变化时，重新计算统计并加载一次权威账期。列表剩余天数、累计期数和表单日期也可统一使用这个时间来源，避免各处独立依赖设备时间。无需每秒刷新整个应用。

### R08 · Telegram 读取响应体时已经失去超时保护

位置：[telegram.js:17](/opt/1panel/apps/First_AI_Website_Try/server/lib/telegram.js:17)、[telegramPolling.js:119](/opt/1panel/apps/First_AI_Website_Try/server/lib/telegramPolling.js:119)、[reminders.js:386](/opt/1panel/apps/First_AI_Website_Try/server/lib/reminders.js:386)。

`telegramRequest()` 在 `await fetch()` 完成后就进入 `finally` 清除计时器，随后才执行 `await resp.json()`。收到响应头并不意味着响应体读取结束，因此响应体卡住时，配置的 10 秒或 35 秒超时不再有效。

**验证：**本地 HTTP 服务立即发响应头，200 ms 后发送 JSON；调用传入 `timeoutMs: 80`，请求仍在约 216 ms 后成功返回，AbortSignal 未触发。

**影响：**如果响应体长期不结束，轮询的 `running` 或提醒任务的 `reminderRunning` 会持续占用。当前续订提醒和月度汇总串行执行，一个发送挂住也会阻塞后续工作。

**建议：**让超时覆盖请求、读取响应体和解析全过程，最后再清理计时器。解析阶段的中止错误应转换为正确的超时错误，不能被 `json().catch(() => ({}))` 吞掉。保留现有“发送结果未知时不盲目重复发送”的语义。

### R09 · 当前部署配置与配套文档、排除规则脱节

位置：[docker-compose.yml:3](/opt/1panel/apps/First_AI_Website_Try/docker-compose.yml:3)、[docker-compose.yml:15](/opt/1panel/apps/First_AI_Website_Try/docker-compose.yml:15)、[README.md:42](/opt/1panel/apps/First_AI_Website_Try/README.md:42)、[Dockerfile:10](/opt/1panel/apps/First_AI_Website_Try/Dockerfile:10)、[.dockerignore:12](/opt/1panel/apps/First_AI_Website_Try/.dockerignore:12)。

这是当前工作区中的配置问题，通过静态核对确认：

| 项目 | README / 排除规则 | 当前 Compose |
| --- | --- | --- |
| 构建 | `docker compose up -d --build` | 只有本地镜像名，没有 `build` 定义 |
| 环境文件 | `server/.env` | 项目根目录 `.env` 的绝对路径 |
| 前端入口 | `localhost:3001` | `127.0.0.1:33001` |
| 宿主机数据目录 | 排除 `server/data` | 实际挂载项目内 `Jan` |

按 README 操作不会从这里的 Dockerfile 构建新源码；镜像不存在时不能按文档完成部署，已有旧镜像时也可能继续运行旧版本。`Jan` 没有被 `.gitignore`、`.dockerignore` 排除，而前端 Dockerfile 使用 `COPY . .`，导致运行时文件进入构建上下文及构建阶段。最终 Nginx 镜像只复制 `dist`，本次没有据此声称运行数据会直接暴露到前端网站。

**建议：**明确这是本机部署配置还是可复用源码部署配置，补上对应的镜像构建步骤或 Compose `build`，同步文档中的路径和端口，并排除 `Jan/`。当前自定义端口和绝对路径可以保留，关键是让配套规则一致。

### R10 · 通知归属判断在不同模块中采用了不同规则

位置：[storage.js:177](/opt/1panel/apps/First_AI_Website_Try/server/lib/storage.js:177)、[notificationRecords.js:4](/opt/1panel/apps/First_AI_Website_Try/server/lib/notificationRecords.js:4)、[SubscriptionList.tsx:171](/opt/1panel/apps/First_AI_Website_Try/components/SubscriptionList.tsx:171)。

`notificationRecords.matchesSubscription()` 在记录有 subscription ID 时坚持按 ID 匹配，并要求旧记录按名称匹配时名称唯一。存储层的 `resolveSubscriptionForNotification()` 在 ID 查不到时却继续按名称寻找第一条订阅；前端反馈查找也有自己的名称回退规则。

**验证：**旧通知的 `subscriptionId` 指向已删除的 `deleted-sub`；当前存在另一个同名 `new-sub`，账期在未来。读取/规范化后，旧通知从 `pending` 变成 `renewed`，并设置 `autoRenewed`，实际依赖的是另一条订阅。

**影响：**错误修改历史通知的反馈，不会在这个分支直接修改另一条订阅。当前影响较小，因此标为 P3。

**建议：**统一身份匹配规则：有 ID 时不回退到名称；只有确实没有 ID 的旧记录才在名称唯一时回退。复用已有匹配逻辑即可。

### R11 · 冷启动过滤过期通知后，没有把变化写回文件

位置：[storage.js:342](/opt/1panel/apps/First_AI_Website_Try/server/lib/storage.js:342)、[storage.js:368](/opt/1panel/apps/First_AI_Website_Try/server/lib/storage.js:368)。

首次读取通知文件时，`readFeatureDocument()` 已经调用 `normalizeFeature()` 过滤旧通知，并把过滤后的结果放进缓存，但只对 subscriptions 调用持久化规范化逻辑。之后 `loadAllDocuments()` 比较的是“已过滤数据”与“再次过滤数据”，两者相等，因此不会落盘。

**验证：**临时通知文件含一条 91 天前的记录，创建新 storage 实例后读取，API 数据为 0 条，磁盘文件仍为 1 条。后续真正新增通知等操作才可能顺带清理文件。

**建议：**首次规范化时保留原始值，变化后统一增加 revision 并落盘；通知的归属匹配和保留期过滤也应在取得订阅上下文后一次完成。

## 3. 无效代码与可直接精简的部分

以下清理项不需要引入新框架，优先级均低于 R01 至 R08。

| 位置 | 判断与证据 | 建议 |
| --- | --- | --- |
| [server/lib/dates.js:3](/opt/1panel/apps/First_AI_Website_Try/server/lib/dates.js:3) | 后端 `parseLocalYMD` 没有调用方，仓库搜索仅命中定义；前端同名函数有实际调用 | 删除后端这份未用函数，保留前端调用所需实现 |
| [shared/dataSchema.js:235](/opt/1panel/apps/First_AI_Website_Try/shared/dataSchema.js:235) | `validateNotifications` 在业务代码和现有测试中均没有调用 | 删除未使用校验器，或明确接入真正需要校验的边界；当前不能把它算作已有的运行时校验 |
| [hooks/useAppData.ts:46](/opt/1panel/apps/First_AI_Website_Try/hooks/useAppData.ts:46) | `notificationsRef` 初始化并赋值，但从未读取 | 移除这个 ref 及赋值，保留 React state |
| [services/apiClient.ts:11](/opt/1panel/apps/First_AI_Website_Try/services/apiClient.ts:11) | `authHeaderOnly()` 永远返回空对象，上传/删除调用只是重复传 `headers: {}` | 删除空包装；Cookie 携带逻辑已经集中在 `apiFetch` |
| [hooks/useAuth.ts:15](/opt/1panel/apps/First_AI_Website_Try/hooks/useAuth.ts:15) | `UnauthorizedError` 与其他错误分支执行相同的 `setIsAuthenticated(false)` | 合并分支，移除该文件不再需要的类型判断；其他模块的 UnauthorizedError 仍有用途 |
| [types.ts:9](/opt/1panel/apps/First_AI_Website_Try/types.ts:9) | 两个默认列表的转导出没有调用方；实际消费者从 shared 导入 | 删除无用转导出，保留 shared 常量 |
| [server/lib/email.js:32](/opt/1panel/apps/First_AI_Website_Try/server/lib/email.js:32) | `hasSmtpConfig` 对外返回值没有读取方，但局部变量参与创建 transporter | 只精简未使用的对外返回字段，不删除内部判断 |
| [docker-compose.yml:26](/opt/1panel/apps/First_AI_Website_Try/docker-compose.yml:26) | `backend-data` 命名卷没有任何服务挂载 | 删除遗留卷声明，减少对实际存储位置的误解 |

**条件失效的旧分支：**[reminders.js:49](/opt/1panel/apps/First_AI_Website_Try/server/lib/reminders.js:49) 的 `overdueSubs` 收集及 [reminders.js:209](/opt/1panel/apps/First_AI_Website_Try/server/lib/reminders.js:209) 的过期反馈处理，在正常、同一天的生产路径中已经被存储层账期自动推进取代。`loadUserData()` 返回前先滚动生效中订阅，合法订阅随后不会满足 `days < 0`。即使恰好跨午夜进入分支，后续 `updateUserData()` 又会先读取并推进账期，原日期相等检查也可能直接跳过。建议在明确账期推进职责后移除这套旧处理，保留一个权威实现。

**只能算待确认的清理候选：**[dataRoutes.js:251](/opt/1panel/apps/First_AI_Website_Try/server/lib/routes/dataRoutes.js:251) 的两个删除通知接口在当前前端没有调用方。仅凭这一点不能认定对外接口无用；如果自己没有脚本依赖，可以一并精简对应路由和接口快照测试。

历史数据迁移、旧加密密钥迁移、旧通知名称回退都不能只因为现在是单人使用就全部删除。应该在确认自己的持久数据完成迁移之后，再单独清理兼容代码。翻译中的 `color_theme_*` 通过动态键使用，也不是死代码。

## 4. 冗余实现与职责划分

### 4.1 存储层同时执行持久化、迁移和业务状态变更

[server/lib/storage.js](/opt/1panel/apps/First_AI_Website_Try/server/lib/storage.js) 当前约 500 行，承担目录权限、原子写、串行队列、缓存、旧数据迁移、设置合并、账期推进、通知清理及自动续订反馈。

实际后果是 `loadUserData()` 看似读取，实际上可能写文件、增加 revision、推进订阅和改变通知反馈。Telegram 轮询、认证、汇率和提醒服务每次取设置时都间接参与这些业务行为。R10、R11 就与规范化散落在多个阶段有关。

建议只做少量、有明确目的的拆分：文件与 revision 处理留在 storage；迁移放到独立迁移模块；账期推进和通知反馈放到显式的领域函数，由统一入口调用。保留现有进程内写队列及原子写即可。

### 4.2 同一条规则在多处实现，已经出现实际分歧

| 规则 | 重复位置 | 已有后果或维护成本 |
| --- | --- | --- |
| 汇率转换 | `services/currency.ts`、`server/lib/monthlySummary.js` | 缺失汇率时结果不同，见 R03 |
| 订阅身份匹配 | `storage.js`、`notificationRecords.js`、`SubscriptionList.tsx` | ID 与名称回退条件不同，见 R10 |
| 日期解析、按时区取日期、相差天数 | `services/dateUtils.ts`、`server/lib/dates.js` | 大段相似实现，参数顺序和无效值结果还不同 |
| 设置默认值与兼容合并 | `services/storageService.ts`、`server/lib/storage.js` | 两套 mergeSettings 重复合并通知、模板、汇率、安全字段 |
| 账期遍历及支出推算 | `Dashboard.tsx`、`subscriptionLifetime.ts`、`monthlySummary.js` | 分别维护遍历、终止条件和取消边界 |

可以复用 `shared` 中已有的组织方式，优先统一汇率和身份匹配这两个已经出错的规则。账期的不同统计口径则先写清楚含义，再提取共用的账期枚举函数，避免简单合并后把“已支付”和“到期账单”混为一谈。

### 4.3 续订提醒和月度汇总重复实现发送状态机

[reminders.js:98](/opt/1panel/apps/First_AI_Website_Try/server/lib/reminders.js:98) 与 [reminders.js:284](/opt/1panel/apps/First_AI_Website_Try/server/lib/reminders.js:284) 分别实现“查重 → 持久化 attempting → 调用通道 → 区分 failed/unknown → 最终落盘”，维护两套近似流程。

建议抽一个小型的 `deliverNotificationAttempt()`，参数只包含查重条件、记录数据和发送函数。续订筛选、月度统计仍各自保留，避免为了去重设计复杂通知框架。现有持久化后发送及未知结果不盲目重试的行为应保留，并继续由通知可靠性测试保护。

### 4.4 AppSettings 混合了三种所有权

[types.ts:112](/opt/1panel/apps/First_AI_Website_Try/types.ts:112) 把设备本地偏好、用户可编辑设置、服务器维护的汇率与 2FA 状态放在一个对象里。结果是 App、storageService、dataRoutes 分别拆除或覆盖一遍字段，多个设置 Hook 又直接使用专用 API 绕过统一的 revision 更新。

建议用少量明确类型区分 `ClientPreferences`、可编辑设置、服务端状态；更新接口传具体变更。设置专用接口成功后统一更新共享状态和 revision。组件按常规、币种、通知、安全分区本身已经合理，主要问题在状态的来源和保存边界。

**统计口径提醒：**累计支出和月度支出目前由“当前价格 × 推算账期”、当前汇率计算，没有支付流水、调价历史或完整停用/恢复历史。因此修改价格、恢复订阅、永久删除订阅都可能改变回看统计。个人使用若接受估算，可以明确标注口径；只有确实需要历史账单准确性时，再增加简洁的账单记录。

## 5. 性能评估

### 5.1 有证据的后台冗余工作，当前小规模影响有限

[telegramPolling.js:100](/opt/1panel/apps/First_AI_Website_Try/server/lib/telegramPolling.js:100) 每次先加载全量用户数据，之后才判断 Telegram 是否关闭；关闭时仍由 [telegramPolling.js:137](/opt/1panel/apps/First_AI_Website_Try/server/lib/telegramPolling.js:137) 每 3 秒调度一次，即空闲一天约 28,800 次加载。

加载存在缓存，因此**不能把这说成每 3 秒都完整读写一次磁盘**。但仍会复制对象、遍历订阅、规范化通知，并进行 JSON 序列化比较。`normalizeNotifications()` 对每条待反馈续订通知调用 `isPastYmd()`，而后者每次重新构造 `Intl.DateTimeFormat` 获取同一个“今天”。

在本机 Node v26.7.0 上，缓存预热后各执行 12 次，合成数据均为待反馈通知，测得：

| 订阅数 | 待反馈通知数 | 单次 loadUserData 中位耗时 | 单次日期格式器构造次数 |
| --- | --- | --- | --- |
| 30 | 30 | 2.15 ms | 31 |
| 100 | 100 | 6.08 ms | 101 |
| 1000 | 1000 | 62.48 ms | 1001 |

这不是实际使用数据，也不是线上压测；1000 条待反馈记录只是观察扩展成本。已处理的历史通知不会全部进入这个日期判断分支。

**合适的优化：**每轮只计算一次今天；Telegram 未启用时降低检查频率或在配置变更时启动轮询；需要设置的任务尽量避免读取和复制完整订阅、通知历史。以几十条订阅的使用量，这些属于 P3 优化，不构成更换数据库的理由。

### 5.2 优先减少逐字符保存，其次才优化遍历

R02 的逐字符请求会实际增加串行队列长度、JSON 序列化和原子写次数，比个人规模下的普通 `filter`、`map` 更值得优化。局部草稿和一次保存能直接减少工作量。

[SubscriptionCostStack.tsx:22](/opt/1panel/apps/First_AI_Website_Try/components/subscription/SubscriptionCostStack.tsx:22) 每次渲染重新遍历历史账期；仪表盘和月度汇总也从订阅开始日期逐期计算。几十条订阅、几年历史时可以保留当前实现。数据增多且出现实际卡顿后，再缓存稳定结果或直接定位目标月份，不必先引入列表虚拟化等额外复杂度。

### 5.3 构建体积正常，表单的懒加载触发得过早

本次生产构建结果：

| 产物 | 原始体积 | gzip 估算 |
| --- | --- | --- |
| 主 JS | 254.72 kB | 81.81 kB |
| 主 CSS | 83.62 kB | 15.78 kB |
| 设置页 JS | 68.68 kB | 20.71 kB |
| 订阅表单 JS | 16.00 kB | 4.27 kB |

这是 Vite 的体积报告，gzip 列不代表已测得线上传输启用了压缩。

[App.tsx:256](/opt/1panel/apps/First_AI_Website_Try/App.tsx:256) 无条件渲染 lazy 的 `SubscriptionForm`，然后才由组件内部判断 `isOpen` 并返回 null。因此登录后即触发表单模块加载，并未等到打开弹窗。可以改为打开时再挂载；改动时保留上传会话清理逻辑。收益有限，列为 P3。

## 6. 已执行的验证与限制

| 验证 | 结果 |
| --- | --- |
| 前端 `npm test` | 10 个测试文件，24 项通过 |
| 后端 `cd server && npm test` | 71 项通过 |
| `npm run build -- --outDir /tmp/subm-code-review-20260927-build` | TypeScript 检查及生产构建通过，产物放在临时目录 |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters` | 通过，无未使用局部变量/参数诊断 |
| 额外组件 / Hook / 换算复现 | 7 项通过，分别确认 R01 至 R07 所述现象 |
| 隔离 Node 探针 | 确认 R08、R10、R11，并测量全量加载成本和关闭 Telegram 后仍加载数据的行为 |
| `git diff --check` | 检查通过 |

额外复现中的“通过”表示成功观察到报告描述的问题，不代表问题已修复。复现代码保存在本次会话的临时目录中，未加入项目测试目录。

未使用变量检查通过也不等于没有无效代码：导出的未调用函数、只写不读的 ref、被上游业务逻辑取代的分支，以及未调用接口通常不会被这个检查完整发现。后端 JavaScript 也没有启用完整的 `checkJs` 检查。

审查覆盖前后端主要业务流程、共享规则、配置及现有测试；没有进行真实外部服务联调、实际浏览器性能追踪或线上容器发布验证。当前验证环境为 Node v26.7.0、npm 11.19.0，项目容器/CI 使用 Node 24，本报告不代替 Node 24 环境中的回归检查。

## 7. 建议实施顺序

1. 修复 R01、R02：保护已有订阅状态，让通知配置可以可靠完成。
2. 修复 R03、R04：统一缺失汇率行为，并保证刷新不会回滚成功保存。
3. 修复 R05、R06、R07、R08：补齐异步表单、共享状态、跨日及网络超时的边界。
4. 同步部署文件和文档，再处理通知归属及保留期落盘问题。
5. 清除确认未用的函数、ref、空包装和卷声明；随后集中共享规则，最后按实测需要做性能优化。

后续新增回归测试应直接覆盖上述触发顺序，尤其是“真实校验失败后的 UI 恢复”“409 后保留远端状态”“GET 晚于 PUT 返回”“保存中关闭弹窗”“跨午夜仍停留前台”。这些测试比单纯继续增加组件渲染或模拟成功接口的测试更能保护当前项目。

## 8. 修复落实记录（2026-09-27）

以上章节保留原始审查结论。本轮已修复 R01–R11：

- R01 / R04：停止冲突自动重放，并拦截冲突前已排队的同类写入；失败后按功能同步权威数据。刷新同时检查 mutation version 和在途保存，避免旧数据与 revision 回滚。首次加载失败显示重试入口。
- R02：Telegram / 邮件使用局部草稿，统一保存；失败保留输入，测试连接等待保存成功。
- R03：共享换算函数以 `null` 表示无法换算；金额筛选排除未知金额，排序将其置后。仪表盘和月度通知显示未计入数量，账单保留原币金额，币种设置提示补充汇率。
- R05：保存中禁止关闭 / Escape；后端删除图标在用户数据队列内检查正式订阅引用；延迟上传响应按表单会话清理。
- R06：移除局部 2FA 开关覆盖值，专用接口成功后更新共享设置并刷新权威 revision；与已有刷新重叠时补发一次刷新。
- R07：每 30 秒检查共享服务端日期，跨日驱动父级统计更新并获取权威账期。
- R08：Telegram 超时覆盖响应体读取，保留超时和不确定发送结果的错误语义。
- R09：Compose 增加源码构建定义，保留本机路径、端口；文档同步环境文件、访问入口和 CORS 配置；忽略 `Jan/`，删除未使用命名卷。
- R10 / R11：有 ID 的记录不回退名称，无 ID 的历史记录仅匹配唯一名称；冷启动在订阅上下文齐备后一次规范化通知，清理结果增加 revision 并落盘。

同步完成确认无用的函数、ref、空包装、转导出清理；移除提醒服务中已由存储层承担的过期反馈分支；通知规范化每轮只计算一次今天；Telegram 关闭时轮询间隔改为 30 秒；订阅表单打开时才加载。

验证：前端 12 个测试文件、35 项通过；后端 75 项通过；TypeScript（含未使用局部变量 / 参数检查）、生产构建、`git diff --check`、`docker compose config --quiet` 通过。回归测试使用合成数据、临时目录、模拟接口及本地 HTTP 服务。未进行真实 Telegram / 邮件 / 汇率联调或容器发布，原有未提交改动保留。

存储迁移模块拆分、完整设置所有权类型拆分、统一通知发送状态机等结构性建议保留为后续重构；没有删除历史兼容逻辑和可能存在外部调用者的通知删除接口。历史支出仍按当前价格与当前汇率估算，本轮未引入支付流水。

## 9. 架构重组落实记录（2026-09-27）

接续第 8 节，已完成此前保留的三项结构重组：存储与迁移/领域规则分离，续订与月度汇总共用通知发送流程，以及设置所有权类型、补丁写入和专用接口 revision 同步。详细职责、兼容约定及测试位置见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

新增测试覆盖迁移中断恢复、并发版本冲突、缓存副本隔离、统一业务时间快照、两类通知的并发领取和不确定发送结果、嵌套配置补丁与公开/私有设置边界。前端 13 个文件、39 项测试及后端 88 项测试通过；TypeScript 未使用项检查通过。现有数据布局和 API 路径保留，本轮未进行线上数据迁移或部署。
