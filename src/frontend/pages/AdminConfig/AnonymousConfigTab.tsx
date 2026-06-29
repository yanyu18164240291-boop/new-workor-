import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { DataTable, type DataTableColumn } from '../../components/admin-config/DataTable.tsx';
import { FieldError } from '../../components/admin-config/FieldError.tsx';
import { RightDrawer } from '../../components/admin-config/RightDrawer.tsx';
import { StatusTag } from '../../components/admin-config/StatusTag.tsx';
import {
  formatApiErrorMessage,
  type AnonymousFeedbackExpectedAction,
  type AnonymousFeedbackModule,
  type AnonymousFeedbackProblemType,
} from '../../api.ts';
import type { DashboardData } from '../../dashboardData.ts';
import { saveAnonymousFeedbackConfig } from '../../services/adminConfigApi.ts';
import type { AdminConfigFilters } from '../../types/adminConfig.ts';

type AnonymousConfigTabProps = {
  data: DashboardData;
  filters: AdminConfigFilters;
  toast: (message: string) => void;
  reload: () => Promise<void>;
};

type EditState =
  | { kind: 'module'; draft: AnonymousFeedbackModule }
  | { kind: 'problemType'; draft: AnonymousFeedbackProblemType }
  | { kind: 'expectedAction'; draft: AnonymousFeedbackExpectedAction };

function getModules(data: DashboardData): AnonymousFeedbackModule[] {
  return data.admin?.anonymousFeedbackConfig?.modules ?? data.anonymousConfig?.modules ?? [];
}

function validateEdit(editing: EditState): string {
  if (editing.kind === 'module') {
    if (!editing.draft.label.trim()) return '模块名称不能为空';
    return '';
  }
  if (editing.kind === 'problemType') {
    if (!editing.draft.label.trim()) return '问题类型不能为空';
    if (!editing.draft.typeKey.trim()) return 'typeKey 不能为空';
    return '';
  }
  if (!editing.draft.label.trim()) return '处理方式不能为空';
  if (!editing.draft.actionKey.trim()) return 'actionKey 不能为空';
  return '';
}

export function AnonymousConfigTab({ data, filters, toast, reload }: AnonymousConfigTabProps) {
  const modules = getModules(data);
  const [selectedModuleId, setSelectedModuleId] = useState(modules[0]?.id ?? '');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedModuleId && modules[0]) setSelectedModuleId(modules[0].id);
    if (selectedModuleId && !modules.some((module) => module.id === selectedModuleId) && modules[0]) setSelectedModuleId(modules[0].id);
  }, [modules, selectedModuleId]);

  const selectedModule = modules.find((module) => module.id === selectedModuleId) ?? modules[0];
  const filteredModules = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return modules.filter((module) => {
      const matchesKeyword = !keyword || [module.label, module.moduleKey].join(' ').toLowerCase().includes(keyword);
      const matchesStatus =
        filters.status === '全部状态' ||
        (filters.status === '启用' && module.enabled) ||
        (filters.status === '停用' && !module.enabled) ||
        !['启用', '停用'].includes(filters.status);
      return matchesKeyword && matchesStatus;
    });
  }, [filters.keyword, filters.status, modules]);

  function patchEditing(patch: Partial<AnonymousFeedbackModule & AnonymousFeedbackProblemType & AnonymousFeedbackExpectedAction>) {
    setEditing((current) => (current ? ({ ...current, draft: { ...current.draft, ...patch } } as EditState) : current));
  }

  function openEdit(next: EditState) {
    setEditing(next);
    setFieldError('');
  }

  async function saveEditing() {
    if (!editing) return;
    const validation = validateEdit(editing);
    if (validation) {
      setFieldError(validation);
      return;
    }
    setSaving(true);
    setFieldError('');
    try {
      if (editing.kind === 'module') {
        await saveAnonymousFeedbackConfig({
          modules: [{ id: editing.draft.id, label: editing.draft.label, enabled: editing.draft.enabled }],
        });
      }
      if (editing.kind === 'problemType') {
        await saveAnonymousFeedbackConfig({
          problemTypes: [
            {
              id: editing.draft.id,
              moduleId: editing.draft.moduleId,
              typeKey: editing.draft.typeKey,
              label: editing.draft.label,
              requiresText: editing.draft.requiresText,
              enabled: editing.draft.enabled,
              sortOrder: editing.draft.sortOrder,
            },
          ],
        });
      }
      if (editing.kind === 'expectedAction') {
        await saveAnonymousFeedbackConfig({
          expectedActions: [
            {
              id: editing.draft.id,
              moduleId: editing.draft.moduleId,
              actionKey: editing.draft.actionKey,
              label: editing.draft.label,
              requiresText: editing.draft.requiresText,
              enabled: editing.draft.enabled,
              sortOrder: editing.draft.sortOrder,
            },
          ],
        });
      }
      toast('已保存匿名反馈三级联动配置');
      setEditing(null);
      await reload();
    } catch (error) {
      setFieldError(formatApiErrorMessage(error, '保存失败，请检查字段'));
    } finally {
      setSaving(false);
    }
  }

  async function disableModule(module: AnonymousFeedbackModule) {
    setSaving(true);
    try {
      await saveAnonymousFeedbackConfig({ modules: [{ id: module.id, label: module.label, enabled: false }] });
      toast('已停用反馈模块，历史匿名反馈仍会保留');
      await reload();
    } catch (error) {
      toast(formatApiErrorMessage(error, '停用失败'));
    } finally {
      setSaving(false);
    }
  }

  const moduleColumns: Array<DataTableColumn<AnonymousFeedbackModule>> = [
    { key: 'label', title: '模块名称', render: (module) => <strong>{module.label}</strong> },
    { key: 'moduleKey', title: '模块 key', render: (module) => module.moduleKey },
    { key: 'problemTypes', title: '问题类型数量', render: (module) => module.problemTypes.length },
    { key: 'actions', title: '处理方式数量', render: (module) => module.expectedActions.length },
    { key: 'status', title: '状态', render: (module) => <StatusTag tone={module.enabled ? 'success' : 'neutral'}>{module.enabled ? '启用' : '停用'}</StatusTag> },
    { key: 'updatedBy', title: 'updatedBy', render: (module) => module.updatedBy ?? 'demo-admin' },
    {
      key: 'ops',
      title: '操作',
      render: (module) => (
        <div className="admin-table-actions">
          <button type="button" onClick={() => setSelectedModuleId(module.id)}>
            查看
          </button>
          <button type="button" onClick={() => openEdit({ kind: 'module', draft: { ...module } })}>
            编辑
          </button>
          <button type="button" disabled={!module.enabled || saving} onClick={() => void disableModule(module)}>
            停用
          </button>
        </div>
      ),
    },
  ];

  const problemColumns: Array<DataTableColumn<AnonymousFeedbackProblemType>> = [
    { key: 'label', title: '问题类型', render: (item) => item.label },
    { key: 'typeKey', title: 'typeKey', render: (item) => item.typeKey },
    { key: 'requiresText', title: '是否需要补充文本', render: (item) => (item.requiresText ? '需要' : '不需要') },
    { key: 'sortOrder', title: '排序', render: (item) => item.sortOrder },
    { key: 'status', title: '状态', render: (item) => <StatusTag tone={item.enabled ? 'success' : 'neutral'}>{item.enabled ? '启用' : '停用'}</StatusTag> },
    {
      key: 'ops',
      title: '操作',
      render: (item) => (
        <div className="admin-table-actions">
          <button type="button" onClick={() => openEdit({ kind: 'problemType', draft: { ...item } })}>
            编辑
          </button>
        </div>
      ),
    },
  ];

  const actionColumns: Array<DataTableColumn<AnonymousFeedbackExpectedAction>> = [
    { key: 'label', title: '希望如何处理', render: (item) => item.label },
    { key: 'actionKey', title: 'actionKey', render: (item) => item.actionKey },
    { key: 'requiresText', title: '是否需要补充文本', render: (item) => (item.requiresText ? '需要' : '不需要') },
    { key: 'sortOrder', title: '排序', render: (item) => item.sortOrder },
    { key: 'status', title: '状态', render: (item) => <StatusTag tone={item.enabled ? 'success' : 'neutral'}>{item.enabled ? '启用' : '停用'}</StatusTag> },
    {
      key: 'ops',
      title: '操作',
      render: (item) => (
        <div className="admin-table-actions">
          <button type="button" onClick={() => openEdit({ kind: 'expectedAction', draft: { ...item } })}>
            编辑
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-workbench-panel">
      <div className="admin-page-title">
        <span>Page 08</span>
        <h1>匿名反馈配置</h1>
        <p>维护新人匿名反馈的三级联动：关联模块、问题类型、希望如何处理。</p>
      </div>

      <div className="admin-split-grid">
        <section className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h2>反馈模块列表</h2>
              <p className="admin-muted-line">停用模块只影响后续展示，已提交反馈保持历史结构。</p>
            </div>
            <button className="admin-icon-action" type="button" onClick={() => void reload()} aria-label="刷新匿名反馈配置">
              <RefreshCw size={16} />
            </button>
          </div>
          <DataTable columns={moduleColumns} rows={filteredModules} getRowKey={(module) => module.id} emptyText="暂无反馈模块" />
        </section>

        <section className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h2>当前模块基础信息</h2>
              <p className="admin-muted-line">当前模块：{selectedModule?.label ?? '-'}</p>
            </div>
            {selectedModule && <StatusTag tone={selectedModule.enabled ? 'success' : 'neutral'}>{selectedModule.enabled ? '启用' : '停用'}</StatusTag>}
          </div>
          <dl className="admin-definition-list">
            <dt>模块名称</dt>
            <dd>{selectedModule?.label ?? '-'}</dd>
            <dt>模块 key</dt>
            <dd>{selectedModule?.moduleKey ?? '-'}</dd>
            <dt>updatedBy</dt>
            <dd>{selectedModule?.updatedBy ?? 'demo-admin'}</dd>
          </dl>
        </section>
      </div>

      <section className="admin-card">
        <div className="admin-section-heading">
          <h2>问题类型列表</h2>
        </div>
        <DataTable columns={problemColumns} rows={selectedModule?.problemTypes ?? []} getRowKey={(item) => item.id} emptyText="暂无问题类型" />
      </section>

      <section className="admin-card">
        <div className="admin-section-heading">
          <h2>希望如何处理列表</h2>
        </div>
        <DataTable columns={actionColumns} rows={selectedModule?.expectedActions ?? []} getRowKey={(item) => item.id} emptyText="暂无处理方式" />
      </section>

      <RightDrawer
        title={editing?.kind === 'module' ? '编辑当前模块' : editing?.kind === 'problemType' ? '编辑问题类型' : '编辑希望如何处理'}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="admin-secondary-action" type="button" onClick={() => setEditing(null)}>
              取消
            </button>
            <button className="admin-primary-action" type="button" disabled={saving} onClick={() => void saveEditing()}>
              保存匿名反馈配置
            </button>
          </>
        }
      >
        {editing && (
          <div className="admin-drawer-form">
            <FieldError message={fieldError} />
            {editing.kind === 'module' && (
              <>
                <label>
                  模块名称 <b>*</b>
                  <input value={editing.draft.label} onChange={(event) => patchEditing({ label: event.target.value })} />
                </label>
                <label>
                  模块 key
                  <input value={editing.draft.moduleKey} readOnly />
                </label>
                <label className="admin-switch-row">
                  启用状态
                  <input type="checkbox" checked={editing.draft.enabled} onChange={(event) => patchEditing({ enabled: event.target.checked })} />
                </label>
              </>
            )}
            {editing.kind === 'problemType' && (
              <>
                <label>
                  问题类型 <b>*</b>
                  <input value={editing.draft.label} onChange={(event) => patchEditing({ label: event.target.value })} />
                </label>
                <label>
                  typeKey <b>*</b>
                  <input value={editing.draft.typeKey} onChange={(event) => patchEditing({ typeKey: event.target.value })} />
                </label>
                <label className="admin-switch-row">
                  是否需要补充文本
                  <input type="checkbox" checked={editing.draft.requiresText} onChange={(event) => patchEditing({ requiresText: event.target.checked })} />
                </label>
                <label>
                  排序
                  <input type="number" min="1" value={editing.draft.sortOrder} onChange={(event) => patchEditing({ sortOrder: Number(event.target.value) })} />
                </label>
                <label className="admin-switch-row">
                  启用状态
                  <input type="checkbox" checked={editing.draft.enabled} onChange={(event) => patchEditing({ enabled: event.target.checked })} />
                </label>
              </>
            )}
            {editing.kind === 'expectedAction' && (
              <>
                <label>
                  希望如何处理 <b>*</b>
                  <input value={editing.draft.label} onChange={(event) => patchEditing({ label: event.target.value })} />
                </label>
                <label>
                  actionKey <b>*</b>
                  <input value={editing.draft.actionKey} onChange={(event) => patchEditing({ actionKey: event.target.value })} />
                </label>
                <label className="admin-switch-row">
                  是否需要补充文本
                  <input type="checkbox" checked={editing.draft.requiresText} onChange={(event) => patchEditing({ requiresText: event.target.checked })} />
                </label>
                <label>
                  排序
                  <input type="number" min="1" value={editing.draft.sortOrder} onChange={(event) => patchEditing({ sortOrder: Number(event.target.value) })} />
                </label>
                <label className="admin-switch-row">
                  启用状态
                  <input type="checkbox" checked={editing.draft.enabled} onChange={(event) => patchEditing({ enabled: event.target.checked })} />
                </label>
              </>
            )}
          </div>
        )}
      </RightDrawer>
    </div>
  );
}
