import { useState } from 'react';

import { DataTable, type DataTableColumn } from '../../components/admin-config/DataTable.tsx';
import { FieldError } from '../../components/admin-config/FieldError.tsx';
import { RightDrawer } from '../../components/admin-config/RightDrawer.tsx';
import { StatusTag } from '../../components/admin-config/StatusTag.tsx';
import { formatApiErrorMessage, type D1GuideConfigItem } from '../../api.ts';
import type { DashboardData } from '../../dashboardData.ts';
import { saveD1GuideItem } from '../../services/adminConfigApi.ts';
import { validateD1GuideDraft } from './d1GuideValidation.ts';

type D1GuideTabProps = {
  data: DashboardData;
  toast: (message: string) => void;
  reload: () => Promise<void>;
};

const operationHint = '编辑 / 启用 / 停用';

const d1ActionMeta = {
  join_group: {
    actionName: '加入飞书部门群',
    fixedTitle: '加入飞书部门群',
  },
  employee_guide: {
    actionName: '查看员工指南册',
    fixedTitle: '查看员工指南册',
  },
  permission_package: {
    actionName: '开通岗位权限包',
    fixedTitle: '开通岗位权限包',
  },
} as const;

function toD1Items(data: DashboardData): D1GuideConfigItem[] {
  const config = data.admin?.d1GuideConfig ?? data.d1GuideConfig;
  return [config?.joinGroup, config?.employeeGuide, config?.permissionPackage].filter(Boolean) as D1GuideConfigItem[];
}

export function D1GuideTab({ data, toast, reload }: D1GuideTabProps) {
  const items = toD1Items(data);
  const enabledCount = items.filter((item) => item.enabled).length;
  const latestUpdate =
    items
      .map((item) => (item as D1GuideConfigItem & { updatedAt?: string }).updatedAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0]
      ?.replace('T', ' ')
      .slice(0, 16) ?? '-';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<D1GuideConfigItem | null>(null);
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);

  function openEdit(item: D1GuideConfigItem) {
    setDraft(item);
    setFieldError('');
    setDrawerOpen(true);
  }

  function patchDraft(patch: Partial<D1GuideConfigItem>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  async function saveDraft(nextDraft = draft) {
    if (!nextDraft) return;
    const validation = validateD1GuideDraft(nextDraft);
    if (validation) {
      setFieldError(validation);
      return;
    }
    setSaving(true);
    setFieldError('');
    try {
      await saveD1GuideItem(nextDraft);
      toast('已保存 D1 引导配置');
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
      setDraft(next);
      setFieldError(validation);
      setDrawerOpen(true);
      return;
    }
    setSaving(true);
    setFieldError('');
    try {
      await saveD1GuideItem(next);
      toast(next.enabled ? '已启用 D1 引导配置' : '已停用 D1 引导配置');
      await reload();
    } catch (error) {
      setDraft(next);
      setFieldError(formatApiErrorMessage(error, '保存失败，请检查字段'));
      setDrawerOpen(true);
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<D1GuideConfigItem>> = [
    {
      key: 'action',
      title: '引导动作',
      render: (item) => d1ActionMeta[item.actionKey as keyof typeof d1ActionMeta]?.actionName ?? item.actionKey,
    },
    { key: 'title', title: '标题', render: (item) => item.title },
    { key: 'description', title: '描述', render: (item) => item.description },
    { key: 'target', title: '目标飞书群 / 指南册 / 路由', render: (item) => item.targetGroupName || item.documentTitle || item.routePath || '-' },
    { key: 'owner', title: 'Owner', render: (item) => item.ownerName },
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
          <button type="button" disabled={saving} onClick={() => void toggleItem(item)}>
            {item.enabled ? '停用' : '启用'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-workbench-panel">
      <div className="admin-page-title">
        <h1>D1 引导配置</h1>
        <p>配置新人入职第一天的三类固定入口，D1 引导项固定 3 项，只支持{operationHint}。</p>
      </div>

      <div className="admin-metric-grid admin-metric-grid-three admin-compact-summary-grid">
        <div className="admin-card">
          <h2>D1 启用入口数</h2>
          <strong className="admin-large-number">{enabledCount} / 3</strong>
          <p>已启用 {enabledCount} 项（固定 3 项）</p>
        </div>
        <div className="admin-card">
          <h2>最近更新时间</h2>
          <strong className="admin-large-number">{latestUpdate}</strong>
          <p>由 demo-admin 更新</p>
        </div>
        <div className="admin-card">
          <h2>当前负责人</h2>
          <strong className="admin-large-number">demo-admin</strong>
          <p>后台管理员</p>
        </div>
      </div>

      <section className="admin-card">
        <h2>D1 引导项列表</h2>
        <div className="admin-info-strip compact">D1 引导项采用启停管理，不做物理移除；停用后仅影响新人端后续展示。</div>
        <DataTable columns={columns} rows={items} getRowKey={(item) => item.actionKey} emptyText="暂无 D1 引导项" />
      </section>

      <RightDrawer
        title="编辑 D1 引导项"
        open={drawerOpen && Boolean(draft)}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <button className="admin-secondary-action" type="button" onClick={() => setDrawerOpen(false)}>
              取消
            </button>
            <button className="admin-primary-action" type="button" disabled={saving} onClick={() => void saveDraft()}>
              保存引导配置
            </button>
          </>
        }
      >
        {draft && (
          <div className="admin-drawer-form">
            <FieldError message={fieldError} />
            <p className="admin-muted-line">当前编辑：{d1ActionMeta[draft.actionKey as keyof typeof d1ActionMeta]?.fixedTitle}</p>
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

            {draft.actionKey === 'join_group' && (
              <>
                <label>
                  飞书部门群名称
                  <input value={draft.targetGroupName ?? ''} onChange={(event) => patchDraft({ targetGroupName: event.target.value })} />
                </label>
                <label>
                  模拟进群链接：mock-feishu://chat/...
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

            {draft.actionKey === 'employee_guide' && (
              <>
                <label>
                  指南册标题
                  <input value={draft.documentTitle ?? ''} onChange={(event) => patchDraft({ documentTitle: event.target.value })} />
                </label>
                <label>
                  指南册链接：mock-feishu://doc/...
                  <input value={draft.documentUrl ?? ''} onChange={(event) => patchDraft({ documentUrl: event.target.value })} />
                </label>
              </>
            )}

            {draft.actionKey === 'permission_package' && (
              <label>
                站内路由固定为 /permissions
                <input value="/permissions" readOnly />
              </label>
            )}
          </div>
        )}
      </RightDrawer>
    </div>
  );
}
