# Subm · Personal & Family Subscription Tracker

2026-10-17。用户已确认当前主机与完整推荐方案。本规范替代此前首页布局冻结及仅换肤的范围，旧计划作为历史保留。

## 原则

Minimalism & Swiss Style，内容驱动的 Bento Box Grid，清晰的财务读数。冷白 / 石墨表面、单一强调色、细边框；无大面积渐变、装饰玻璃、卡片位移或数值滚动。

## Token

沿用 styles.css 的 canvas / surface / ink / muted / line / rail-teal / due-amber / alert-coral 语义变量及 light / dark / system、default / blue / violet / rose 机制。正文对比度至少 4.5:1，重要控件与焦点至少 3:1。壁纸与透明度能力保留。

- 冷白 #f6f7f9 / 石墨 #101116；面板 #ffffff / #191b22。
- 默认强调 #267a76 / #62b8b1；小字使用 rail-teal-ink。
- 本地 IBM Plex Sans 用于正文和标题，Archivo 用于品牌，IBM Plex Mono 用于金额和日期；数字 tabular-nums。
- 页面标题 24–32px，主要金额 28–36px，正文与手机输入 16px，辅助文字 13–14px。
- 间距 4 / 8 / 12 / 16 / 24 / 32 / 48px；内容最大 1440px。
- 控件圆角 9px，卡片 16px，弹窗 20px。手机触控目标至少 44px。
- 小屏单列；摘要两列；768px 起按内容两列，1024px 起采用 12 列功能网格。

## 页面与交互

- 四个一级入口：概览、订阅、支出统计、设置；桌面顶部导航，手机底部导航。
- 首页金额优先，规则见 pages/dashboard.md；详情与统计只使用现有记录。
- 核心录入前置，可选图标/链接/备注折叠，保存区固定，保持上传清理、草稿、保存失败及版本冲突流程。
- 所有交互有 focus-visible、hover、active、disabled、loading、error 与必要成功状态；120–180ms 色彩反馈，尊重 reduced-motion。
- 复用现有 ModalDialog，支持焦点约束、Escape、焦点返回；复杂详情不作为冗长 aria-describedby。
- 明确区分生效状态、提醒和自动续订。没有记录的自动续订显示“未记录”；不添加家庭成员、到期日或业务字段。
- 月/年及累计费用注明当前价格、当前汇率与账期估算，保留缺失汇率提示。

## 实现与验收

沿用 React、Tailwind 4、Lucide 和自托管字体，无新增运行时依赖。账期汇总从原 Dashboard 等量提取共享 Hook，不改变公式。后端、API、数据结构和业务数据不改动。

完整评估、文件计划与验收要求见 ../../docs/plans/personal-family-redesign.md。验证 320/375/414/768/1024/1440px、浅深与四色主题、系统主题、键盘和 reduced-motion，以及原有数据操作与错误反馈。
