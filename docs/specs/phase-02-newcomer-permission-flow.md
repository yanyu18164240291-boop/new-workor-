# Phase 02 Spec: Newcomer Permission Flow

## Goal

Implement the newcomer path from home to D1 guidance, permission package, permission detail, and 4-hour follow-up.

## Scope

This phase covers pages 01, 02, 03, 04, and 05.

## Page 01: 新人首页 / 智能体主入口

### Required Content

- Welcome card for 海纳AI入职Bot.
- Core entry cards:
  - D1入职引导
  - 权限申请跟进
  - AI工具申请
  - 反馈所遇问题
- Progress summary:
  - 已完成事项
  - 待跟进权限
  - 今日待办
  - 入职阶段
- Permission task list.
- Bottom LUI-style knowledge input.

### Required Interactions

- “D1入职引导” routes to page 02.
- “权限申请跟进” routes to page 03.
- “AI工具申请” routes to page 04.
- “反馈所遇问题” routes to page 07.
- Knowledge answer “查看权限详情” routes to page 04.
- Knowledge answer “我还没解决” routes to page 07.
- Input or shortcut question displays mock knowledge answer only; no API call.
- If stage is D6/D7 and `weeklyFeedbackSubmitted=false`, show “填写首周反馈” entry to page 06.

## Page 02: D1 到达引导包

### Required Interactions

- “加入飞书部门群” shows toast: 已发送进群申请.
- “查看员工指南册” shows toast: 已打开员工指南册.
- “查看岗位权限包” routes to page 03.
- Task completion visually changes the task state.

## Page 03: 岗位权限包

### Required Content

- Required permissions: OA 系统, Mail 海底捞邮箱.
- Optional permissions: BPM 系统, ChatGPT 账号, QoderWork 账号.
- Sensitive permission提示 for BPM.

### Required Interactions

- 必开权限 one-click opens confirmation modal.
- Confirming required permissions:
  - Persists OA and Mail as in-progress/submitted demo records.
  - Creates or updates 4-hour follow-up tasks for the selected permissions.
  - Shows toast: 已发起必开权限申请.
  - Stays on page 03.
  - Shows “查看详情” for each started item.
- 可选权限 one-click opens confirmation modal.
- Confirming optional permissions:
  - Persists selected optional permissions as in-progress/submitted demo records.
  - Creates or updates 4-hour follow-up tasks for the selected permissions.
  - Shows toast: 已模拟发起可选权限申请.
  - Stays on page 03.
  - Keeps unselected sensitive permissions as “需确认”.
- Clicking “查看详情” routes to `/permission-detail/:id`.

## Page 04: 权限详情 / 进度登记

### Required Interactions

- “打开入口” shows toast only; no external navigation.
- “复制理由” copies or simulates copy and shows toast.
- “我已提交”:
  - Writes a `permission_progress` record or update.
  - Updates permission status to “已提交 / 待回访”.
  - Creates or updates a `follow_up_tasks` record with `submittedAt`, `followUpAt`, and `status`.
  - Shows toast: 已登记提交状态.
  - Routes to page 05.

## Page 05: 4 小时回访 / 未完成处理

### Required Logic

- Follow-up is triggered by page 04 “我已提交” and by confirmed page 03 one-click permission application selections in this MVP.
- One-click apply stays on page 03, persists selected permission progress, and creates follow-up tasks without calling real approval or Feishu APIs.
- Load and show only backend follow-up tasks with status “待回访”.
- If multiple tasks are waiting, provide an item switch card.

### Required Interactions

- “已完成” sets task to completed and stops reminders.
- “未完成” expands next-step card.
- “催办话术示例” shows editable text.
- “发送催办信息” shows mock toast only.
- “联系 Owner” opens owner modal.
- “匿名反馈” routes to page 07 with module context.

## Acceptance Criteria

- The core newcomer path can be clicked end-to-end.
- Real backend APIs are used for P0 permission package, progress, task state, and follow-up data.
- Real approval, Feishu, or external systems are not called.
- Page 03 stays on page after one-click apply.
- Page 05 can be opened from a persisted backend follow-up task created by page 04 “我已提交” or page 03 one-click application.
- Refreshing after “我已提交” preserves the progress and follow-up task.
- All relevant toast messages appear.
