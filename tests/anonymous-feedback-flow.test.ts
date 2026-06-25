import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getAnonymousFeedbackFlow,
  shouldShowAnonymousContactConsent,
  toggleMultiChoice,
} from '../src/frontend/anonymousFeedbackModel.ts';

describe('anonymous feedback flow model', () => {
  it('keeps the requested interaction order and option copy', () => {
    const flow = getAnonymousFeedbackFlow();

    assert.deepEqual(
      flow.sections.map((section) => [section.key, section.title, section.required ?? false, section.suffix ?? '']),
      [
        ['intro', '说明卡片', false, ''],
        ['description', '问题描述', true, ''],
        ['module', '关联模块', true, ''],
        ['type', '你遇到的是哪类问题？', true, ''],
        ['expectedAction', '希望如何处理', false, '（多选）'],
        ['actions', '取消 + 提交反馈', false, ''],
      ],
    );
    assert.equal(flow.description.required, true);
    assert.deepEqual(flow.modules, ['知识问答', 'D1引导', '权限申请', '4小时回访', '其他']);
    assert.equal(flow.problemTypes.selection, 'single');
    assert.deepEqual(flow.problemTypes.options, ['权限/审批卡住', '工具入口找不到', '资料/SOP不清楚', 'AI回答不准确']);
    assert.equal(flow.expectedActions.selection, 'multi');
    assert.deepEqual(flow.expectedActions.options, ['补充/修正入口', '更新知识库/SOP', '转给Owner核对', '其他']);
  });

  it('toggles expected actions and only expands contact consent when other is selected', () => {
    const selected = toggleMultiChoice([], '补充/修正入口');
    assert.deepEqual(selected, ['补充/修正入口']);
    assert.deepEqual(toggleMultiChoice(selected, '补充/修正入口'), []);

    assert.equal(shouldShowAnonymousContactConsent(['补充/修正入口']), false);
    assert.equal(shouldShowAnonymousContactConsent(['其他']), true);
  });
});
