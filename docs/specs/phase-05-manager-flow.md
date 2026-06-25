# Phase 05 Spec: Manager Flow

## Goal

Implement the manager-side overview, newcomer detail, and read-only weekly feedback view.

## Scope

This phase covers page 10, page 11, and page 12.

## Page 10: 管理者首页 / 今日新员工概览

### Required Content

- Header:
  - 首周入职管理
  - 仅显示入职第一周新人
- Today newcomer summary.
- Role statistics.
- Today arrival list.
- Bottom nav:
  - 总览
  - 新人
  - 反馈
  - 我的

### Required Interactions

- Clicking a newcomer routes to page 11.
- Clicking bottom “反馈”:
  - If weekly feedback exists, route to the most recently submitted feedback page 12.
  - If none exists, show toast: 暂无新人首周反馈.

## Page 11: 新人首周跟踪详情

### Required Content

- Newcomer info card.
- Completion summary.
- D1-D7 work summary.
- Weekly completion status.
- Current blockers.
- Manager suggestions.
- Weekly feedback summary only.

### Weekly Feedback Summary

Page 11 must not duplicate full page 12 content.

Required summary:

- Title: 新人入职首周反馈
- Status: 已提交反馈
- Summary text:
  - 整体顺利
  - 主要卡点：剩余权限开通
  - 希望支持：帮助跟进权限、安排轻量任务
- Tip: 完整反馈由新人填写，供管理者查看与跟进，不用于绩效评价。
- Button: 查看完整反馈

### Required Interactions

- “查看完整反馈” routes to page 12.
- Reminder actions use toast only.

## Page 12: 管理者视角 / 新人首周反馈

### Product Position

Page 12 is a manager read-only view of page 06 feedback. It is not an evaluation page.

### Required Content

- Header:
  - 新人首周反馈
  - 由入职者填写，供管理者查看与跟进
- Newcomer info card.
- Overall feeling.
- Blockers.
- Support needed.
- Newcomer message.
- Bottom reminder that feedback is not used for performance evaluation.

### Required Interactions

- “安排沟通”:
  - Persists `managerActionStatus` as “待沟通” or “已安排沟通”.
  - Shows toast: 已记录安排沟通动作.
  - When returning to page 11, feedback status can show “待沟通”.
- “记录已查看”:
  - Persists `managerViewedFeedback=true`.
  - Persists `managerActionStatus=已查看`.
  - Shows toast: 已记录查看.

### Empty State

If the newcomer has not submitted weekly feedback:

- Show: 新人暂未提交首周反馈.
- Show: 可在 D7 前提醒新人填写。
- Buttons:
  - 提醒新人填写
  - 返回详情
- “提醒新人填写” shows toast: 已模拟提醒新人填写首周反馈.

## Acceptance Criteria

- Manager bottom nav highlights page 10 as 总览, page 11 as 新人, and page 12 as 反馈.
- Page 11 only shows weekly feedback summary.
- Page 12 shows full weekly feedback.
- Page 12 is read-only.
- Refreshing page 12 preserves manager viewed/action state.
- No manager page displays anonymous feedback原文.
- No manager page includes performance evaluation or ability scoring.
