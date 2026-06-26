# 海纳 AI 入职 Bot H5 MVP 交接摘要

## 1. 当前项目状态

- 项目路径：`C:\Users\HDL\Documents\海纳入职Bot开发`
- 当前分支：`codex/module-split-phase-2`
- 最近确认的最新提交：`758c433 refactor: standardize frontend api client errors`
- 当前重点：不要继续打磨新人端，进入 Phase 04A：后台配置维护台可写化

注意：生成本交接文件时，工作区已存在未提交改动：

- `src/server/contracts.ts`
- `src/server/services/adminService.ts`
- `tests/phase04a-admin-config.test.ts`

这些改动不是本交接文档产生的，后续接手时应先检查其内容再继续。

## 2. 项目核心边界

本项目是“海纳 AI 入职 Bot H5 高保真 MVP”，目标是支持小范围试点。

必须坚持：

- P0 数据必须接真实后端和数据库。
- 外部飞书、审批、RAG、文件解析、真实消息发送仍然模拟。
- 不做真实登录。
- 不调用真实飞书 API。
- 不调用真实审批 API。
- 不调用真实 LLM、RAG、向量库。
- 不做真实文件上传、解析、向量化。
- 不做绩效评价、能力评分、员工排名。
- 匿名反馈原文不能暴露给管理者。
- 新人端、后台端、管理者端要保持清晰分离。

## 3. 当前关键产品决策

### 3.1 新人端已基本完成

新人端已覆盖：

- 首页
- D1 引导
- 权限申请
- 权限详情 / 进度登记
- 4 小时回访
- 首周反馈
- 匿名反馈

下一步不建议继续细抠新人端 UI。试点能否跑起来，关键在后台是否能配置、管理者是否能跟进。

### 3.2 后台配置维护台必须是网页端

后台不应沿用 H5 操作方式，而应做成桌面网页端配置工作台。

建议形态：

- 顶部或左侧 tab
- 表格
- 筛选
- 弹窗或侧边表单
- 保存 / 取消
- 启用 / 停用
- 状态修改
- 保存后刷新仍保留

### 3.3 配置优先 enabled 启停，不做物理删除

原因：

- 避免破坏新人历史权限记录。
- 避免配置删除后历史页面崩溃。
- 便于试点复盘追踪历史状态。

### 3.4 数据分层

配置表：

- 岗位
- 权限项
- 岗位权限关系
- D1 引导配置
- 首周反馈问题配置
- 匿名反馈三级联动配置
- 知识库元数据

业务记录表：

- 新人权限进度
- 4 小时回访任务
- 首周反馈提交
- 匿名反馈提交
- 管理者查看与处理动作

统计数据：

- 从真实业务表计算。
- 不建议手动维护统计结果，避免数据打架。

## 4. 已完成能力

### 4.1 后端与数据库

已具备：

- P0 后端 schema 和 seed data
- 角色 / 岗位权限包接口
- 权限进度登记接口
- 一键申请权限接口
- 4 小时回访任务持久化
- 首周反馈持久化
- 匿名反馈持久化
- 管理者动作状态持久化基础
- 后台配置读取基础
- 知识库元数据新增基础

### 4.2 新人端

已完成：

- 首页机器人气泡和入口卡片
- D1 三步引导
- 权限申请状态统一为：
  - 未申请
  - 进行中
  - 已完成
  - 被驳回
- 一键申请后进入进行中，并创建 4 小时回访任务
- 已申请权限不再重复出现在一键申请弹窗
- 首周反馈选项可切换
- 匿名反馈改为三级联动：
  - 关联模块
  - 问题类型
  - 希望如何处理

### 4.3 工程治理

已完成：

- 前后端模块边界拆分
- 新人端 / 后台端 / 管理者端页面拆分
- 后端 routes 按 surface 拆分
- 后端 services 拆分
- 后端 repositories 拆分
- 后端 contract guards
- 后端标准错误响应
- 前端统一 API client
- 前端统一 API 错误对象和错误提示
- 架构测试防止后续绕过边界

## 5. 重要文件

### 5.1 项目约束

- `AGENTS.md`
- `.agents/skills/haina-onboarding-h5/SKILL.md`
- `docs/specs/phase-04-admin-and-review.md`
- `docs/specs/phase-05-manager-flow.md`

### 5.2 架构决策

目录：`docs/decisions/`

已有 ADR：

- `0001-one-click-apply-follow-up.md`
- `0002-module-boundaries.md`
- `0003-backend-contracts.md`
- `0004-backend-error-responses.md`
- `0005-frontend-api-client.md`

### 5.3 前端关键文件

- `src/frontend/api.ts`
  - 前端 API 请求统一入口
  - `ApiClientError`
  - `formatApiErrorMessage`

- `src/frontend/appState.ts`
  - 统一加载页面数据
  - 统一处理 API 错误提示

- `src/frontend/App.tsx`
- `src/frontend/AppContent.tsx`
- `src/frontend/pages/newcomerPages.tsx`
- `src/frontend/pages/adminPages.tsx`
- `src/frontend/pages/managerPages.tsx`

### 5.4 后端关键文件

- `src/server/apiRoutes.ts`
- `src/server/routeKit.ts`
- `src/server/contracts.ts`
- `src/server/errors.ts`

Routes：

- `src/server/routes/newcomerRoutes.ts`
- `src/server/routes/adminRoutes.ts`
- `src/server/routes/managerRoutes.ts`
- `src/server/routes/reviewRoutes.ts`

Services：

- `src/server/services/newcomerService.ts`
- `src/server/services/adminService.ts`
- `src/server/services/managerService.ts`
- `src/server/services/reviewService.ts`

Repositories：

- `src/server/repositories/configRepository.ts`
- `src/server/repositories/feedbackRepository.ts`
- `src/server/repositories/metricsRepository.ts`
- `src/server/repositories/permissionRepository.ts`

### 5.5 测试文件

- `tests/frontend-api-client.test.ts`
- `tests/frontend-architecture.test.ts`
- `tests/backend-contracts.test.ts`
- `tests/backend-errors.test.ts`

最近一次确认：

- `npm.cmd test`：41 个测试通过
- `npm.cmd run build`：通过

## 6. 下一步最优先任务：Phase 04A

下一步应进入：

```text
Phase 04A：后台配置维护台可写化
```

目标：让 `/admin-config` 从展示页变成可运营的后台配置中心。

### 6.1 岗位权限包管理

后台需要能配置：

- 岗位
- 必开权限
- 可选权限
- Owner
- 申请入口
- 理由模板
- 常见等待原因
- 启用 / 停用

要求：

- 写真实数据库。
- 保存后刷新仍保留。
- 新人端权限申请页读取更新后的配置。
- 后端校验同一岗位下权限不能重复绑定。
- 同一权限不能同时作为必开和可选。

### 6.2 D1 引导配置

后台需要能配置：

- 飞书部门群名称
- 模拟申请进群发送对象
- 员工指南册标题
- 员工指南册链接
- 权限包入口

要求：

- 写真实数据库。
- D1 页面读取后台配置。
- 外部飞书动作仍然模拟。

### 6.3 首周反馈配置

继续完善已有配置能力：

- 问题标题
- 选项
- 单选 / 多选 / 文本
- 启用 / 停用
- 排序

要求：

- 后台表单更易用。
- 新人端首周反馈动态读取配置。
- 不能把所有问题全部禁用。

### 6.4 匿名反馈三级联动配置

从只读展示改成可编辑：

- 关联模块
- 模块下的问题类型
- 模块下的希望处理方式
- “其他”是否需要填空
- 启用 / 停用
- 排序

要求：

- 后台修改后，新人端匿名反馈页按新配置展示。
- 保持匿名反馈原文不进入管理者端。

### 6.5 知识库管理

解析和 RAG 继续模拟，但元数据真实保存：

- 文档名称
- 知识分类
- 适用岗位
- 适用阶段
- Owner
- 状态
- 模拟解析状态
- 模拟向量化状态

要求：

- 能新增。
- 能展示。
- 能归类。
- 能配置 Owner。
- 保存后刷新仍保留。

### 6.6 匿名反馈池

后台需要能：

- 查看反馈
- 修改处理状态
- 写处理结论
- 设置处理 Owner
- 标记是否进入复盘指标

状态流建议：

```text
待处理 -> 处理中 -> 已补充知识库 / 已修正权限入口 / 暂不处理 / 已关闭
```

## 7. Phase 04B：V1 试点复盘

完成后台可写化后，再做 `/review`。

复盘页应从真实后端数据汇总：

- 新人流程漏斗
- 权限申请完成 / 未完成情况
- 4 小时回访未完成类型
- 匿名反馈分类统计
- 知识库缺口
- 首周反馈提交情况
- 下轮优化清单

不要做静态看板。

## 8. Phase 05：管理者端

管理者端目标是“看到新人卡点并跟进”，不要复杂化。

### 8.1 管理者首页 `/manager`

展示：

- 今日新人
- 谁需要关注
- 权限状态
- 首周反馈状态
- 当前卡点

### 8.2 新人详情 `/manager/newcomer/:id`

展示：

- D1-D7 进度
- 当前卡点
- 权限进展
- 首周反馈摘要

注意：

- 只展示首周反馈摘要。
- 不展示匿名反馈原文。

### 8.3 完整首周反馈 `/manager/feedback/:id`

展示：

- 新人实名首周反馈
- 只读内容
- 记录已查看
- 安排沟通
- 处理动作写入数据库

禁止：

- 绩效评价
- 能力评分
- 员工排名
- 匿名反馈原文

## 9. Phase 06：最终全链路 QA

最终 QA 应按真实试点路径走：

1. 新人进入首页。
2. 完成 D1 引导。
3. 申请权限。
4. 触发 4 小时回访。
5. 提交首周反馈。
6. 提交匿名反馈。
7. 后台查看和处理配置 / 反馈。
8. 后台调整配置。
9. 新人端读取新配置。
10. 管理者查看新人状态。
11. 管理者查看首周反馈。
12. 刷新后确认数据仍保留。

## 10. 新会话启动语

建议在新会话直接发送：

```text
继续开发海纳 AI 入职 Bot H5 MVP。请先阅读 AGENTS.md、.agents/skills/haina-onboarding-h5/SKILL.md 和 docs/handoff-phase-04a.md。

当前项目路径：
C:\Users\HDL\Documents\海纳入职Bot开发

当前分支：
codex/module-split-phase-2

当前重点：
不要继续打磨新人端。下一步进入 Phase 04A：后台配置维护台可写化。

优先做 /admin-config 网页端可操作闭环：
1. 岗位权限包管理：岗位、必开权限、可选权限、Owner、申请入口、理由模板。
2. D1 引导配置：飞书群、员工指南册链接、权限包入口。
3. 首周反馈配置：完善后台表单。
4. 匿名反馈三级联动配置：从只读改成可编辑。
5. 知识库管理：新增、展示、归类、配置 Owner，解析/RAG 仍模拟。
6. 匿名反馈池：查看反馈、改处理状态、写处理结论、标记是否进入复盘。

工程要求：
- P0 数据必须走真实后端和数据库。
- 后台保存后刷新仍要保留。
- 新人端 / 复盘端要读取后台配置后的数据。
- 后端必须做校验，避免配置破坏历史数据。
- 配置优先 enabled 启停，不做物理删除。
- 完成后运行 npm.cmd test 和 npm.cmd run build，并汇报结果。
```
