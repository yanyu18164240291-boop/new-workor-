# Phase 03 Spec: Weekly Feedback And Anonymous Feedback

## Goal

Implement the two separate feedback flows and keep their purpose, data, and visibility boundaries clear.

## Scope

This phase covers page 06 新人首周反馈填写 and page 07 匿名反馈, plus their entries from page 01 and page 05.

## Page 06: 新人首周反馈填写

### Product Position

Page 06 is not anonymous. It is written by the newcomer and shown to managers for support and follow-up. It is not used for performance evaluation.

### Required Content

- Header:
  - 新人首周反馈
  - 写给管理者的入职第一周感受
- Explanation card saying the feedback is visible to the manager and not for performance evaluation.
- Newcomer info card.
- Single-choice “首周整体感受”:
  - 适应中
  - 整体顺利
  - 有些压力
- Multi-choice “目前主要卡点”:
  - 剩余权限开通
  - 业务背景理解
  - 工具使用
  - 任务节奏
  - 暂无明显卡点
- Multi-choice “希望管理者提供的支持”:
  - 帮助跟进权限
  - 补充业务介绍
  - 安排轻量任务
  - 明确优先级
  - 暂时不需要
- Text area “新人想说的话” with 500-character limit.

### Validation

- Must select one overall feeling.
- Must select at least one blocker.
- Must select at least one support item.
- Message is optional.

### Required Interactions

- “提交反馈” posts to the backend and writes or updates `weekly_feedbacks`.
- After submit, backend sets the newcomer `weeklyFeedbackSubmitted=true`.
- Show success state:
  - 已提交首周反馈
  - 管理者将可以查看你的反馈，并根据需要安排沟通或支持。
- Success action “返回首页” routes to page 01.
- “稍后填写” returns to previous page and does not change submit state.

## Page 07: 匿名反馈

### Product Position

Page 07 is anonymous process feedback. It goes to product/content owners through the admin anonymous feedback pool. It must not be shown to managers as原文.

### Required Content

- Header:
  - 匿名反馈
  - 反馈入职流程中的问题
- Explanation card about process optimization and no performance evaluation.
- Feedback type selector.
- Related module selector.
- Problem description text area.
- Expected action selector.
- Anonymous toggle enabled by default.
- Optional contact fields only when anonymous is off.

### Validation

- Must select feedback type.
- Must fill problem description.
- If anonymous is off, show, validate, and persist contact fields in `anonymous_feedbacks`; do not use them to send real messages.

### Required Interactions

- Submit posts to the backend and writes to `anonymous_feedbacks`.
- Submit shows success card with feedback id.
- “返回首页” routes to page 01.
- “继续反馈” resets the form.
- Cancel returns to previous page.

## Acceptance Criteria

- Page 06 and page 07 are visually and semantically distinct.
- Weekly feedback is not anonymous and is visible to manager page 12.
- Anonymous feedback is not visible in manager page 11 or page 12 as原文.
- Both forms validate as specified.
- Both flows persist to the backend and can be reloaded after refresh.
- Contact fields remain P0 data fields only; do not connect to real messaging.
