import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createInitialApplySelection,
  filterSelectablePermissions,
  mapPermissionUiStatus,
  toggleApplySelection,
} from '../src/frontend/permissionSelection.ts';

describe('permission apply selection model', () => {
  it('defaults permissions to selected and lets the newcomer unselect and reselect them', () => {
    const initial = createInitialApplySelection(['perm-oa', 'perm-mail']);
    assert.deepEqual([...initial], ['perm-oa', 'perm-mail']);

    const afterCancel = toggleApplySelection(initial, 'perm-mail');
    assert.deepEqual([...afterCancel], ['perm-oa']);

    const afterReselect = toggleApplySelection(afterCancel, 'perm-mail');
    assert.deepEqual([...afterReselect], ['perm-oa', 'perm-mail']);
  });

  it('only exposes the four product-facing permission statuses', () => {
    assert.deepEqual(mapPermissionUiStatus(undefined), { chip: '未申请', tone: 'warning' });
    assert.deepEqual(mapPermissionUiStatus('pending'), { chip: '进行中', tone: 'blue' });
    assert.deepEqual(mapPermissionUiStatus('submitted'), { chip: '进行中', tone: 'blue' });
    assert.deepEqual(mapPermissionUiStatus('completed'), { chip: '已完成', tone: 'success' });
    assert.deepEqual(mapPermissionUiStatus('rejected'), { chip: '被驳回', tone: 'danger' });
  });

  it('hides permissions that already have an application record from the one-click modal', () => {
    const selectable = filterSelectablePermissions(
      [
        { id: 'perm-oa' },
        { id: 'perm-mail' },
        { id: 'perm-chatgpt' },
      ],
      [
        { permissionItemId: 'perm-oa', status: 'submitted' },
        { permissionItemId: 'perm-chatgpt', status: 'completed' },
      ],
    );

    assert.deepEqual(selectable.map((item) => item.id), ['perm-mail']);
  });
});
