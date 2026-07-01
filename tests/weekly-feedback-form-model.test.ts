import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildWeeklyFeedbackAnswers, findMissingWeeklyRequiredQuestion } from '../src/frontend/weeklyFeedbackFormModel.ts';
import type { WeeklyFeedbackQuestion } from '../src/frontend/api.ts';

function textQuestion(id: string, title: string, required = false): WeeklyFeedbackQuestion {
  return {
    id,
    questionKey: id,
    title,
    description: '',
    inputType: 'text',
    required,
    maxLength: 500,
    enabled: true,
    sortOrder: 1,
    updatedBy: 'demo-admin',
    options: [],
  };
}

describe('weekly feedback form model', () => {
  it('keeps text answers isolated by question id', () => {
    const questions = [textQuestion('wfq-message', '新人想说的话'), textQuestion('weekly-question-summary', '首周工作摘要')];

    const answers = buildWeeklyFeedbackAnswers(questions, {}, {
      'wfq-message': '想补充权限体验',
      'weekly-question-summary': '本周完成入职学习',
    });

    assert.deepEqual(answers, [
      { questionId: 'wfq-message', textValue: '想补充权限体验' },
      { questionId: 'weekly-question-summary', textValue: '本周完成入职学习' },
    ]);
  });

  it('treats required text questions as missing when their own answer is empty', () => {
    const questions = [textQuestion('wfq-message', '新人想说的话'), textQuestion('weekly-question-summary', '首周工作摘要', true)];

    const missing = findMissingWeeklyRequiredQuestion(questions, {}, { 'wfq-message': '只填写了新人想说的话' });

    assert.equal(missing?.id, 'weekly-question-summary');
  });
});
