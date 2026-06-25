# Phase 04 Spec: Admin Config And V1 Review

## Goal

Implement the owner-facing admin configuration page and V1 review page using real backend data for P0 tables.

## Scope

This phase covers page 08 后台配置维护台 and page 09 V1 灰度试点复盘.

## Page 08: 后台配置维护台

### Required Sections

- 岗位权限包管理.
- 新人首周反馈表.
- 匿名反馈池.
- 协同办公部门知识库.

### Required Interactions

- Knowledge tab route supports `/admin-config?tab=knowledge`.
- Feedback tab route supports `/admin-config?tab=feedback`.
- “知识库上传窗口” opens modal.
- Knowledge upload modal is still simulated for file parsing, but metadata is saved to the backend. The modal requires:
  - File selection mock.
  - Document name.
  - Knowledge category.
  - Owner.
  - Applicable role.
  - Applicable stage.
- “开始上传” saves a real `knowledge_base_docs` metadata record and shows toast: 已保存知识库资料元数据，解析和向量化仍为模拟状态.
- Uploaded metadata appears in the knowledge list after reload.
- Config edit/save writes to backend configuration tables and shows toast: 已保存配置.

## Anonymous Feedback Pool

Show backend fields:

- 反馈编号
- 反馈类型
- 关联模块
- 问题描述
- 是否匿名
- 提交时间
- 处理 Owner
- 处理状态
- 处理结论
- 是否进入复盘指标

Allowed status flow:

```text
待处理 → 处理中 → 已补充知识库 / 已修正权限入口 / 暂不处理 / 已关闭
```

## Page 09: V1 灰度试点复盘

### Required Sections

- 核心指标.
- 新人主流程漏斗.
- 权限申请未完成类型.
- 匿名反馈类型.
- 知识库缺口.
- 管理者摘要指标.
- 下轮内容补齐清单.

### Required Interactions

- Can jump to page 08 knowledge tab.
- Can jump to page 08 anonymous feedback tab.
- “生成 mock 复盘摘要” shows toast only.

## Acceptance Criteria

- Admin and review pages read from backend APIs.
- Knowledge file parsing/vectorization is simulated; metadata persistence is real.
- Anonymous feedback pool is visible in admin, not in manager pages.
- Review metrics match `reviewMetrics`.
- Review metrics are computed from backend tables where practical, with seeded fallback only for non-P0 demo metrics.
- Page 09 can route to the relevant admin tabs.
