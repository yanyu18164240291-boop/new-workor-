import { useMemo, useState } from 'react';
import { GripVertical, Plus, RefreshCw } from 'lucide-react';

import { DataTable, type DataTableColumn } from '../../components/admin-config/DataTable.tsx';
import { FieldError } from '../../components/admin-config/FieldError.tsx';
import { RightDrawer } from '../../components/admin-config/RightDrawer.tsx';
import { StatusTag } from '../../components/admin-config/StatusTag.tsx';
import { formatApiErrorMessage, type WeeklyFeedbackOption, type WeeklyFeedbackQuestion } from '../../api.ts';
import type { DashboardData } from '../../dashboardData.ts';
import { createWeeklyFeedbackQuestion, reorderWeeklyFeedbackQuestions, saveWeeklyFeedbackQuestion } from '../../services/adminConfigApi.ts';
import type { AdminConfigFilters } from '../../types/adminConfig.ts';

type WeeklyFeedbackTabProps = {
  data: DashboardData;
  filters: AdminConfigFilters;
  toast: (message: string) => void;
  reload: () => Promise<void>;
};

type WeeklyOptionDraft = Partial<WeeklyFeedbackOption> & {
  label: string;
  enabled: boolean;
  sortOrder: number;
};

type WeeklyQuestionDraft = Omit<Partial<WeeklyFeedbackQuestion>, 'options'> & {
  title: string;
  description: string;
  inputType: 'single' | 'multi' | 'text';
  required: boolean;
  maxLength: number | null;
  enabled: boolean;
  options: WeeklyOptionDraft[];
};

const blankQuestionDraft: WeeklyQuestionDraft = {
  title: '',
  description: '',
  inputType: 'single',
  required: true,
  maxLength: null,
  enabled: true,
  options: [
    { label: '选项 1', enabled: true, sortOrder: 1 },
    { label: '选项 2', enabled: true, sortOrder: 2 },
  ],
};

function getWeeklyQuestions(data: DashboardData): WeeklyFeedbackQuestion[] {
  return data.admin?.weeklyFeedbackConfig?.questions ?? data.weeklyConfig?.questions ?? [];
}

function inputTypeLabel(inputType: string) {
  if (inputType === 'single') return '单选';
  if (inputType === 'multi') return '多选';
  return '文本';
}

function formatOptionSummary(question: WeeklyFeedbackQuestion): string {
  if (question.inputType === 'text') return '-';
  const enabledOptions = question.options
    .filter((option) => option.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((option) => option.label);
  if (enabledOptions.length === 0) return '暂无启用选项';
  const summary = enabledOptions.slice(0, 4).join('、');
  return enabledOptions.length > 4 ? `${summary} 等 ${enabledOptions.length} 项` : summary;
}

function normalizeQuestion(question: WeeklyFeedbackQuestion): WeeklyQuestionDraft {
  return {
    ...question,
    description: question.description ?? '',
    maxLength: question.maxLength ?? null,
    options: question.options.map((option) => ({ ...option })),
  };
}

function copyQuestion(question: WeeklyFeedbackQuestion): WeeklyQuestionDraft {
  return {
    title: `${question.title} 复制`,
    description: question.description ?? '',
    inputType: question.inputType,
    required: question.required,
    maxLength: question.maxLength ?? null,
    enabled: true,
    options: question.options.map((option, index) => ({
      label: option.label,
      enabled: option.enabled,
      sortOrder: index + 1,
    })),
  };
}

function validateDraft(draft: WeeklyQuestionDraft): string {
  if (!draft.title.trim()) return '问题标题不能为空';
  if (draft.inputType === 'text') {
    if (draft.maxLength !== null && (!Number.isFinite(draft.maxLength) || draft.maxLength <= 0)) return '最大字数必须大于 0';
    return '';
  }
  const nonEmptyOptions = draft.options.filter((option) => option.label.trim());
  if (nonEmptyOptions.length === 0) return '选项列表至少保留 1 个选项';
  if (!nonEmptyOptions.some((option) => option.enabled)) return '单选/多选题至少保留 1 个启用选项';
  return '';
}

function createPayload(draft: WeeklyQuestionDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    inputType: draft.inputType,
    required: draft.required,
    maxLength: draft.inputType === 'text' ? draft.maxLength ?? 500 : null,
    enabled: draft.enabled,
    options:
      draft.inputType === 'text'
        ? []
        : draft.options
            .filter((option) => option.label.trim())
            .map((option, index) => ({ label: option.label.trim(), enabled: option.enabled, sortOrder: option.sortOrder ?? index + 1 })),
  };
}

function updatePayload(draft: WeeklyQuestionDraft): Parameters<typeof saveWeeklyFeedbackQuestion>[0] {
  return {
    id: draft.id ?? '',
    questionKey: draft.questionKey ?? draft.id ?? 'admin_weekly_question',
    title: draft.title.trim(),
    description: draft.description.trim() || '',
    inputType: draft.inputType,
    required: draft.required,
    maxLength: draft.inputType === 'text' ? draft.maxLength ?? 500 : null,
    enabled: draft.enabled,
    sortOrder: draft.sortOrder ?? 99,
    updatedBy: draft.updatedBy,
    options:
      draft.inputType === 'text'
        ? []
        : draft.options
            .filter((option) => option.label.trim())
            .map((option, index) => ({
              id: option.id,
              questionId: option.questionId ?? draft.id ?? '',
              optionKey: option.optionKey ?? option.id ?? `option_${index + 1}`,
              label: option.label.trim(),
              enabled: option.enabled,
              sortOrder: option.sortOrder ?? index + 1,
              updatedBy: option.updatedBy,
            })),
  };
}

function isInvalidQuestionIdError(error: unknown): boolean {
  return /questionId is invalid/i.test(formatApiErrorMessage(error, ''));
}

export function WeeklyFeedbackTab({ data, filters, toast, reload }: WeeklyFeedbackTabProps) {
  const questions = getWeeklyQuestions(data);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<WeeklyQuestionDraft>(blankQuestionDraft);
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);

  const filteredQuestions = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return questions.filter((question) => {
      const matchesKeyword =
        !keyword ||
        [question.title, question.description ?? '', question.inputType, ...question.options.map((option) => option.label)]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      const matchesStatus =
        filters.status === '全部状态' ||
        (filters.status === '启用' && question.enabled) ||
        (filters.status === '停用' && !question.enabled) ||
        !['启用', '停用'].includes(filters.status);
      return matchesKeyword && matchesStatus;
    });
  }, [filters.keyword, filters.status, questions]);

  function openCreate() {
    setDraft({ ...blankQuestionDraft, options: blankQuestionDraft.options.map((option) => ({ ...option })) });
    setFieldError('');
    setDrawerOpen(true);
  }

  function openEdit(question: WeeklyFeedbackQuestion) {
    setDraft(normalizeQuestion(question));
    setFieldError('');
    setDrawerOpen(true);
  }

  function openCopy(question: WeeklyFeedbackQuestion) {
    setDraft(copyQuestion(question));
    setFieldError('');
    setDrawerOpen(true);
  }

  function patchDraft(patch: Partial<WeeklyQuestionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function patchOption(index: number, patch: Partial<WeeklyOptionDraft>) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option)),
    }));
  }

  function addOption() {
    setDraft((current) => ({
      ...current,
      options: [...current.options, { label: `选项 ${current.options.length + 1}`, enabled: true, sortOrder: current.options.length + 1 }],
    }));
  }

  async function saveDraft() {
    const validation = validateDraft(draft);
    if (validation) {
      setFieldError(validation);
      return;
    }
    setSaving(true);
    setFieldError('');
    try {
      if (draft.id) {
        try {
          await saveWeeklyFeedbackQuestion(updatePayload(draft));
          toast('已保存首周反馈问题');
        } catch (error) {
          if (!isInvalidQuestionIdError(error)) throw error;
          await createWeeklyFeedbackQuestion(createPayload(draft));
          toast('原问题已不在当前配置中，已按新问题保存并同步到数据库');
        }
      } else {
        await createWeeklyFeedbackQuestion(createPayload(draft));
        toast('已新增首周反馈问题');
      }
      setDrawerOpen(false);
      await reload();
    } catch (error) {
      setFieldError(formatApiErrorMessage(error, '保存失败，请检查字段'));
    } finally {
      setSaving(false);
    }
  }

  async function disableQuestion(question: WeeklyFeedbackQuestion) {
    setSaving(true);
    try {
      await saveWeeklyFeedbackQuestion({ ...question, enabled: false });
      toast('已停用首周反馈问题，历史反馈仍会保留');
      await reload();
    } catch (error) {
      toast(formatApiErrorMessage(error, '停用失败'));
    } finally {
      setSaving(false);
    }
  }

  async function moveQuestionBefore(targetQuestionId: string) {
    if (!draggingQuestionId || draggingQuestionId === targetQuestionId || saving) {
      setDraggingQuestionId(null);
      return;
    }
    const fromIndex = questions.findIndex((question) => question.id === draggingQuestionId);
    const toIndex = questions.findIndex((question) => question.id === targetQuestionId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggingQuestionId(null);
      return;
    }
    const reordered = [...questions];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setSaving(true);
    try {
      await reorderWeeklyFeedbackQuestions(reordered.map((question, index) => ({ id: question.id, sortOrder: index + 1 })));
      toast('已更新首周反馈问题排序，新人端和管理端将按新顺序展示');
      await reload();
    } catch (error) {
      toast(formatApiErrorMessage(error, '排序保存失败'));
    } finally {
      setSaving(false);
      setDraggingQuestionId(null);
    }
  }

  const enabledCount = questions.filter((question) => question.enabled).length;
  const choiceCount = questions.filter((question) => question.inputType !== 'text').length;
  const textCount = questions.filter((question) => question.inputType === 'text').length;

  const columns: Array<DataTableColumn<WeeklyFeedbackQuestion>> = [
    {
      key: 'sort',
      title: '',
      render: (question) => (
        <button
          className="admin-drag-handle"
          type="button"
          draggable={!saving}
          aria-label={`拖动调整 ${question.title} 排序`}
          onDragStart={() => setDraggingQuestionId(question.id)}
          onDragOver={(event) => {
            if (!saving) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            void moveQuestionBefore(question.id);
          }}
          onDragEnd={() => setDraggingQuestionId(null)}
        >
          <GripVertical size={16} />
        </button>
      ),
    },
    { key: 'title', title: '问题标题', render: (question) => <strong>{question.title}</strong> },
    { key: 'description', title: '问题说明', render: (question) => question.description || '-' },
    { key: 'inputType', title: '输入类型', render: (question) => inputTypeLabel(question.inputType) },
    { key: 'required', title: '是否必填', render: (question) => (question.required ? '必填' : '选填') },
    { key: 'maxLength', title: '最大字数', render: (question) => (question.inputType === 'text' ? question.maxLength ?? 500 : '-') },
    { key: 'options', title: '选项列表', render: (question) => formatOptionSummary(question) },
    { key: 'status', title: '问题启用状态', render: (question) => <StatusTag tone={question.enabled ? 'success' : 'neutral'}>{question.enabled ? '启用' : '停用'}</StatusTag> },
    { key: 'updatedBy', title: 'updatedBy', render: (question) => question.updatedBy ?? 'demo-admin' },
    {
      key: 'actions',
      title: '操作',
      render: (question) => (
        <div className="admin-table-actions">
          <button type="button" onClick={() => openEdit(question)}>
            编辑
          </button>
          <button type="button" onClick={() => openCopy(question)}>
            复制
          </button>
          <button type="button" disabled={!question.enabled || saving} onClick={() => void disableQuestion(question)}>
            停用
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-workbench-panel">
      <div className="admin-page-title">
        <h1>首周反馈表</h1>
        <p>配置新人实名首周反馈表，反馈写给管理者，与匿名反馈分开维护。</p>
      </div>

      <div className="admin-metric-grid admin-metric-grid-three admin-compact-summary-grid">
        <div className="admin-card">
          <h2>启用问题</h2>
          <strong className="admin-large-number">{enabledCount}</strong>
          <p>共 {questions.length} 个问题</p>
        </div>
        <div className="admin-card">
          <h2>选择题</h2>
          <strong className="admin-large-number">{choiceCount}</strong>
          <p>单选 / 多选至少保留 1 个启用选项</p>
        </div>
        <div className="admin-card">
          <h2>文本题</h2>
          <strong className="admin-large-number">{textCount}</strong>
          <p>保存后新人端动态读取</p>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <h2>问题配置列表</h2>
          </div>
          <div className="admin-toolbar-actions">
            <button className="admin-primary-action" type="button" onClick={openCreate}>
              <Plus size={16} />
              新增反馈问题
            </button>
            <button className="admin-icon-action" type="button" onClick={() => void reload()} aria-label="刷新首周反馈表">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <div className="admin-info-strip compact">停用问题只影响新人端后续展示，历史 weekly_feedbacks 和管理者跟进记录继续保留。</div>
        <DataTable columns={columns} rows={filteredQuestions} getRowKey={(question) => question.id} emptyText="暂无首周反馈问题" />
      </section>

      <RightDrawer
        title={draft.id ? '编辑首周反馈问题' : '新增首周反馈问题'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <button className="admin-secondary-action" type="button" onClick={() => setDrawerOpen(false)}>
              取消
            </button>
            <button className="admin-primary-action" type="button" disabled={saving} onClick={() => void saveDraft()}>
              保存首周反馈表
            </button>
          </>
        }
      >
        <div className="admin-drawer-form">
          <FieldError message={fieldError} />
          <label>
            问题标题 <b>*</b>
            <input value={draft.title} onChange={(event) => patchDraft({ title: event.target.value })} />
          </label>
          <label>
            问题说明
            <textarea value={draft.description} onChange={(event) => patchDraft({ description: event.target.value })} />
          </label>
          <label>
            输入类型
            <select value={draft.inputType} onChange={(event) => patchDraft({ inputType: event.target.value as WeeklyQuestionDraft['inputType'] })}>
              <option value="single">单选</option>
              <option value="multi">多选</option>
              <option value="text">文本</option>
            </select>
          </label>
          <label className="admin-switch-row">
            是否必填
            <input type="checkbox" checked={draft.required} onChange={(event) => patchDraft({ required: event.target.checked })} />
          </label>
          {draft.inputType === 'text' && (
            <label>
              最大字数
              <input
                type="number"
                min="1"
                value={draft.maxLength ?? 500}
                onChange={(event) => patchDraft({ maxLength: Number(event.target.value) })}
              />
            </label>
          )}
          {draft.inputType !== 'text' && (
            <fieldset>
              <legend>选项列表</legend>
              <div className="admin-option-editor-list">
                <div className="admin-option-editor-head">
                  <span>选项文案</span>
                  <span>启用</span>
                  <span>排序</span>
                </div>
                {draft.options.map((option, index) => (
                  <div className="admin-option-editor-row" key={`${option.id ?? 'new'}-${index}`}>
                    <label>
                      <span className="admin-sr-label">选项文案</span>
                      <input value={option.label} onChange={(event) => patchOption(index, { label: event.target.value })} />
                    </label>
                    <label className="admin-inline-check">
                      <input type="checkbox" checked={option.enabled} onChange={(event) => patchOption(index, { enabled: event.target.checked })} />
                      启用
                    </label>
                    <label>
                      <span className="admin-sr-label">排序</span>
                      <input
                        type="number"
                        min="1"
                        value={option.sortOrder}
                        onChange={(event) => patchOption(index, { sortOrder: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                ))}
              </div>
              <button className="admin-secondary-action" type="button" onClick={addOption}>
                新增选项
              </button>
            </fieldset>
          )}
          <label className="admin-switch-row">
            问题启用状态
            <input type="checkbox" checked={draft.enabled} onChange={(event) => patchDraft({ enabled: event.target.checked })} />
          </label>
        </div>
      </RightDrawer>
    </div>
  );
}
