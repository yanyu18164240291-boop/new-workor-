export type HomeChatMessage = {
  id: string;
  role: 'user' | 'bot';
  text: string;
};

export function buildHomeBotReply(question: string): string {
  const normalized = question.trim().toLowerCase();

  if (!normalized) return '';
  if (normalized.includes('chatgpt')) {
    return '你可以进入“权限申请”，打开 ChatGPT 账号详情，复制申请理由后提交审批；提交后回到详情页点击“我已提交”，首页进度会同步更新。';
  }
  if (normalized.includes('oa')) {
    return '进入“权限申请”查看 OA 系统对应权限，确认申请入口和理由模板；提交后可在权限详情里登记进度。';
  }
  if (normalized.includes('今天') || normalized.includes('先做')) {
    return '建议先核对岗位权限包，优先处理必开权限；提交后我会生成回访任务，帮你跟进还未完成的事项。';
  }

  return '我已收到你的问题。你可以查询权限用途、申请入口、理由模板和处理进度；没有命中时我会给出安全兜底提示。';
}
