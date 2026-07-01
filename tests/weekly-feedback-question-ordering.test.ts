import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { moveWeeklyQuestionByStep } from '../src/frontend/weeklyFeedbackQuestionOrdering.ts';

const questions = [
  { id: 'q1', sortOrder: 1 },
  { id: 'q2', sortOrder: 2 },
  { id: 'q3', sortOrder: 3 },
  { id: 'q4', sortOrder: 4 },
];

describe('weekly feedback question ordering', () => {
  it('moves a visible question down and returns persisted sort orders for all questions', () => {
    const result = moveWeeklyQuestionByStep(questions, ['q1', 'q2', 'q3', 'q4'], 'q2', 1);

    assert.deepEqual(result.orderedIds, ['q1', 'q3', 'q2', 'q4']);
    assert.deepEqual(result.persistedSortOrders, [
      { id: 'q1', sortOrder: 1 },
      { id: 'q3', sortOrder: 2 },
      { id: 'q2', sortOrder: 3 },
      { id: 'q4', sortOrder: 4 },
    ]);
  });

  it('moves within the visible filtered order without dropping hidden questions', () => {
    const result = moveWeeklyQuestionByStep(questions, ['q1', 'q3', 'q4'], 'q3', -1);

    assert.deepEqual(result.orderedIds, ['q3', 'q1', 'q2', 'q4']);
    assert.deepEqual(result.persistedSortOrders.map((item) => item.id), ['q3', 'q1', 'q2', 'q4']);
  });

  it('returns the same order when moving past the visible boundary', () => {
    const result = moveWeeklyQuestionByStep(questions, ['q1', 'q2'], 'q1', -1);

    assert.deepEqual(result.orderedIds, ['q1', 'q2', 'q3', 'q4']);
    assert.equal(result.changed, false);
  });
});
