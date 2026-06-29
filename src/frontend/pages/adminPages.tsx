import { useEffect, useState } from 'react';

import {
  api,
  type AnonymousFeedback,
  type AnonymousFeedbackConfig,
  type D1GuideConfig,
  type D1GuideConfigItem,
  type PermissionItem,
  type Role,
  type WeeklyFeedbackConfig,
} from '../api.ts';
import { ActionButton, DataRow, SectionCard, StatGrid } from '../components.tsx';
import type { DashboardData } from '../dashboardData.ts';

type Navigate = (path: string) => void;
type Toast = (message: string) => void;
type Reload = () => Promise<void>;

const feedbackStatuses = [
  ['pending', '待处理'],
  ['in_progress', '处理中'],
  ['knowledge_added', '已补充知识库'],
  ['permission_entry_fixed', '已修正权限入口'],
  ['deferred', '暂不处理'],
  ['closed', '已关闭'],
] as const;

const blankPermission = {
  name: '',
  category: '办公基础',
  permissionType: 'optional' as const,
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

const blankKnowledgeDoc = {
  title: '',
  category: '入职流程',
  applicableRole: '',
  applicableStage: 'D1-D7',
  sourceUrl: 'mock-drive://admin-upload',
  ownerName: '',
};

function toD1Items(config?: D1GuideConfig): D1GuideConfigItem[] {
  return [config?.joinGroup, config?.employeeGuide, config?.permissionPackage].filter(Boolean) as D1GuideConfigItem[];
}

function waitingReasonsText(item: PermissionItem): string {
  return item.commonWaitingReasons.join('\n');
}

function splitWaitingReasons(value: string): string[] {
  return value
    .split(/\r?\n|、|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AdminPage({ data, search, toast, reload }: { data: DashboardData; search: string; toast: Toast; reload: Reload }) {
  const showFeedback = search.includes('feedback');
  const showKnowledge = search.includes('knowledge');

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [d1Draft, setD1Draft] = useState<D1GuideConfigItem[]>([]);
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyFeedbackConfig>({ questions: [] });
  const [anonymousDraft, setAnonymousDraft] = useState<AnonymousFeedbackConfig>({ modules: [] });
  const [feedbackDrafts, setFeedbackDrafts] = useState<AnonymousFeedback[]>([]);
  const [knowledgeDraft, setKnowledgeDraft] = useState(blankKnowledgeDoc);
  const [newPermission, setNewPermission] = useState(blankPermission);

  useEffect(() => {
    setRoles(data.admin?.roles ?? []);
    setPermissions(data.admin?.permissionItems ?? []);
  }, [data.admin]);

  useEffect(() => {
    setD1Draft(toD1Items(data.d1GuideConfig ?? data.admin?.d1GuideConfig));
  }, [data.d1GuideConfig, data.admin?.d1GuideConfig]);

  useEffect(() => {
    setWeeklyDraft(data.weeklyConfig ?? { questions: [] });
  }, [data.weeklyConfig]);

  useEffect(() => {
    setAnonymousDraft(data.anonymousConfig ?? data.admin?.anonymousFeedbackConfig ?? { modules: [] });
  }, [data.anonymousConfig, data.admin?.anonymousFeedbackConfig]);

  useEffect(() => {
    setFeedbackDrafts(data.anonymous ?? data.admin?.anonymousFeedbacks ?? []);
  }, [data.anonymous, data.admin?.anonymousFeedbacks]);

  function updateRole(roleId: string, patch: Partial<Role>) {
    setRoles((current) => current.map((role) => (role.id === roleId ? { ...role, ...patch } : role)));
  }

  function updatePermission(permissionId: string, patch: Partial<PermissionItem>) {
    setPermissions((current) => current.map((item) => (item.id === permissionId ? { ...item, ...patch } : item)));
  }

  function updateD1(actionKey: string, patch: Partial<D1GuideConfigItem>) {
    setD1Draft((current) => current.map((item) => (item.actionKey === actionKey ? { ...item, ...patch } : item)));
  }

  function updateWeeklyQuestion(questionId: string, title: string) {
    setWeeklyDraft((current) => ({
      questions: current.questions.map((question) => (question.id === questionId ? { ...question, title } : question)),
    }));
  }

  function updateWeeklyOption(questionId: string, optionId: string, label: string) {
    setWeeklyDraft((current) => ({
      questions: current.questions.map((question) =>
        question.id === questionId
          ? { ...question, options: question.options.map((option) => (option.id === optionId ? { ...option, label } : option)) }
          : question,
      ),
    }));
  }

  function updateAnonymousModule(moduleId: string, label: string) {
    setAnonymousDraft((current) => ({
      modules: current.modules.map((module) => (module.id === moduleId ? { ...module, label } : module)),
    }));
  }

  function updateAnonymousProblemType(moduleId: string, id: string, label: string) {
    setAnonymousDraft((current) => ({
      modules: current.modules.map((module) =>
        module.id === moduleId
          ? { ...module, problemTypes: module.problemTypes.map((item) => (item.id === id ? { ...item, label } : item)) }
          : module,
      ),
    }));
  }

  function updateAnonymousExpectedAction(moduleId: string, id: string, label: string) {
    setAnonymousDraft((current) => ({
      modules: current.modules.map((module) =>
        module.id === moduleId
          ? { ...module, expectedActions: module.expectedActions.map((item) => (item.id === id ? { ...item, label } : item)) }
          : module,
      ),
    }));
  }

  function updateFeedback(id: string, patch: Partial<AnonymousFeedback>) {
    setFeedbackDrafts((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function saveRolePermissionConfig() {
    await Promise.all([
      ...roles.map((role) => api.updateRole(role.id, role)),
      ...permissions.map((item) => api.updatePermissionItem(item.id, item)),
    ]);
    toast('已保存岗位权限包配置');
    await reload();
  }

  async function addPermissionItem() {
    const created = await api.createPermissionItem(newPermission);
    const roleId = roles[0]?.id;
    if (roleId) {
      await api.createRolePermissionItem({ roleId, permissionItemId: created.id, sortOrder: permissions.length + 1 });
    }
    setNewPermission(blankPermission);
    toast('已新增权限项并加入当前岗位权限包');
    await reload();
  }

  async function saveD1Config() {
    await api.updateD1GuideConfig(d1Draft);
    toast('已保存 D1 引导配置');
    await reload();
  }

  async function saveWeeklyConfig() {
    await api.updateWeeklyFeedbackConfig(
      weeklyDraft.questions.map((question) => ({
        id: question.id,
        title: question.title,
        options: question.options.map((option) => ({ id: option.id, label: option.label })),
      })),
    );
    toast('已保存首周反馈配置');
    await reload();
  }

  async function saveAnonymousConfig() {
    await api.updateAnonymousFeedbackConfig({
      modules: anonymousDraft.modules.map((module) => ({ id: module.id, label: module.label, enabled: module.enabled })),
      problemTypes: anonymousDraft.modules.flatMap((module) =>
        module.problemTypes.map((item) => ({ id: item.id, label: item.label, requiresText: item.requiresText, enabled: item.enabled })),
      ),
      expectedActions: anonymousDraft.modules.flatMap((module) =>
        module.expectedActions.map((item) => ({ id: item.id, label: item.label, requiresText: item.requiresText, enabled: item.enabled })),
      ),
    });
    toast('已保存匿名反馈三级联动配置');
    await reload();
  }

  async function createKnowledgeDocFromAdmin() {
    await api.createKnowledgeDoc({
      ...knowledgeDraft,
      applicableRole: knowledgeDraft.applicableRole || data.package?.role.name || roles[0]?.name || '协同办公产品实习生',
    });
    setKnowledgeDraft(blankKnowledgeDoc);
    toast('已保存知识库资料元数据，解析和向量化仍为模拟状态');
    await reload();
  }

  async function saveFeedback(item: AnonymousFeedback) {
    await api.updateAnonymousFeedback(item.id, {
      status: item.status,
      ownerName: item.ownerName ?? '',
      result: item.result ?? '',
      handlerName: 'demo-admin',
      resolutionNote: item.resolutionNote ?? item.result ?? '',
      includedInReview: item.includedInReview,
    });
    toast('已保存匿名反馈处理结果');
    await reload();
  }

  return (
    <>
      <SectionCard title="后台配置维护台">
        <p>P0 配置和反馈处理均写入真实后端数据库。启停通过 enabled/status 完成，不做物理删除。</p>
        <div className="tab-switcher">
          <span className={!showFeedback && !showKnowledge ? 'selected' : ''}>权限配置</span>
          <span className={showKnowledge ? 'selected' : ''}>知识库</span>
          <span className={showFeedback ? 'selected' : ''}>反馈池</span>
        </div>
      </SectionCard>

      {!showFeedback && !showKnowledge && (
        <>
          <SectionCard title="岗位权限包管理">
            <div className="admin-config-form">
              {roles.map((role) => (
                <div className="admin-question-editor" key={role.id}>
                  <div className="config-option-grid">
                    <input value={role.name} onChange={(event) => updateRole(role.id, { name: event.target.value })} />
                    <input value={role.department} onChange={(event) => updateRole(role.id, { department: event.target.value })} />
                    <input value={role.description} onChange={(event) => updateRole(role.id, { description: event.target.value })} />
                  </div>
                </div>
              ))}
              {permissions.map((item) => (
                <div className="admin-question-editor" key={item.id}>
                  <div className="config-row-head">
                    <select value={item.permissionType} onChange={(event) => updatePermission(item.id, { permissionType: event.target.value as 'required' | 'optional' })}>
                      <option value="required">必开</option>
                      <option value="optional">可选</option>
                    </select>
                    <input value={item.name} onChange={(event) => updatePermission(item.id, { name: event.target.value })} />
                  </div>
                  <div className="config-option-grid">
                    <input value={item.ownerName} onChange={(event) => updatePermission(item.id, { ownerName: event.target.value })} />
                    <input value={item.ownerContact} onChange={(event) => updatePermission(item.id, { ownerContact: event.target.value })} />
                    <input value={item.applyUrl} onChange={(event) => updatePermission(item.id, { applyUrl: event.target.value })} />
                    <input value={item.approverName} onChange={(event) => updatePermission(item.id, { approverName: event.target.value })} />
                  </div>
                  <textarea value={item.reasonTemplate} onChange={(event) => updatePermission(item.id, { reasonTemplate: event.target.value })} />
                  <textarea value={waitingReasonsText(item)} onChange={(event) => updatePermission(item.id, { commonWaitingReasons: splitWaitingReasons(event.target.value) })} />
                  <label className="admin-check-row">
                    <input type="checkbox" checked={item.enabled} onChange={(event) => updatePermission(item.id, { enabled: event.target.checked })} />
                    启用
                  </label>
                </div>
              ))}
            </div>
            <div className="dual-actions">
              <ActionButton onClick={saveRolePermissionConfig}>保存岗位权限包</ActionButton>
              <ActionButton tone="secondary" onClick={addPermissionItem}>新增权限项</ActionButton>
            </div>
            <div className="admin-question-editor inner">
              <div className="config-option-grid">
                <input placeholder="权限名称" value={newPermission.name} onChange={(event) => setNewPermission({ ...newPermission, name: event.target.value })} />
                <input placeholder="Owner" value={newPermission.ownerName} onChange={(event) => setNewPermission({ ...newPermission, ownerName: event.target.value })} />
                <input placeholder="Owner 联系方式" value={newPermission.ownerContact} onChange={(event) => setNewPermission({ ...newPermission, ownerContact: event.target.value })} />
                <input placeholder="申请入口名称" value={newPermission.applyEntryName} onChange={(event) => setNewPermission({ ...newPermission, applyEntryName: event.target.value })} />
                <input placeholder="申请入口" value={newPermission.applyUrl} onChange={(event) => setNewPermission({ ...newPermission, applyUrl: event.target.value })} />
              </div>
              <textarea placeholder="理由模板" value={newPermission.reasonTemplate} onChange={(event) => setNewPermission({ ...newPermission, reasonTemplate: event.target.value })} />
              <input className="inline-text-input" placeholder="审批人" value={newPermission.approverName} onChange={(event) => setNewPermission({ ...newPermission, approverName: event.target.value })} />
            </div>
          </SectionCard>

          <SectionCard title="D1 引导配置">
            <div className="admin-config-form">
              {d1Draft.map((item) => (
                <div className="admin-question-editor" key={item.actionKey}>
                  <div className="config-row-head">
                    <span>{item.actionKey}</span>
                    <input value={item.title} onChange={(event) => updateD1(item.actionKey, { title: event.target.value })} />
                  </div>
                  <div className="config-option-grid">
                    <input value={item.targetGroupName ?? ''} placeholder="飞书群" onChange={(event) => updateD1(item.actionKey, { targetGroupName: event.target.value })} />
                    <input value={item.documentUrl ?? ''} placeholder="员工指南册链接" onChange={(event) => updateD1(item.actionKey, { documentUrl: event.target.value })} />
                    <input value={item.routePath ?? ''} placeholder="权限包入口" onChange={(event) => updateD1(item.actionKey, { routePath: event.target.value })} />
                    <input value={item.ownerName} placeholder="Owner" onChange={(event) => updateD1(item.actionKey, { ownerName: event.target.value })} />
                  </div>
                  <textarea value={item.description} onChange={(event) => updateD1(item.actionKey, { description: event.target.value })} />
                  <label className="admin-check-row">
                    <input type="checkbox" checked={item.enabled} onChange={(event) => updateD1(item.actionKey, { enabled: event.target.checked })} />
                    启用
                  </label>
                </div>
              ))}
            </div>
            <ActionButton onClick={saveD1Config}>保存 D1 引导配置</ActionButton>
          </SectionCard>

          <SectionCard title="首周反馈配置">
            <div className="admin-config-form">
              {weeklyDraft.questions.map((question) => (
                <div className="admin-question-editor" key={question.id}>
                  <div className="config-row-head">
                    <span>{question.inputType === 'single' ? '单选' : question.inputType === 'multi' ? '多选' : '文本'}</span>
                    <input value={question.title} onChange={(event) => updateWeeklyQuestion(question.id, event.target.value)} />
                  </div>
                  {question.inputType !== 'text' && (
                    <div className="config-option-grid">
                      {question.options.map((option) => (
                        <input key={option.id} value={option.label} onChange={(event) => updateWeeklyOption(question.id, option.id, event.target.value)} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <ActionButton onClick={saveWeeklyConfig}>保存首周反馈配置</ActionButton>
          </SectionCard>

          <SectionCard title="匿名反馈三级联动配置">
            <div className="admin-config-form">
              {anonymousDraft.modules.map((module) => (
                <div className="admin-question-editor" key={module.id}>
                  <input className="inline-text-input" value={module.label} onChange={(event) => updateAnonymousModule(module.id, event.target.value)} />
                  <div className="config-option-grid">
                    {module.problemTypes.map((item) => (
                      <input key={item.id} value={item.label} onChange={(event) => updateAnonymousProblemType(module.id, item.id, event.target.value)} />
                    ))}
                  </div>
                  <div className="config-option-grid">
                    {module.expectedActions.map((item) => (
                      <input key={item.id} value={item.label} onChange={(event) => updateAnonymousExpectedAction(module.id, item.id, event.target.value)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <ActionButton onClick={saveAnonymousConfig}>保存匿名反馈配置</ActionButton>
          </SectionCard>
        </>
      )}

      {showKnowledge && (
        <SectionCard title="知识库管理">
          <div className="admin-question-editor">
            <div className="config-option-grid">
              <input placeholder="文档名称" value={knowledgeDraft.title} onChange={(event) => setKnowledgeDraft({ ...knowledgeDraft, title: event.target.value })} />
              <input placeholder="知识分类" value={knowledgeDraft.category} onChange={(event) => setKnowledgeDraft({ ...knowledgeDraft, category: event.target.value })} />
              <input placeholder="适用岗位" value={knowledgeDraft.applicableRole} onChange={(event) => setKnowledgeDraft({ ...knowledgeDraft, applicableRole: event.target.value })} />
              <input placeholder="适用阶段" value={knowledgeDraft.applicableStage} onChange={(event) => setKnowledgeDraft({ ...knowledgeDraft, applicableStage: event.target.value })} />
              <input placeholder="Owner" value={knowledgeDraft.ownerName} onChange={(event) => setKnowledgeDraft({ ...knowledgeDraft, ownerName: event.target.value })} />
              <input placeholder="模拟文件链接" value={knowledgeDraft.sourceUrl} onChange={(event) => setKnowledgeDraft({ ...knowledgeDraft, sourceUrl: event.target.value })} />
            </div>
            <ActionButton onClick={createKnowledgeDocFromAdmin}>开始上传</ActionButton>
          </div>
          {(data.knowledgeDocs ?? []).map((doc) => (
            <DataRow key={doc.id} title={doc.title} desc={`${doc.category} · ${doc.applicableRole} · ${doc.ownerName} · 命中 ${doc.hitCount}`} chip={doc.vectorStatus} tone="ai" />
          ))}
        </SectionCard>
      )}

      {showFeedback && (
        <>
          <SectionCard title="新人首周反馈分析">
            <StatGrid
              items={[
                { value: data.weeklyAnalysis?.submissionCount ?? 0, label: '提交人数' },
                { value: data.weeklyAnalysis?.questions.length ?? 0, label: '分析题目' },
                { value: data.weeklyConfig?.questions.length ?? 0, label: '配置题目' },
              ]}
            />
            {(data.weeklyAnalysis?.questions ?? [])
              .filter((question) => question.inputType !== 'text')
              .map((question) => (
                <DataRow key={question.questionKey} title={question.title} desc={question.options.map((option) => `${option.label} ${option.count}`).join(' · ')} chip="选项分布" tone="blue" />
              ))}
          </SectionCard>
          <SectionCard title="后台匿名反馈池">
            <div className="admin-config-form">
              {feedbackDrafts.map((item) => (
                <div className="admin-question-editor" key={item.id}>
                  <DataRow title={`${item.feedbackNo} · ${item.type}`} desc={`${item.module} · ${item.description}`} chip={item.isAnonymous ? '匿名' : '可联系'} tone="warning" />
                  <div className="config-option-grid">
                    <select value={item.status} onChange={(event) => updateFeedback(item.id, { status: event.target.value })}>
                      {feedbackStatuses.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input value={item.ownerName ?? ''} placeholder="处理 Owner" onChange={(event) => updateFeedback(item.id, { ownerName: event.target.value })} />
                    <label className="admin-check-row">
                      <input type="checkbox" checked={item.includedInReview} onChange={(event) => updateFeedback(item.id, { includedInReview: event.target.checked })} />
                      进入复盘指标
                    </label>
                  </div>
                  <textarea value={item.result ?? ''} onChange={(event) => updateFeedback(item.id, { result: event.target.value })} />
                  <textarea value={item.resolutionNote ?? ''} onChange={(event) => updateFeedback(item.id, { resolutionNote: event.target.value })} />
                  <ActionButton tone="secondary" onClick={() => saveFeedback(item)}>
                    保存处理结果
                  </ActionButton>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </>
  );
}

export function ReviewPage({ data, navigate, toast }: { data: DashboardData; navigate: Navigate; toast: Toast }) {
  const funnel = ['收到 Bot 入口', '打开新人首页', '查看 D1 引导', '查看岗位权限包', '发起权限申请', '点击我已提交'];
  return (
    <>
      <SectionCard title="本期核心指标">
        <StatGrid
          items={[
            { value: data.metrics?.newcomerCount ?? 0, label: '试点新人' },
            { value: data.metrics?.submittedPermissionCount ?? 0, label: '权限提交' },
            { value: data.metrics?.anonymousFeedbackCount ?? 0, label: '匿名反馈' },
            { value: data.metrics?.weeklyFeedbackCount ?? 0, label: '首周反馈' },
            { value: data.metrics?.knowledgeDocCount ?? 0, label: '知识库资料' },
            { value: data.metrics?.pendingFollowUpCount ?? 0, label: '待回访' },
          ]}
        />
        <ActionButton tone="secondary" onClick={() => toast('已生成 mock 复盘摘要')}>
          生成 mock 复盘摘要
        </ActionButton>
      </SectionCard>
      <SectionCard title="新人主流程漏斗">
        <div className="bar-list">
          {funnel.map((item, index) => (
            <div key={item}>
              <span>{item}</span>
              <i style={{ width: `${100 - index * 8}%` }} />
              <em>{index < 4 ? '100%' : '67%'}</em>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="权限申请未完成类型 / 匿名反馈类型">
        <div className="mini-bars">
          <span>审批等待</span>
          <span>Owner 不清</span>
          <span>入口不清</span>
          <span>理由模板不清</span>
        </div>
        {(data.anonymousConfig?.modules ?? []).map((module) => (
          <DataRow key={module.id} title={module.label} desc={module.problemTypes.map((item) => item.label).join(' · ')} chip="反馈类型" tone="warning" />
        ))}
        <ActionButton tone="secondary" onClick={() => navigate('/admin-config?tab=feedback')}>
          去反馈池处理
        </ActionButton>
      </SectionCard>
      <SectionCard title="知识库缺口 / 下轮内容补齐清单">
        {(data.knowledgeDocs ?? []).slice(0, 4).map((doc) => (
          <DataRow key={doc.id} title={doc.title} desc={`${doc.category} · ${doc.ownerName}`} chip={doc.parseStatus} tone="ai" />
        ))}
        <ActionButton tone="secondary" onClick={() => navigate('/admin-config?tab=knowledge')}>
          去后台补齐知识库
        </ActionButton>
      </SectionCard>
      <SectionCard title="管理者摘要指标">
        <StatGrid
          items={[
            { value: data.metrics?.weeklyFeedbackCount ?? 0, label: '可见首周反馈' },
            { value: data.weekly?.managerAction?.managerActionStatus ?? 'unread', label: '经理处理状态' },
            { value: data.metrics?.pendingFollowUpCount ?? 0, label: '待协同跟进' },
          ]}
        />
      </SectionCard>
    </>
  );
}
