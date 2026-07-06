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
    return 'OA 系统通常先完成 D1 引导和部门群加入，再按权限包里的入口登录；如果登录失败，可以在权限详情里登记进度。';
  }
  if (normalized.includes('今天') || normalized.includes('先做')) {
    return '建议先完成 D1 引导，再处理岗位权限包；提交权限后我会生成 4 小时回访，帮你跟进还未完成的事项。';
  }

  return '我已收到你的问题。当前演示版会优先引导 D1 到达、权限申请、首周反馈和匿名反馈；真实智能问答仍保持模拟，不会调用外部 LLM。';
}
