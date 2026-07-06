# Phase 06 Bugfix Ledger

更新时间：2026-07-06

本文记录 Phase 06 演示前后已验收的新人端 Bug 修复批次。后续发现问题时，继续按同一格式追加，避免口头确认和线上状态脱节。

## 当前稳定演示基线

| 项目 | 当前值 |
|---|---|
| 线上演示地址 | https://haina-onboarding-h5-demo.onrender.com |
| 演示部署分支 | `codex/render-demo-deploy` |
| 新人端修复分支 | `codex/newcomer-home-input-bugfix` |
| 当前已验收提交 | `f64ef8f fix: refine home history typography` |
| 上一个新人端提交 | `92ad992 fix: adapt preset question cards to feishu style` |
| 基线原则 | 不直接污染 `master`；验收通过后再走受控合并或 PR |

## Bugfix Round 1: 首页对话输入与聊天形态

| 字段 | 记录 |
|---|---|
| 范围 | Page 01 新人首页 / 智能体主入口 |
| 用户反馈 | 底部输入框无法输入；进入对话后进度卡应置顶折叠；问候语应成为对话内容；四个入口卡片应收起；手机端不应显示模拟状态栏；对话需要头像；搜索、历史、加号面板需要移动端样式 |
| 主要修复 | 输入框恢复可编辑；发送后生成模拟 Bot 回复；进度卡置顶折叠；问候语进入消息流；头像展示；移除模拟 09:41/5G/100%；实现搜索、历史、附件面板；页面切换改为缓存已有数据并后台刷新 |
| 验证 | `npm.cmd test`、`npm.cmd run build`、本地浏览器检查、Render 线上检查 |
| 线上状态 | 已上线并验收 |

## Bugfix Round 2: 推荐问题与飞书风格适配

| 字段 | 记录 |
|---|---|
| 范围 | Page 01 对话模式推荐问题 |
| 用户反馈 | 底部预置问题应移除；预置问题应放到对话正文中；配色和布局不能照抄示意图，要适配飞书蓝白风格 |
| 修复提交 | `92ad992 fix: adapt preset question cards to feishu style` |
| 主要修复 | 推荐问题移入对话正文；改为白卡、浅蓝 `#` 图标、细边框、轻阴影；底部旧 quick chip 不再渲染 |
| 自动化护栏 | `tests/home-chat-model.test.ts`、`tests/frontend-structure.test.ts` |
| 验证 | `npm.cmd test`、`npm.cmd run build`、本地浏览器检查、Render 线上检查 |
| 线上状态 | 已上线并验收 |

## Bugfix Round 3: 搜索与历史记录字体统一

| 字段 | 记录 |
|---|---|
| 范围 | Page 01 搜索页、三个点历史侧栏 |
| 用户反馈 | “取消”和历史问题字体偏大偏粗；搜索历史前的标识符需要参考飞书时钟图标；搜索历史右侧需要叉号；侧栏历史记录字体也要统一 |
| 修复提交 | `f64ef8f fix: refine home history typography` |
| 主要修复 | 搜索页取消按钮改为 `15px / 500`；搜索历史文字改为 `15px / 500`；左侧改为 CSS 时钟图标；右侧增加删除叉号；侧栏记录标题改为 `15px / 500`，时间改为 `12px / 500` |
| 自动化护栏 | `tests/home-chat-model.test.ts` 新增搜索/历史字体与结构断言 |
| 验证 | `npm.cmd test`、`npm.cmd run build`、本地浏览器检查、Render 线上检查 |
| 线上状态 | 已上线并验收 |

## 后续 Bug 记录规则

每个新 Bug 至少记录：

1. 页面和入口。
2. 复现步骤。
3. 实际结果。
4. 期望结果。
5. 截图或录屏路径。
6. 修复分支和提交。
7. 本地验证命令。
8. 线上验证结果。

## 不应再发生的管理问题

- 不允许只说“已改”但没有提交号。
- 不允许只在线上手动看过但没有自动化护栏。
- 不允许把已验收修复只留在 Render 演示分支，后续必须通过受控合并沉淀到稳定基线。
- 不允许在 `master` 上直接做新人端 Bug 修复。
