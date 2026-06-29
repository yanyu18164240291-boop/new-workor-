import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';

import { DataTable, type DataTableColumn } from '../../components/admin-config/DataTable.tsx';
import { FieldError } from '../../components/admin-config/FieldError.tsx';
import { RightDrawer } from '../../components/admin-config/RightDrawer.tsx';
import { StatusTag } from '../../components/admin-config/StatusTag.tsx';
import { formatApiErrorMessage, type PermissionItem } from '../../api.ts';
import type { DashboardData } from '../../dashboardData.ts';
import { createPermissionForRole, saveRolePackagePermission } from '../../services/adminConfigApi.ts';
import type { AdminConfigFilters } from '../../types/adminConfig.ts';

type RolePackagesTabProps = {
  data: DashboardData;
  filters: AdminConfigFilters;
  toast: (message: string) => void;
  reload: () => Promise<void>;
};

type PermissionDraft = Omit<PermissionItem, 'id' | 'sensitive'> & {
  id?: string;
  sensitive?: boolean;
};

type PermissionScope = 'all' | 'required' | 'optional' | 'disabled';

const blankPermissionDraft: PermissionDraft = {
  name: '',
  category: '办公基础',
  permissionType: 'optional',
  ownerType: 'department',
  ownerName: '',
  ownerContact: '',
  applyEntryName: '',
  applyUrl: 'mock-feishu://approval/',
  reasonTemplate: '',
  approverName: '',
  commonWaitingReasons: [''],
  enabled: true,
};

function waitingReasonsText(item: PermissionDraft): string {
  return item.commonWaitingReasons.join('\n');
}

function splitWaitingReasons(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function validatePermissionDraft(draft: PermissionDraft): string {
  const requiredFields: Array<[string, string | undefined]> = [
    ['权限名称', draft.name],
    ['所属分类', draft.category],
    ['Owner 名称', draft.ownerName],
    ['Owner 联系方式', draft.ownerContact],
    ['申请入口名称', draft.applyEntryName],
    ['申请入口 URL', draft.applyUrl],
    ['审批人', draft.approverName],
    ['理由模板', draft.reasonTemplate],
  ];
  const missing = requiredFields.find(([, value]) => !value?.trim());
  if (missing) return `${missing[0]}不能为空`;
  if (!['mock-feishu://', 'http://', 'https://'].some((scheme) => draft.applyUrl.trim().startsWith(scheme))) {
    return '申请入口 URL 仅支持 mock-feishu://、http://、https://';
  }
  return '';
}

function ownerTypeLabel(value: string) {
  if (value === 'personal') return '个人';
  if (value === 'group') return '群';
  return '部门';
}

function normalizeDraft(permission: PermissionItem): PermissionDraft {
  return {
    ...permission,
    ownerType: permission.ownerType || 'department',
    applyEntryName: permission.applyEntryName || permission.name,
    commonWaitingReasons: permission.commonWaitingReasons.length > 0 ? permission.commonWaitingReasons : [''],
  };
}

export function RolePackagesTab({ data, filters, toast, reload }: RolePackagesTabProps) {
  const roles = data.admin?.roles ?? [];
  const rolePermissionItems = data.admin?.rolePermissionItems ?? [];
  const permissions = data.admin?.permissionItems ?? [];
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? '');
  const [scope, setScope] = useState<PermissionScope>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<PermissionDraft>(blankPermissionDraft);
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedRoleId && roles[0]) setSelectedRoleId(roles[0].id);
  }, [roles, selectedRoleId]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];
  const rolePermissionIds = new Set(rolePermissionItems.filter((item) => item.roleId === selectedRole?.id).map((item) => item.permissionItemId));
  const rolePermissions = rolePermissionIds.size > 0 ? permissions.filter((item) => rolePermissionIds.has(item.id)) : permissions;
  const requiredCount = rolePermissions.filter((item) => item.permissionType === 'required' && item.enabled).length;
  const optionalCount = rolePermissions.filter((item) => item.permissionType === 'optional' && item.enabled).length;
  const enabledCount = rolePermissions.filter((item) => item.enabled).length;
  const completeness = rolePermissions.length === 0 ? 0 : Math.round((enabledCount / rolePermissions.length) * 100);

  const filteredPermissions = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return rolePermissions.filter((item) => {
      const matchesKeyword =
        !keyword ||
        [item.name, item.category, item.ownerName, item.ownerContact, item.applyEntryName, item.applyUrl, item.approverName]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      const matchesStatus =
        filters.status === '全部状态' ||
        (filters.status === '启用' && item.enabled) ||
        (filters.status === '停用' && !item.enabled) ||
        !['启用', '停用'].includes(filters.status);
      const matchesScope =
        scope === 'all' ||
        (scope === 'required' && item.permissionType === 'required' && item.enabled) ||
        (scope === 'optional' && item.permissionType === 'optional' && item.enabled) ||
        (scope === 'disabled' && !item.enabled);
      return matchesKeyword && matchesStatus && matchesScope;
    });
  }, [filters.keyword, filters.status, rolePermissions, scope]);

  function openEdit(permission: PermissionItem) {
    setDraft(normalizeDraft(permission));
    setFieldError('');
    setDrawerOpen(true);
  }

  function openCreate() {
    setDraft(blankPermissionDraft);
    setFieldError('');
    setDrawerOpen(true);
  }

  function patchDraft(patch: Partial<PermissionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function saveDraft() {
    const validation = validatePermissionDraft(draft);
    if (validation) {
      setFieldError(validation);
      return;
    }
    if (!selectedRole?.id) {
      setFieldError('请先选择岗位');
      return;
    }
    setSaving(true);
    setFieldError('');
    try {
      const payload = { ...draft, commonWaitingReasons: draft.commonWaitingReasons.filter(Boolean) };
      if (draft.id) {
        await saveRolePackagePermission(draft.id, payload);
        toast('已保存权限配置');
      } else {
        await createPermissionForRole(selectedRole.id, payload as Omit<PermissionItem, 'id' | 'sensitive'>);
        toast('已新增权限项并加入当前岗位权限包');
      }
      setDrawerOpen(false);
      await reload();
    } catch (error) {
      setFieldError(formatApiErrorMessage(error, '保存失败，请检查字段'));
    } finally {
      setSaving(false);
    }
  }

  async function disablePermission(permission: PermissionItem) {
    setSaving(true);
    try {
      await saveRolePackagePermission(permission.id, { enabled: false });
      toast('已停用权限项，历史进度仍会保留');
      await reload();
    } catch (error) {
      toast(formatApiErrorMessage(error, '停用失败'));
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<PermissionItem>> = [
    { key: 'name', title: '权限名称', render: (item) => <strong>{item.name}</strong> },
    { key: 'category', title: '所属分类', render: (item) => item.category },
    {
      key: 'type',
      title: '权限类型',
      render: (item) => <StatusTag tone={item.permissionType === 'required' ? 'blue' : 'warning'}>{item.permissionType === 'required' ? '必开' : '可选'}</StatusTag>,
    },
    { key: 'owner', title: 'Owner 名称', render: (item) => `${ownerTypeLabel(item.ownerType)} · ${item.ownerName}` },
    { key: 'applyEntry', title: '申请入口名称', render: (item) => item.applyEntryName || item.name },
    { key: 'approver', title: '审批人', render: (item) => item.approverName },
    { key: 'reasons', title: '常见等待原因数量', render: (item) => item.commonWaitingReasons.length },
    { key: 'status', title: '状态', render: (item) => <StatusTag tone={item.enabled ? 'success' : 'neutral'}>{item.enabled ? '启用' : '停用'}</StatusTag> },
    { key: 'updatedBy', title: 'updatedBy', render: (item) => item.updatedBy ?? 'demo-admin' },
    {
      key: 'actions',
      title: '操作',
      render: (item) => (
        <div className="admin-table-actions">
          <button type="button" onClick={() => openEdit(item)}>
            编辑
          </button>
          <button type="button" disabled={!item.enabled || saving} onClick={() => void disablePermission(item)}>
            停用
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-workbench-panel">
      <div className="admin-page-title">
        <span>Page 08</span>
        <h1>岗位权限包管理</h1>
        <p>配置指定岗位需要的必开权限和可选权限，保存后同步影响新人权限引导。</p>
      </div>

      <div className="admin-role-summary-grid">
        <section className="admin-card">
          <div className="admin-section-heading">
            <h2>当前岗位信息</h2>
            <select value={selectedRole?.id ?? ''} onChange={(event) => setSelectedRoleId(event.target.value)}>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <dl className="admin-definition-list">
            <dt>当前岗位</dt>
            <dd>{selectedRole?.name ?? '-'}</dd>
            <dt>所属部门</dt>
            <dd>{selectedRole?.department ?? '-'}</dd>
            <dt>岗位描述</dt>
            <dd>{selectedRole?.description ?? '-'}</dd>
          </dl>
        </section>

        <section className="admin-card">
          <h2>权限包完整度</h2>
          <div className="admin-completeness-ring">{completeness}%</div>
          <div className="admin-package-counts">
            <span>必开权限 {requiredCount} 个</span>
            <span>可选权限 {optionalCount} 个</span>
            <span>总权限项 {rolePermissions.length} 个</span>
          </div>
        </section>
      </div>

      <section className="admin-card">
        <div className="admin-section-heading">
          <div className="admin-tab-row">
            <button className={scope === 'all' ? 'active' : ''} type="button" onClick={() => setScope('all')}>
              全部权限项
            </button>
            <button className={scope === 'required' ? 'active' : ''} type="button" onClick={() => setScope('required')}>
              必开权限
            </button>
            <button className={scope === 'optional' ? 'active' : ''} type="button" onClick={() => setScope('optional')}>
              可选权限
            </button>
            <button className={scope === 'disabled' ? 'active' : ''} type="button" onClick={() => setScope('disabled')}>
              停用权限
            </button>
          </div>
          <div className="admin-toolbar-actions">
            <button className="admin-primary-action" type="button" onClick={openCreate}>
              <Plus size={16} />
              新增权限项
            </button>
            <button className="admin-icon-action" type="button" onClick={() => void reload()} aria-label="刷新岗位权限包">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <DataTable columns={columns} rows={filteredPermissions} getRowKey={(item) => item.id} emptyText="暂无权限项" />
      </section>

      <RightDrawer
        title={draft.id ? '编辑权限项' : '新增权限项'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <button className="admin-secondary-action" type="button" onClick={() => setDrawerOpen(false)}>
              取消
            </button>
            <button className="admin-primary-action" type="button" disabled={saving} onClick={() => void saveDraft()}>
              保存权限配置
            </button>
          </>
        }
      >
        <div className="admin-drawer-form">
          <FieldError message={fieldError} />
          <label>
            权限名称 <b>*</b>
            <input value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} />
          </label>
          <label>
            所属分类 <b>*</b>
            <input value={draft.category} onChange={(event) => patchDraft({ category: event.target.value })} />
          </label>
          <fieldset>
            <legend>
              权限类型 <b>*</b>
            </legend>
            <label>
              <input type="radio" checked={draft.permissionType === 'required'} onChange={() => patchDraft({ permissionType: 'required' })} />
              必开
            </label>
            <label>
              <input type="radio" checked={draft.permissionType === 'optional'} onChange={() => patchDraft({ permissionType: 'optional' })} />
              可选
            </label>
          </fieldset>
          <label>
            Owner 类型 <b>*</b>
            <select value={draft.ownerType} onChange={(event) => patchDraft({ ownerType: event.target.value })}>
              <option value="personal">个人</option>
              <option value="department">部门</option>
              <option value="group">群</option>
            </select>
          </label>
          <label>
            Owner 名称 <b>*</b>
            <input value={draft.ownerName} onChange={(event) => patchDraft({ ownerName: event.target.value })} />
          </label>
          <label>
            Owner 联系方式 <b>*</b>
            <input value={draft.ownerContact} onChange={(event) => patchDraft({ ownerContact: event.target.value })} />
          </label>
          <label>
            申请入口名称 <b>*</b>
            <input value={draft.applyEntryName} onChange={(event) => patchDraft({ applyEntryName: event.target.value })} />
          </label>
          <label>
            申请入口 URL <b>*</b>
            <input value={draft.applyUrl} onChange={(event) => patchDraft({ applyUrl: event.target.value })} />
          </label>
          <label>
            审批人 <b>*</b>
            <input value={draft.approverName} onChange={(event) => patchDraft({ approverName: event.target.value })} />
          </label>
          <label>
            理由模板 <b>*</b>
            <textarea value={draft.reasonTemplate} onChange={(event) => patchDraft({ reasonTemplate: event.target.value })} />
          </label>
          <label>
            常见等待原因
            <textarea value={waitingReasonsText(draft)} onChange={(event) => patchDraft({ commonWaitingReasons: splitWaitingReasons(event.target.value) })} />
          </label>
          <label className="admin-switch-row">
            启用状态
            <input type="checkbox" checked={draft.enabled} onChange={(event) => patchDraft({ enabled: event.target.checked })} />
          </label>
        </div>
      </RightDrawer>
    </div>
  );
}
