import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';

import { DataTable, type DataTableColumn } from '../../components/admin-config/DataTable.tsx';
import { FieldError } from '../../components/admin-config/FieldError.tsx';
import { RightDrawer } from '../../components/admin-config/RightDrawer.tsx';
import { StatusTag } from '../../components/admin-config/StatusTag.tsx';
import { formatApiErrorMessage, type PermissionItem, type Role } from '../../api.ts';
import type { DashboardData } from '../../dashboardData.ts';
import {
  bindExistingPermissionForRole,
  createPermissionForRole,
  createRoleForPackage,
  saveRoleForPackage,
  saveRolePackagePermission,
} from '../../services/adminConfigApi.ts';
import type { AdminConfigFilters } from '../../types/adminConfig.ts';

type RolePackagesTabProps = {
  data: DashboardData;
  filters: AdminConfigFilters;
  search?: string;
  toast: (message: string) => void;
  reload: () => Promise<void>;
};

type PermissionDraft = Omit<PermissionItem, 'id' | 'sensitive'> & {
  id?: string;
  sensitive?: boolean;
};

type PermissionScope = 'all' | 'required' | 'optional' | 'disabled';
type RoleDraft = Pick<Role, 'name' | 'department' | 'description'> & { id?: string; enabled?: boolean };

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

const blankRoleDraft: RoleDraft = {
  name: '',
  department: '协同办公部门',
  description: '',
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
  if (draft.permissionType === 'required' && !draft.enabled) {
    return '必开权限必须保持启用，如需暂停请先调整为可选权限。';
  }
  return '';
}

function validateRoleDraft(draft: RoleDraft): string {
  if (!draft.name.trim()) return '岗位名称不能为空';
  if (!draft.department.trim()) return '所属部门不能为空';
  if (!draft.description.trim()) return '岗位描述不能为空';
  return '';
}

function isRequiredPermission(permission: Pick<PermissionDraft, 'permissionType'>): boolean {
  return permission.permissionType === 'required';
}

function getPermissionDisableHint(permission: Pick<PermissionItem, 'permissionType' | 'enabled'>): string {
  if (isRequiredPermission(permission)) return '必开权限不能停用，请先调整为可选权限。';
  if (!permission.enabled) return '权限项已停用';
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

export function RolePackagesTab({ data, filters, search = '', toast, reload }: RolePackagesTabProps) {
  const roles = data.admin?.roles ?? [];
  const rolePermissionItems = data.admin?.rolePermissionItems ?? [];
  const permissions = data.admin?.permissionItems ?? [];
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? '');
  const [scope, setScope] = useState<PermissionScope>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<PermissionDraft>(blankPermissionDraft);
  const [bindDrawerOpen, setBindDrawerOpen] = useState(false);
  const [bindPermissionId, setBindPermissionId] = useState('');
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [roleDraft, setRoleDraft] = useState<RoleDraft>(blankRoleDraft);
  const [fieldError, setFieldError] = useState('');
  const [bindFieldError, setBindFieldError] = useState('');
  const [roleFieldError, setRoleFieldError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedRoleId && roles[0]) setSelectedRoleId(roles[0].id);
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (new URLSearchParams(search).get('action') === 'new-role') openCreateRole();
  }, [search]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];
  const rolePermissionIds = new Set(rolePermissionItems.filter((item) => item.roleId === selectedRole?.id).map((item) => item.permissionItemId));
  const rolePermissions = permissions.filter((item) => rolePermissionIds.has(item.id));
  const bindablePermissions = permissions.filter((item) => !rolePermissionIds.has(item.id));
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

  function openBindExisting() {
    setBindPermissionId(bindablePermissions[0]?.id ?? '');
    setBindFieldError('');
    setBindDrawerOpen(true);
  }

  function openCreateRole() {
    setRoleDraft(blankRoleDraft);
    setRoleFieldError('');
    setRoleDrawerOpen(true);
  }

  function openEditRole() {
    if (!selectedRole) return;
    setRoleDraft({
      id: selectedRole.id,
      name: selectedRole.name,
      department: selectedRole.department,
      description: selectedRole.description,
      enabled: selectedRole.enabled !== false,
    });
    setRoleFieldError('');
    setRoleDrawerOpen(true);
  }

  function patchDraft(patch: Partial<PermissionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function patchRoleDraft(patch: Partial<RoleDraft>) {
    setRoleDraft((current) => ({ ...current, ...patch }));
  }

  async function saveRoleDraft() {
    const validation = validateRoleDraft(roleDraft);
    if (validation) {
      setRoleFieldError(validation);
      return;
    }
    setSaving(true);
    setRoleFieldError('');
    try {
      const payload = {
        name: roleDraft.name.trim(),
        department: roleDraft.department.trim(),
        description: roleDraft.description.trim(),
        enabled: roleDraft.enabled !== false,
      };
      const saved = roleDraft.id ? await saveRoleForPackage(roleDraft.id, payload) : await createRoleForPackage(payload);
      setSelectedRoleId(saved.id);
      toast(roleDraft.id ? '已保存岗位信息，并同步到新人端岗位权限包' : '已新增岗位，并同步到后台配置数据库');
      setRoleDrawerOpen(false);
      await reload();
    } catch (error) {
      setRoleFieldError(formatApiErrorMessage(error, '保存失败，请检查岗位字段'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleSelectedRoleEnabled() {
    if (!selectedRole) return;
    setSaving(true);
    setRoleFieldError('');
    try {
      const nextEnabled = selectedRole.enabled === false;
      await saveRoleForPackage(selectedRole.id, {
        name: selectedRole.name,
        department: selectedRole.department,
        description: selectedRole.description,
        enabled: nextEnabled,
      });
      toast(nextEnabled ? '已启用岗位，新人端和管理端可重新选择该岗位' : '已停用岗位，新人端和管理端将不再展示该岗位，历史数据保留');
      await reload();
    } catch (error) {
      toast(formatApiErrorMessage(error, selectedRole.enabled === false ? '启用岗位失败' : '停用岗位失败'));
    } finally {
      setSaving(false);
    }
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

  async function saveExistingBinding() {
    if (!selectedRole?.id) {
      setBindFieldError('请先选择岗位');
      return;
    }
    if (!bindPermissionId) {
      setBindFieldError('请选择要绑定到当前岗位的权限项');
      return;
    }
    setSaving(true);
    setBindFieldError('');
    try {
      await bindExistingPermissionForRole(selectedRole.id, bindPermissionId);
      const boundPermission = permissions.find((item) => item.id === bindPermissionId);
      toast(`已将 ${boundPermission?.name ?? '权限项'} 绑定到 ${selectedRole.name}`);
      setBindDrawerOpen(false);
      await reload();
    } catch (error) {
      setBindFieldError(formatApiErrorMessage(error, '绑定失败，请检查岗位权限关系'));
    } finally {
      setSaving(false);
    }
  }

  async function disablePermission(permission: PermissionItem) {
    const disableHint = getPermissionDisableHint(permission);
    if (disableHint) {
      toast(disableHint);
      return;
    }
    setSaving(true);
    try {
      await saveRolePackagePermission(permission.id, { enabled: false, updatedAt: permission.updatedAt });
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
          <button type="button" disabled={!item.enabled || saving || isRequiredPermission(item)} title={getPermissionDisableHint(item)} onClick={() => void disablePermission(item)}>
            停用
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-workbench-panel">
      <div className="admin-page-title">
        <h1>岗位权限包管理</h1>
        <p>配置指定岗位需要的必开权限和可选权限，保存后同步影响新人权限引导。</p>
      </div>

      <div className="admin-role-summary-grid admin-role-summary-grid-compact">
        <section className="admin-card admin-role-info-card">
          <div className="admin-section-heading">
            <h2>当前岗位信息</h2>
            <div className="admin-toolbar-actions">
              <select value={selectedRole?.id ?? ''} onChange={(event) => setSelectedRoleId(event.target.value)}>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}{role.enabled === false ? '（停用）' : ''}
                  </option>
                ))}
              </select>
              <button className="admin-secondary-action" type="button" disabled={!selectedRole} onClick={openEditRole}>
                编辑岗位
              </button>
              <button className="admin-secondary-action" type="button" disabled={!selectedRole || saving} onClick={() => void toggleSelectedRoleEnabled()}>
                {selectedRole?.enabled === false ? '启用岗位' : '停用岗位'}
              </button>
            </div>
          </div>
          <dl className="admin-definition-list">
            <dt>当前岗位</dt>
            <dd>
              {selectedRole?.name ?? '-'} {selectedRole?.enabled === false ? <StatusTag tone="neutral">停用</StatusTag> : <StatusTag tone="success">启用</StatusTag>}
            </dd>
            <dt>岗位描述</dt>
            <dd>{selectedRole?.description ?? '-'}</dd>
            <dt>所属部门</dt>
            <dd>{selectedRole?.department ?? '-'}</dd>
          </dl>
        </section>

        <section className="admin-card admin-compact-summary-card">
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
            <button className="admin-secondary-action" type="button" disabled={!selectedRole || bindablePermissions.length === 0} onClick={openBindExisting}>
              <Plus size={16} />
              绑定已有权限
            </button>
            <button className="admin-secondary-action" type="button" onClick={openCreateRole}>
              <Plus size={16} />
              新增岗位
            </button>
            <button className="admin-primary-action" type="button" onClick={openCreate}>
              <Plus size={16} />
              新增权限项
            </button>
            <button className="admin-icon-action" type="button" onClick={() => void reload()} aria-label="刷新岗位权限包">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <DataTable columns={columns} rows={filteredPermissions} getRowKey={(item) => item.id} emptyText="当前岗位暂无权限项，请绑定已有权限或新增权限项" />
      </section>

      <RightDrawer
        title="绑定已有权限"
        open={bindDrawerOpen}
        onClose={() => setBindDrawerOpen(false)}
        footer={
          <>
            <button className="admin-secondary-action" type="button" onClick={() => setBindDrawerOpen(false)}>
              取消
            </button>
            <button className="admin-primary-action" type="button" disabled={saving || !bindPermissionId} onClick={() => void saveExistingBinding()}>
              保存绑定关系
            </button>
          </>
        }
      >
        <div className="admin-drawer-form">
          <FieldError message={bindFieldError} />
          <p className="admin-form-note">将已有权限项绑定到当前岗位，只新增岗位权限关系，不复制权限项，也不影响历史进度。</p>
          <label>
            当前岗位
            <input readOnly value={selectedRole?.name ?? '-'} />
          </label>
          <label>
            选择权限项 <b>*</b>
            <select value={bindPermissionId} onChange={(event) => setBindPermissionId(event.target.value)}>
              {bindablePermissions.map((permission) => (
                <option key={permission.id} value={permission.id}>
                  {permission.name} / {permission.permissionType === 'required' ? '必开' : '可选'} / {permission.enabled ? '启用' : '停用'}
                </option>
              ))}
            </select>
          </label>
        </div>
      </RightDrawer>

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
              <input type="radio" checked={draft.permissionType === 'required'} onChange={() => patchDraft({ permissionType: 'required', enabled: true })} />
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
            <input
              type="checkbox"
              checked={draft.enabled}
              disabled={isRequiredPermission(draft)}
              title={isRequiredPermission(draft) ? '必开权限不能停用，请先调整为可选权限。' : undefined}
              onChange={(event) => patchDraft({ enabled: event.target.checked })}
            />
          </label>
          {isRequiredPermission(draft) && <p className="admin-help-text">必开权限不能停用，请先调整为可选权限。</p>}
        </div>
      </RightDrawer>

      <RightDrawer
        title={roleDraft.id ? '编辑岗位信息' : '新增岗位'}
        open={roleDrawerOpen}
        onClose={() => setRoleDrawerOpen(false)}
        footer={
          <>
            <button className="admin-secondary-action" type="button" onClick={() => setRoleDrawerOpen(false)}>
              取消
            </button>
            <button className="admin-primary-action" type="button" disabled={saving} onClick={() => void saveRoleDraft()}>
              {roleDraft.id ? '保存岗位信息' : '保存岗位'}
            </button>
          </>
        }
      >
        <div className="admin-drawer-form">
          <FieldError message={roleFieldError} />
          <label>
            岗位名称 <b>*</b>
            <input value={roleDraft.name} onChange={(event) => patchRoleDraft({ name: event.target.value })} />
          </label>
          <label>
            所属部门 <b>*</b>
            <input value={roleDraft.department} onChange={(event) => patchRoleDraft({ department: event.target.value })} />
          </label>
          <label>
            岗位描述 <b>*</b>
            <textarea value={roleDraft.description} onChange={(event) => patchRoleDraft({ description: event.target.value })} />
          </label>
          <label className="admin-switch-row">
            岗位启用状态
            <input type="checkbox" checked={roleDraft.enabled !== false} onChange={(event) => patchRoleDraft({ enabled: event.target.checked })} />
          </label>
          <p className="admin-help-text">停用后岗位配置和历史关联仍保留；新人端和管理端不再展示，后台仍可恢复。</p>
        </div>
      </RightDrawer>
    </div>
  );
}
