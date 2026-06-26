import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isSubmittedPermissionStatus,
  parseAnonymousFeedbackStatus,
  parseFollowUpStatus,
  parseManagerActionStatus,
  parsePermissionProgressStatus,
  parseTaskStatus,
  parseWeeklyAnswerInputs,
} from '../src/server/contracts.ts';

describe('backend API contracts', () => {
  it('accepts only product-facing permission progress statuses', () => {
    assert.equal(parsePermissionProgressStatus('submitted'), 'submitted');
    assert.equal(parsePermissionProgressStatus(undefined), 'submitted');
    assert.equal(isSubmittedPermissionStatus('submitted'), true);
    assert.equal(isSubmittedPermissionStatus('completed'), true);
    assert.equal(isSubmittedPermissionStatus('pending'), false);
    assert.throws(() => parsePermissionProgressStatus('waiting'));
  });

  it('keeps task, follow-up, feedback, and manager action statuses constrained', () => {
    assert.equal(parseTaskStatus(undefined), 'completed');
    assert.equal(parseFollowUpStatus(undefined, 'pending'), 'pending');
    assert.equal(parseAnonymousFeedbackStatus(undefined, 'open'), 'open');
    assert.equal(parseManagerActionStatus(undefined, 'unread'), 'unread');
    assert.equal(parseManagerActionStatus('pending_follow_up', 'unread'), 'pending_follow_up');

    assert.throws(() => parseTaskStatus('done'));
    assert.throws(() => parseFollowUpStatus('waiting'));
    assert.throws(() => parseAnonymousFeedbackStatus('deleted', 'open'));
    assert.throws(() => parseManagerActionStatus('ranked', 'unread'));
  });

  it('filters weekly feedback answers to structurally valid inputs', () => {
    assert.deepEqual(
      parseWeeklyAnswerInputs([
        { questionId: 'q1', selectedOptionIds: ['a', 'b'] },
        { questionId: 'q2', textValue: 'hello' },
        { questionId: '', textValue: 'ignored' },
        { questionId: 'q3', selectedOptionIds: [1] },
        null,
      ]),
      [
        { questionId: 'q1', selectedOptionIds: ['a', 'b'] },
        { questionId: 'q2', textValue: 'hello' },
      ],
    );
  });
});
