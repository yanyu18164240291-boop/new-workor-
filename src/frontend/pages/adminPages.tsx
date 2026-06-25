import { useEffect, useState } from 'react';

import { api, type WeeklyFeedbackConfig } from '../api.ts';
import { ActionButton, DataRow, SectionCard, StatGrid } from '../components.tsx';
import type { DashboardData } from '../dashboardData.ts';

type Navigate = (path: string) => void;
type Toast = (message: string) => void;
type Reload = () => Promise<void>;

export function AdminPage({ data, search, toast, reload }: { data: DashboardData; search: string; toast: Toast; reload: Reload }) {
  const showFeedback = search.includes('feedback');
  const showKnowledge = search.includes('knowledge');
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyFeedbackConfig>({ questions: [] });

  useEffect(() => {
    setWeeklyDraft(data.weeklyConfig ?? { questions: [] });
  }, [data.weeklyConfig]);

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

  async function createKnowledgeDocFromAdmin() {
    await api.createKnowledgeDoc({
      title: `后台上传演示资料 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
      category: '入职流程',
      applicableRole: data.package?.role.name ?? '协同办公产品实习生',
      applicableStage: 'D1-D7',
      sourceUrl: 'mock-drive://admin-upload',
      ownerName: '内容 Owner',
    });
    toast('已保存知识库资料元数据，解析和向量化仍为模拟状态');
    await reload();
  }

  return (
    <>
      <SectionCard title="共性流程固定，个性内容配置">
        <p>岗位权限包、权限申请路由、知识库与反馈池均从真实后端读取；上传/解析/向量化仍为模拟状态。</p>
        <div className="tab-switcher">
          <span className={!showFeedback && !showKnowledge ? 'selected' : ''}>权限配置</span>
          <span className={showKnowledge ? 'selected' : ''}>知识库</span>
          <span className={showFeedback ? 'selected' : ''}>匿名反馈池</span>
        </div>
      </SectionCard>
      {!showFeedback && (
        <SectionCard title="配置入口">
          <StatGrid
            items={[
              { value: data.admin?.roles.length ?? 0, label: '岗位权限角色' },
              { value: data.admin?.permissionItems.length ?? 0, label: '权限申请路由' },
              { value: data.knowledgeDocs?.length ?? 0, label: '知识库文档' },
            ]}
          />
          {(data.package?.requiredPermissions ?? []).map((item) => (
            <DataRow key={item.id} title={item.name} desc={`Owner：${item.ownerName} · ${item.applyUrl}`} chip="必开" tone="blue" />
          ))}
        </SectionCard>
      )}
      {!showFeedback && !showKnowledge && (
        <SectionCard title="新人首周反馈配置">
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
          <p>题目与选项来自数据库配置，后台配置接口更新后，新人端会同步展示最新问题。</p>
          <ActionButton onClick={saveWeeklyConfig}>保存首周反馈配置</ActionButton>
        </SectionCard>
      )}
      {!showFeedback && !showKnowledge && (
        <SectionCard title="匿名反馈联动配置">
          {(data.anonymousConfig?.modules ?? []).map((module) => (
            <DataRow
              key={module.moduleKey}
              title={module.label}
              desc={`问题类型：${module.problemTypes.map((item) => item.label).join('、')} · 处理动作：${module.expectedActions
                .map((item) => item.label)
                .join('、')}`}
              chip="三级联动"
              tone="ai"
            />
          ))}
          <p>新人端的模块、问题类型和希望处理动作均从数据库配置读取；提交后同时保存中文展示值与结构化 key。</p>
        </SectionCard>
      )}
      {showKnowledge && (
        <SectionCard title="知识库上传窗口">
          {(data.knowledgeDocs ?? []).map((doc) => (
            <DataRow key={doc.id} title={doc.title} desc={`${doc.category} · ${doc.ownerName} · 命中 ${doc.hitCount}`} chip={doc.vectorStatus} tone={doc.vectorStatus.includes('已') ? 'success' : 'warning'} />
          ))}
          <ActionButton onClick={createKnowledgeDocFromAdmin}>上传知识库资料</ActionButton>
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
                <DataRow
                  key={question.questionKey}
                  title={question.title}
                  desc={question.options.map((option) => `${option.label} ${option.count}`).join(' · ')}
                  chip="选项分布"
                  tone="blue"
                />
              ))}
          </SectionCard>
          <SectionCard title="后台匿名反馈池">
            {(data.anonymous ?? []).map((item) => (
              <DataRow key={item.id} title={item.type} desc={`${item.module} · ${item.description}`} chip={item.status} tone="warning" />
            ))}
          </SectionCard>
        </>
      )}
    </>
  );
}

export function ReviewPage({ data, navigate }: { data: DashboardData; navigate: Navigate }) {
  const funnel = ['收到 Bot 入口', '打开新人首页', '查看 D1 引导', '查看岗位权限包', '发起一键权限申请', '点击我已提交'];
  return (
    <>
      <SectionCard title="本期核心指标">
        <StatGrid
          items={[
            { value: 3, label: '试点新人' },
            { value: '100%', label: '入口触达率' },
            { value: data.metrics?.anonymousFeedbackCount ?? 0, label: '匿名反馈' },
            { value: '2/3', label: '首周反馈' },
          ]}
        />
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
      <SectionCard title="未完成 / 匿名反馈类型">
        <div className="mini-bars">
          <span>审批等待</span>
          <span>不知道 Owner</span>
          <span>入口不清</span>
          <span>申请理由不会写</span>
        </div>
      </SectionCard>
      <SectionCard title="下轮内容补齐清单">
        <DataRow title="ChatGPT 账号申请路径说明不够清晰" chip="知识库" tone="ai" />
        <DataRow title="QoderWork Owner 路径需要补充" chip="权限" tone="warning" />
        <ActionButton tone="secondary" onClick={() => navigate('/admin-config?tab=knowledge')}>
          去后台补齐知识库
        </ActionButton>
      </SectionCard>
    </>
  );
}
