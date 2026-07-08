# Phase 08 Spec: 首页 AI 对话问答 + RAG + 新人入职知识库

## Goal

把首页 AI 对话从前端模拟回复升级为真实后端 API，并用后台配置维护台中的新人入职知识库提供最小可用 RAG 问答能力。

## Scope

- 首页 `/` 的 AI 对话问答请求走 Node 后端 API。
- 后台 `/admin-config?tab=knowledge` 可保存可检索的知识正文和检索关键词。
- RAG 使用 SQLite 中已启用、已解析、向量状态 ready 的知识资料作为检索来源。
- 问答结果返回 answer、mode、citations，首页展示后端答案。
- 命中文档后更新知识库 `hitCount`，用于后台运营判断。

## Architecture

最小可用 RAG 架构采用本地可验证链路：

1. Admin 在知识库维护台录入资料元数据、知识正文、检索关键词。
2. 后端将资料写入 SQLite `knowledge_base_docs`。
3. Admin 触发当前已有的解析/向量 ready 状态流转后，资料可被启用。
4. 首页向 `/api/newcomers/:id/ai-chat` 发送问题。
5. 后端按角色、启用状态、正文和关键词做本地检索，选取最高分资料。
6. 后端用命中的知识片段合成 grounded answer，并返回引用来源。

本阶段不接外部 LLM，不接外部向量库；“RAG”在本阶段指真实后端检索、真实知识库数据、可追溯引用和前端问答闭环。

## Data Boundary

- 使用现有 SQLite 数据库和迁移机制。
- 允许扩展 SQLite `knowledge_base_docs` 字段。
- 不修改 MySQL；MySQL 后续单独分支迁移。
- 不把知识正文只保存在 React state。
- 不让首页直接读取 SQL，前端只能调用 API client。

## Product Boundaries

- 不进入真实审批流程。
- 不新增真实审批提交、审批回调或审批状态同步。
- 不新增真实文件上传解析。
- 不新增真实消息发送能力。
- 不向管理者暴露匿名反馈原文。
- 不做员工能力评分、绩效评价或排序。

## Backend API

### `POST /api/newcomers/:id/ai-chat`

Request:

```json
{
  "question": "VPN 怎么开通？"
}
```

Response:

```json
{
  "data": {
    "mode": "local_rag",
    "answer": "根据知识库：...",
    "citations": [
      {
        "docId": "kb-001",
        "title": "VPN 开通说明",
        "ownerName": "IT 支持组",
        "sourceUrl": "mock-drive://vpn-guide"
      }
    ]
  }
}
```

No-match response:

```json
{
  "data": {
    "mode": "no_match",
    "answer": "暂时没有找到可引用的知识库资料，请联系新人入职支持同学补充知识库。",
    "citations": []
  }
}
```

## Acceptance Criteria

- Phase 08 规格文档存在，并明确不修改 MySQL、不进入真实审批流程。
- Admin 创建知识资料时可以保存 `contentText` 和 `retrievalKeywords`。
- 首页问题通过真实后端 API 返回 RAG 答案和 citations。
- 只检索 `enabled + parsed + ready` 的知识资料。
- 命中文档后 `hitCount` 持久化增加，刷新后仍可读。
- 无命中时返回安全兜底答案，不编造来源。
- `npm.cmd test` 通过。
- `npm.cmd run build` 通过。
