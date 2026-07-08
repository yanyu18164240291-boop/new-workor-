import { useState } from 'react';

import { DataTable, type DataTableColumn } from '../../components/admin-config/DataTable.tsx';
import { FieldError } from '../../components/admin-config/FieldError.tsx';
import { RightDrawer } from '../../components/admin-config/RightDrawer.tsx';
import { StatusTag } from '../../components/admin-config/StatusTag.tsx';
import { formatApiErrorMessage, type D1GuideConfigItem, type Role } from '../../api.ts';
import type { DashboardData } from '../../dashboardData.ts';
import { saveD1GuideItem } from '../../services/adminConfigApi.ts';
import { validateD1GuideDraft } from './d1GuideValidation.ts';

type D1GuideTabProps = {
  data: DashboardData;
  toast: (message: string) => void;
  reload: () => Promise<void>;
};

const defaultOrganizationPath = '海底捞国际控股有限公司-集团总部-中台业务-技术管理中心-信息技术部-运维与网安组-安全与合规组';

const taskTypeLabels: Record<string, string> = {
  join_group: '加入飞书部门群',
  employee_guide: '查看员工指南册',
  permission_package: '开通岗位权限包',
  custom_link: '自定义引导任务',
};

function toD1Items(data: DashboardData): D1GuideConfigItem[] {
  const config = data.admin?.d1GuideConfig ?? data.d1GuideConfig;
  if (config?.items?.length) return config.items;
  return [config?.joinGroup, config?.employeeGuide, config?.permissionPackage].filter(Boolean) as D1GuideConfigItem[];
}

function roleOptions(data: DashboardData): Role[] {
  return data.admin?.roles ?? data.roles ?? [];
}

function draftFromRole(role?: Role): Pick<D1GuideConfigItem, 'departmentId' | 'departmentName' | 'roleId' | 'roleName' | 'organizationPath'> {
  return {
    organizationPath: defaultOrganizationPath,
    departmentId: role?.departmentId ?? 'dept-collaboration-office',
    departmentName: role?.department ?? '协同办公部门',
    roleId: role?.id ?? 'role-product-intern',
    roleName: role?.name ?? '协同办公产品实习生',
  };
}

function resourceLinksToText(item: D1GuideConfigItem): string {
  return (item.resourceLinks ?? [])
    .map((link) => [link.name ?? '', link.url ?? '', link.chatId ?? '', link.qrCodeUrl ?? ''].join(' | '))
    .join('\n');
}

function parseResourceLinks(value: string): D1GuideConfigItem['resourceLinks'] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = '', url = '', chatId = '', qrCodeUrl = ''] = line.split('|').map((part) => part.trim());
      return { name, url, chatId, qrCodeUrl };
    });
}

function newD1Draft(role?: Role): D1GuideConfigItem {
  return {
    actionKey: `custom_${Date.now()}`,
    taskType: 'custom_link',
    ...draftFromRole(role),
    title: '新增 D1 引导任务',
    description: '请填写新人需要完成的任务说明。',
    targetGroupName: '',
    applyUrl: '',
    sendToEmployeeName: '',
    sendToEmployeeContact: '',
    documentTitle: '',
    documentUrl: '',
    resourceLinks: [],
    routePath: '',
    label: '打开',
    ownerName: '后台管理员',
    enabled: true,
    sortOrder: 99,
  };
}

export function D1GuideTab({ data, toast, reload }: D1GuideTabProps) {
  const items = toD1Items(data).sort((left, right) => Number(left.sortOrder ?? 99) - Number(right.sortOrder ?? 99));
  const roles = roleOptions(data);
  const enabledCount = items.filter((item) => item.enabled).length;
  const latestUpdate =
    items
      .map((item) => item.updatedAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0]
      ?.replace('T', ' ')
      .slice(0, 16) ?? '-';
  const adminName = data.authSession?.user?.name ?? 'demo-admin';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<D1GuideConfigItem | null>(null);
  const [resourceText, setResourceText] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);

  function openEdit(item: D1GuideConfigItem) {
    setDraft(item);
    setResourceText(resourceLinksToText(item));
    setFieldError('');
    setDrawerOpen(true);
  }

  function openCreate() {
    const next = newD1Draft(roles[0]);
    setDraft(next);
    setResourceText('');
    setFieldError('');
    setDrawerOpen(true);
  }

  function patchDraft(patch: Partial<D1GuideConfigItem>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function patchRole(roleId: string) {
    const role = roles.find((item) => item.id === roleId);
    patchDraft(draftFromRole(role));
  }

  async function saveDraft(nextDraft = draft) {
    if (!nextDraft) return;
    const prepared = {
      ...nextDraft,
      resourceLinks: parseResourceLinks(resourceText),
      routePath: nextDraft.taskType === 'permission_package' ? '/permissions' : nextDraft.routePath,
    };
    const validation = validateD1GuideDraft(prepared);
    if (validation) {
      setFieldError(validation);
      return;
    }
    setSaving(true);
    setFieldError('');
    try {
      await saveD1GuideItem(prepared);
      toast('已保存 D1 引导任务');
      setDrawerOpen(false);
      await reload();
    } catch (error) {
      setFieldError(formatApiErrorMessage(error, '保存失败，请检查字段'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(item: D1GuideConfigItem) {
    const next = { ...item, enabled: !item.enabled };
    const validation = validateD1GuideDraft(next);
    if (validation) {
      openEdit(next);
      setFieldError(validation);
      return;
    }
    setSaving(true);
    setFieldError('');
    try {
      await saveD1GuideItem(next);
      toast(next.enabled ? '已启用 D1 引导任务' : '已停用 D1 引导任务');
      await reload();
    } catch (error) {
      setDraft(next);
      setFieldError(formatApiErrorMessage(error, '保存失败，请检查字段'));
      setDrawerOpen(true);
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: D1GuideConfigItem) {
    setSaving(true);
    try {
      await saveD1GuideItem({ ...item, enabled: false });
      toast('已删除 D1 引导任务，新人端不再展示');
      await reload();
    } catch (error) {
      setFieldError(formatApiErrorMessage(error, '删除失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<D1GuideConfigItem>> = [
    { key: 'task', title: '引导任务', render: (item) => taskTypeLabels[item.taskType ?? item.actionKey] ?? item.title },
    { key: 'title', title: '标题', render: (item) => item.title },
    { key: 'scope', title: '组织 / 部门 / 岗位', render: (item) => `${item.departmentName ?? '-'} / ${item.roleName ?? '-'}` },
    { key: 'target', title: '目标飞书群 / 指南册 / 路由', render: (item) => item.targetGroupName || item.documentTitle || item.routePath || item.resourceLinks?.[0]?.name || '-' },
    { key: 'owner', title: 'Owner', render: (item) => item.ownerName },
    { key: 'status', title: '状态', render: (item) => <StatusTag tone={item.enabled ? 'success' : 'neutral'}>{item.enabled ? '启用' : '停用'}</StatusTag> },
    { key: 'updatedBy', title: 'updatedBy', render: (item) => item.updatedBy ?? adminName },
    {
      key: 'actions',
      title: '操作',
      render: (item) => (
        <div className="admin-table-actions">
          <button type="button" onClick={() => openEdit(item)}>
            编辑
          </button>
          <button type="button" disabled={saving} onClick={() => void toggleItem(item)}>
            {item.enabled ? '停用' : '启用'}
          </button>
          <button type="button" disabled={saving} onClick={() => void removeItem(item)}>
            删除
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-workbench-panel">
      <div className="admin-page-title admin-page-title-row">
        <div>
          <h1>D1 引导配置</h1>
          <p>按组织、部门、岗位配置新人第一天的真实引导任务，新人端会按当前岗位自动读取。</p>
        </div>
        <button className="admin-primary-action" type="button" onClick={openCreate}>
          新增引导任务
        </button>
      </div>

      <div className="admin-metric-grid admin-metric-grid-three admin-compact-summary-grid">
        <div className="admin-card">
          <h2>D1 启用任务数</h2>
          <strong className="admin-large-number">{enabledCount} / {items.length}</strong>
          <p>不同部门和岗位可配置不同任务。</p>
        </div>
        <div className="admin-card">
          <h2>最近更新时间</h2>
          <strong className="admin-large-number">{latestUpdate}</strong>
          <p>由 {adminName} 更新</p>
        </div>
        <div className="admin-card">
          <h2>当前负责人</h2>
          <strong className="admin-large-number">{adminName}</strong>
          <p>{data.authSession?.user?.departmentName ?? '后台管理员'}</p>
        </div>
      </div>

      <section className="admin-card">
        <h2>D1 引导项列表</h2>
        <div className="admin-info-strip compact">任务配置保存后会同步影响新人端“今日关键路径”。删除采用停用方式，避免历史进度丢失。</div>
        <DataTable columns={columns} rows={items} getRowKey={(item) => item.actionKey} emptyText="暂无 D1 引导任务" />
      </section>

      <RightDrawer
        title={draft?.actionKey?.startsWith('custom_') ? '新增 D1 引导任务' : '编辑 D1 引导任务'}
        open={drawerOpen && Boolean(draft)}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <button className="admin-secondary-action" type="button" onClick={() => setDrawerOpen(false)}>
              取消
            </button>
            <button className="admin-primary-action" type="button" disabled={saving} onClick={() => void saveDraft()}>
              保存引导任务
            </button>
          </>
        }
      >
        {draft && (
          <div className="admin-drawer-form">
            <FieldError message={fieldError} />
            <label>
              引导任务 <b>*</b>
              <select value={draft.taskType ?? 'custom_link'} onChange={(event) => patchDraft({ taskType: event.target.value })}>
                <option value="join_group">加入飞书部门群</option>
                <option value="employee_guide">查看员工指南册</option>
                <option value="permission_package">开通岗位权限包</option>
                <option value="custom_link">自定义引导任务</option>
              </select>
            </label>
            <label>
              适用组织 <b>*</b>
              <input value={draft.organizationPath ?? defaultOrganizationPath} onChange={(event) => patchDraft({ organizationPath: event.target.value })} />
            </label>
            <label>
              适用岗位 <b>*</b>
              <select value={draft.roleId ?? ''} onChange={(event) => patchRole(event.target.value)}>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.department} / {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              标题 <b>*</b>
              <input value={draft.title} onChange={(event) => patchDraft({ title: event.target.value })} />
            </label>
            <label>
              描述 <b>*</b>
              <textarea value={draft.description} onChange={(event) => patchDraft({ description: event.target.value })} />
            </label>
            <label>
              展示按钮文案 <b>*</b>
              <input value={draft.label} onChange={(event) => patchDraft({ label: event.target.value })} />
            </label>
            <label>
              Owner <b>*</b>
              <input value={draft.ownerName} onChange={(event) => patchDraft({ ownerName: event.target.value })} />
            </label>
            <label className="admin-switch-row">
              启用状态
              <input type="checkbox" checked={draft.enabled} onChange={(event) => patchDraft({ enabled: event.target.checked })} />
            </label>

            {draft.taskType === 'join_group' && (
              <>
                <label>
                  飞书部门群名称
                  <input value={draft.targetGroupName ?? ''} onChange={(event) => patchDraft({ targetGroupName: event.target.value })} />
                </label>
                <label>
                  多群资源列表
                  <textarea
                    value={resourceText}
                    placeholder="每行一个：群名称 | 进群链接 | chat_id | 群二维码链接"
                    onChange={(event) => setResourceText(event.target.value)}
                  />
                </label>
                <label>
                  兜底进群链接
                  <input value={draft.applyUrl ?? ''} onChange={(event) => patchDraft({ applyUrl: event.target.value })} />
                </label>
                <label>
                  发送对象姓名
                  <input value={draft.sendToEmployeeName ?? ''} onChange={(event) => patchDraft({ sendToEmployeeName: event.target.value })} />
                </label>
                <label>
                  发送对象联系方式
                  <input value={draft.sendToEmployeeContact ?? ''} onChange={(event) => patchDraft({ sendToEmployeeContact: event.target.value })} />
                </label>
              </>
            )}

            {draft.taskType === 'employee_guide' && (
              <>
                <label>
                  指南册标题
                  <input value={draft.documentTitle ?? ''} onChange={(event) => patchDraft({ documentTitle: event.target.value })} />
                </label>
                <label>
                  员工指南册链接
                  <input value={draft.documentUrl ?? ''} onChange={(event) => patchDraft({ documentUrl: event.target.value })} />
                </label>
              </>
            )}

            {draft.taskType === 'permission_package' && (
              <label>
                站内路由固定为 /permissions
                <input value="/permissions" readOnly />
              </label>
            )}

            {draft.taskType === 'custom_link' && (
              <label>
                自定义任务链接
                <input value={draft.applyUrl ?? ''} onChange={(event) => patchDraft({ applyUrl: event.target.value })} />
              </label>
            )}
          </div>
        )}
      </RightDrawer>
    </div>
  );
}
