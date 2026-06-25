export type AnonymousSectionKey = 'intro' | 'description' | 'module' | 'type' | 'expectedAction' | 'actions';

export type AnonymousFeedbackFlow = {
  sections: Array<{ key: AnonymousSectionKey; title: string; required?: boolean; suffix?: string }>;
  description: {
    required: boolean;
    placeholder: string;
  };
  modules: string[];
  problemTypes: {
    selection: 'single';
    options: string[];
  };
  expectedActions: {
    selection: 'multi';
    options: string[];
  };
};

export function getAnonymousFeedbackFlow(): AnonymousFeedbackFlow {
  return {
    sections: [
      { key: 'intro', title: '说明卡片' },
      { key: 'description', title: '问题描述', required: true },
      { key: 'module', title: '关联模块', required: true },
      { key: 'type', title: '你遇到的是哪类问题？', required: true },
      { key: 'expectedAction', title: '希望如何处理', suffix: '（多选）' },
      { key: 'actions', title: '取消 + 提交反馈' },
    ],
    description: {
      required: true,
      placeholder: '请描述你遇到的问题\n例如：ChatGPT账号申请入口不清楚，不知道是否要先找导师确认。',
    },
    modules: ['知识问答', 'D1引导', '权限申请', '4小时回访', '其他'],
    problemTypes: {
      selection: 'single',
      options: ['权限/审批卡住', '工具入口找不到', '资料/SOP不清楚', 'AI回答不准确'],
    },
    expectedActions: {
      selection: 'multi',
      options: ['补充/修正入口', '更新知识库/SOP', '转给Owner核对', '其他'],
    },
  };
}

export function toggleMultiChoice(current: string[], value: string): string[] {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export function shouldShowAnonymousContactConsent(expectedActions: string[]): boolean {
  return expectedActions.includes('其他');
}
