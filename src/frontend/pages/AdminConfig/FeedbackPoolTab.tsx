import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { DataTable, type DataTableColumn } from '../../components/admin-config/DataTable.tsx';
import { FieldError } from '../../components/admin-config/FieldError.tsx';
import { RightDrawer } from '../../components/admin-config/RightDrawer.tsx';
import { StatusTag } from '../../components/admin-config/StatusTag.tsx';
import { formatApiErrorMessage, type AnonymousFeedback } from '../../api.ts';
import type { DashboardData } from '../../dashboardData.ts';
import { processAnonymousFeedback } from '../../services/adminConfigApi.ts';
import { currentAdminUser, type AdminConfigFilters } from '../../types/adminConfig.ts';

type FeedbackPoolTabProps = {
  data: DashboardData;
  filters: AdminConfigFilters;
  toast: (message: string) => void;
  reload: () => Promise<void>;
};

type CanonicalFeedbackStatus = 'pending' | 'in_progress' | 'knowledge_added' | 'permission_entry_fixed' | 'deferred' | 'closed';

const statusOptions: Array<{ value: CanonicalFeedbackStatus; label: string; tone: 'warning' | 'blue' | 'success' | 'ai' | 'neutral' }> = [
  { value: 'pending', label: '待处理', tone: 'warning' },
  { value: 'in_progress', label: '处理中', tone: 'blue' },
  { value: 'knowledge_added', label: '已补充知识库', tone: 'success' },
  { value: 'permission_entry_fixed', label: '已修正权限入口', tone: 'ai' },
  { value: 'deferred', label: '暂不处理', tone: 'neutral' },
  { value: 'closed', label: '已关闭', tone: 'neutral' },
];

const compatibilityStatusCopy = 'open / resolved / archived';

function normalizeFeedbackStatus(status: string): CanonicalFeedbackStatus {
  if (status === 'open') return 'pending';
  if (status === 'resolved' || status === 'archived') return 'closed';
  if (statusOptions.some((item) => item.value === status)) return status as CanonicalFeedbackStatus;
  return 'pending';
}

function statusMeta(status: string) {
  const normalized = normalizeFeedbackStatus(status);
  return statusOptions.find((item) => item.value === normalized) ?? statusOptions[0];
}

function getFeedbacks(data: DashboardData): AnonymousFeedback[] {
  return data.admin?.anonymousFeedbacks ?? data.anonymous ?? [];
}

function feedbackModule(feedback: AnonymousFeedback) {
  return feedback.detail?.moduleKey ?? feedback.module ?? '-';
}

function feedbackProblemType(feedback: AnonymousFeedback) {
  return feedback.detail?.problemTypeKey ?? feedback.type ?? '-';
}

function feedbackExpectedAction(feedback: AnonymousFeedback) {
  if (feedback.detail?.expectedActionKeys.length) return feedback.detail.expectedActionKeys.join('、');
  return feedback.expectedAction ?? '-';
}

export function FeedbackPoolTab({ data, filters, toast, reload }: FeedbackPoolTabProps) {
  const feedbacks = getFeedbacks(data);
  const [activeStatus, setActiveStatus] = useState<'all' | CanonicalFeedbackStatus>('all');
  const [draft, setDraft] = useState<AnonymousFeedback | null>(null);
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredFeedbacks = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return feedbacks.filter((feedback) => {
      const normalized = normalizeFeedbackStatus(feedback.status);
      const matchesStatusTab = activeStatus === 'all' || normalized === activeStatus;
      const matchesTopStatus =
        filters.status === '全部状态' ||
        statusMeta(feedback.status).label === filters.status ||
        !statusOptions.some((item) => item.label === filters.status);
      const matchesKeyword =
        !keyword ||
        [
          feedback.feedbackNo,
          feedback.type,
          feedback.module,
          feedback.description,
          feedback.ownerName ?? '',
          feedback.result ?? '',
          feedback.resolutionNote ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      return matchesStatusTab && matchesTopStatus && matchesKeyword;
    });
  }, [activeStatus, feedbacks, filters.keyword, filters.status]);

  function patchDraft(patch: Partial<AnonymousFeedback>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function validateDraft(nextDraft: AnonymousFeedback): string {
    if (!nextDraft.ownerName?.trim()) return '处理 Owner 不能为空';
    if (!nextDraft.result?.trim()) return '处理结论 result 不能为空';
    if (!nextDraft.resolutionNote?.trim()) return '处理说明 resolutionNote 不能为空';
    return '';
  }

  async function saveDraft() {
    if (!draft) return;
    const validation = validateDraft(draft);
    if (validation) {
      setFieldError(validation);
      return;
    }
    setSaving(true);
    setFieldError('');
    try {
      await processAnonymousFeedback(draft.id, {
        ownerName: draft.ownerName ?? '',
        status: normalizeFeedbackStatus(draft.status),
        result: draft.result ?? '',
        resolutionNote: draft.resolutionNote ?? '',
        includedInReview: draft.includedInReview,
      });
      toast('已保存匿名反馈处理结果');
      setDraft(null);
      await reload();
    } catch (error) {
      setFieldError(formatApiErrorMessage(error, '保存失败，请检查字段'));
    } finally {
      setSaving(false);
    }
  }

  const pendingCount = feedbacks.filter((feedback) => ['pending', 'open', 'in_progress'].includes(feedback.status)).length;
  const includedCount = feedbacks.filter((feedback) => feedback.includedInReview).length;

  const columns: Array<DataTableColumn<AnonymousFeedback>> = [
    { key: 'feedbackNo', title: '反馈编号', render: (feedback) => <strong>{feedback.feedbackNo}</strong> },
    { key: 'type', title: '反馈类型', render: (feedback) => feedbackProblemType(feedback) },
    { key: 'module', title: '关联模块', render: (feedback) => feedbackModule(feedback) },
    { key: 'description', title: '问题描述', render: (feedback) => feedback.description },
    { key: 'ownerName', title: '处理 Owner', render: (feedback) => feedback.ownerName ?? '-' },
    { key: 'status', title: '处理状态', render: (feedback) => <StatusTag tone={statusMeta(feedback.status).tone}>{statusMeta(feedback.status).label}</StatusTag> },
    { key: 'included', title: '进入复盘', render: (feedback) => (feedback.includedInReview ? '是' : '否') },
    { key: 'handledAt', title: 'handledAt', render: (feedback) => feedback.handledAt ?? '-' },
    {
      key: 'ops',
      title: '操作',
      render: (feedback) => (
        <div className="admin-table-actions">
          <button type="button" onClick={() => setDraft({ ...feedback, status: normalizeFeedbackStatus(feedback.status) })}>
            处理
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-workbench-panel">
      <div className="admin-page-title">
        <span>Page 08</span>
        <h1>匿名反馈池</h1>
        <p>产品运营、内容 Owner、权限 Owner 在此处理匿名反馈；管理者端不展示匿名反馈原文。</p>
      </div>

      <div className="admin-metric-grid admin-metric-grid-three">
        <div className="admin-card">
          <h2>待处理匿名反馈数</h2>
          <strong className="admin-large-number">{pendingCount}</strong>
          <p>兼容历史状态：{compatibilityStatusCopy}</p>
        </div>
        <div className="admin-card">
          <h2>进入复盘指标</h2>
          <strong className="admin-large-number">{includedCount}</strong>
          <p>includedInReview = true</p>
        </div>
        <div className="admin-card">
          <h2>当前处理人</h2>
          <strong className="admin-large-number">{currentAdminUser.name}</strong>
          <p>handlerName 保存为 demo-admin</p>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-section-heading">
          <div className="admin-tab-row">
            <button className={activeStatus === 'all' ? 'active' : ''} type="button" onClick={() => setActiveStatus('all')}>
              全部
            </button>
            {statusOptions.map((status) => (
              <button
                key={status.value}
                className={activeStatus === status.value ? 'active' : ''}
                type="button"
                onClick={() => setActiveStatus(status.value)}
              >
                {status.label}
              </button>
            ))}
          </div>
          <button className="admin-icon-action" type="button" onClick={() => void reload()} aria-label="刷新匿名反馈池">
            <RefreshCw size={16} />
          </button>
        </div>
        <DataTable columns={columns} rows={filteredFeedbacks} getRowKey={(feedback) => feedback.id} emptyText="暂无匿名反馈" />
      </section>

      <RightDrawer
        title="处理匿名反馈"
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        footer={
          <>
            <button className="admin-secondary-action" type="button" onClick={() => setDraft(null)}>
              取消
            </button>
            <button className="admin-primary-action" type="button" disabled={saving} onClick={() => void saveDraft()}>
              保存处理结果
            </button>
          </>
        }
      >
        {draft && (
          <div className="admin-drawer-form">
            <FieldError message={fieldError} />
            <label>
              反馈编号
              <input value={draft.feedbackNo} readOnly />
            </label>
            <label>
              反馈类型
              <input value={feedbackProblemType(draft)} readOnly />
            </label>
            <label>
              关联模块
              <input value={feedbackModule(draft)} readOnly />
            </label>
            <label>
              问题描述
              <textarea value={draft.description} readOnly />
            </label>
            <label>
              是否匿名
              <input value={draft.isAnonymous ? '是' : '否'} readOnly />
            </label>
            <label>
              期望处理方式
              <input value={feedbackExpectedAction(draft)} readOnly />
            </label>
            <label>
              处理 Owner <b>*</b>
              <input value={draft.ownerName ?? ''} onChange={(event) => patchDraft({ ownerName: event.target.value })} />
            </label>
            <label>
              处理状态
              <select value={normalizeFeedbackStatus(draft.status)} onChange={(event) => patchDraft({ status: event.target.value })}>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              处理结论 result <b>*</b>
              <textarea value={draft.result ?? ''} onChange={(event) => patchDraft({ result: event.target.value })} />
            </label>
            <label>
              处理说明 resolutionNote <b>*</b>
              <textarea value={draft.resolutionNote ?? ''} onChange={(event) => patchDraft({ resolutionNote: event.target.value })} />
            </label>
            <label className="admin-switch-row">
              是否进入复盘指标 includedInReview
              <input type="checkbox" checked={draft.includedInReview} onChange={(event) => patchDraft({ includedInReview: event.target.checked })} />
            </label>
            <label>
              handlerName
              <input value={currentAdminUser.name} readOnly />
            </label>
            <label>
              handledAt
              <input value={draft.handledAt ?? '保存后生成'} readOnly />
            </label>
          </div>
        )}
      </RightDrawer>
    </div>
  );
}
