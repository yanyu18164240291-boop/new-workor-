import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildHomeProgressStats } from '../src/frontend/homeProgress.ts';

describe('home progress summary', () => {
  it('summarizes opened required/optional permissions, pending follow-ups, and org-join stage', () => {
    const stats = buildHomeProgressStats({
      permissions: [
        { id: 'perm-oa', permissionType: 'required' },
        { id: 'perm-mail', permissionType: 'required' },
        { id: 'perm-bpm', permissionType: 'optional' },
        { id: 'perm-chatgpt', permissionType: 'optional' },
        { id: 'perm-qoderwork', permissionType: 'optional' },
      ],
      progress: [
        { permissionItemId: 'perm-oa', status: 'completed' },
        { permissionItemId: 'perm-mail', status: 'completed' },
        { permissionItemId: 'perm-bpm', status: 'completed' },
        { permissionItemId: 'perm-chatgpt', status: 'completed' },
        { permissionItemId: 'perm-qoderwork', status: 'completed' },
      ],
      followUps: [
        { permissionItemId: 'perm-oa', status: 'resolved' },
        { permissionItemId: 'perm-chatgpt', status: 'pending' },
      ],
      newcomer: {
        stage: 'D1',
        taskStates: [
          {
            taskKey: 'join_feishu_org',
            taskName: '加入飞书组织群',
            status: 'completed',
            completedAt: '2026-06-19T02:00:00.000Z',
          },
        ],
      },
      now: new Date('2026-06-25T04:00:00.000Z'),
    });

    assert.deepEqual(stats, [
      { value: '2/2', label: '必开权限' },
      { value: '3/3', label: '可选权限' },
      { value: 1, label: '待回访权限' },
      { value: 'D7', label: '入职阶段' },
    ]);
  });
});
