import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildHomeProgressStats } from '../src/frontend/homeProgress.ts';

describe('home progress summary', () => {
  it('summarizes opened required/optional permissions and pending follow-ups', () => {
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
    });

    assert.deepEqual(stats, [
      { value: '2/2', label: '必开权限' },
      { value: '3/3', label: '可选权限' },
      { value: 1, label: '待回访权限' },
    ]);
  });
});
