import { ActionButton, DataRow, SectionCard, StatGrid, StatusChip } from '../components.tsx';
import type { DashboardData } from '../dashboardData.ts';

type Navigate = (path: string) => void;
type Toast = (message: string) => void;

const funnel = [
  ['收到 Bot 入口', 100],
  ['打开新人首页', 100],
  ['查看 D1 引导', 92],
  ['查看岗位权限包', 86],
  ['发起权限申请', 74],
  ['点击我已提交', 67],
] as const;

function isParsedStatus(status?: string) {
  return ['parsed', 'simulated', 'simulated_parsed'].includes(status ?? '');
}

function isVectorReadyStatus(status?: string) {
  return ['ready', 'simulated', 'simulated_vectorized'].includes(status ?? '');
}

function formatDocStatus(parseStatus: string, vectorStatus: string) {
  if (isParsedStatus(parseStatus) && isVectorReadyStatus(vectorStatus)) return '可复用';
  if (parseStatus === 'pending' || vectorStatus === 'pending') return '待模拟解析';
  return '需确认';
}

export function ReviewPage({ data, navigate, toast }: { data: DashboardData; navigate: Navigate; toast: Toast }) {
  const metrics = data.metrics;
  const knowledgeDocs = data.knowledgeDocs ?? [];
  const enabledDocs = knowledgeDocs.filter((doc) => doc.status === 'enabled');
  const knowledgeGaps = knowledgeDocs.filter((doc) => doc.status !== 'enabled' || !isParsedStatus(doc.parseStatus) || !isVectorReadyStatus(doc.vectorStatus));
  const visibleKnowledgeDocs = (knowledgeGaps.length > 0 ? knowledgeGaps : knowledgeDocs).slice(0, 4);
  const anonymousModules = data.anonymousConfig?.modules ?? [];
  const activeAnonymousModules = anonymousModules.filter((module) => module.enabled);
  const activeProblemTypeCount = activeAnonymousModules.reduce((total, module) => total + module.problemTypes.filter((item) => item.enabled).length, 0);
  const nextActions = [
    metrics?.pendingFollowUpCount ? `${metrics.pendingFollowUpCount} 个 4 小时回访仍待处理` : '4 小时回访暂无积压',
    knowledgeGaps.length ? `${knowledgeGaps.length} 份知识库资料需完成模拟解析/启用` : '知识库资料均可进入复盘统计',
    activeAnonymousModules.length ? `${activeAnonymousModules.length} 个匿名反馈模块、${activeProblemTypeCount} 个问题类型可用于归因` : '匿名反馈模块尚未启用',
  ];

  return (
    <>
      <SectionCard
        title="本期核心指标"
        action={<StatusChip tone="blue">后台实时数据</StatusChip>}
      >
        <StatGrid
          items={[
            { value: metrics?.newcomerCount ?? 0, label: '试点新人' },
            { value: metrics?.submittedPermissionCount ?? 0, label: '权限提交' },
            { value: metrics?.anonymousFeedbackCount ?? 0, label: '匿名反馈' },
            { value: metrics?.weeklyFeedbackCount ?? 0, label: '首周反馈' },
            { value: metrics?.knowledgeDocCount ?? 0, label: '知识库资料' },
            { value: metrics?.pendingFollowUpCount ?? 0, label: '待回访' },
          ]}
        />
        <p className="review-note">指标由真实后端聚合；匿名反馈只进入类型统计和处理状态，不在复盘页展示原文。</p>
        <ActionButton tone="secondary" onClick={() => toast('已生成 mock 复盘摘要')}>
          生成 mock 复盘摘要
        </ActionButton>
      </SectionCard>

      <SectionCard title="新人主流程漏斗">
        <div className="bar-list">
          {funnel.map(([item, percent]) => (
            <div key={item}>
              <span>{item}</span>
              <i style={{ width: `${percent}%` }} />
              <em>{percent}%</em>
            </div>
          ))}
        </div>
        <p className="review-note">当前为 V1 试点复盘口径，用于发现权限申请、D1 引导和回访流程里的阻塞点。</p>
      </SectionCard>

      <SectionCard
        title="匿名反馈类型"
        action={<StatusChip tone="warning">{activeProblemTypeCount} 个启用类型</StatusChip>}
      >
        <div className="review-summary-strip">
          <span>仅展示配置归因</span>
          <span>不展示匿名原文</span>
          <span>处理动作回流后台</span>
        </div>
        {activeAnonymousModules.length > 0 ? (
          activeAnonymousModules.map((module) => (
            <DataRow
              key={module.id}
              title={module.label}
              desc={module.problemTypes.filter((item) => item.enabled).map((item) => item.label).join(' · ') || '暂无启用问题类型'}
              chip={`${module.expectedActions.filter((item) => item.enabled).length} 个处理方式`}
              tone="warning"
            />
          ))
        ) : (
          <div className="review-empty-state">暂无启用的匿名反馈模块，请先在后台配置三级联动。</div>
        )}
        <ActionButton tone="secondary" onClick={() => navigate('/admin-config?tab=feedback-pool')}>
          去反馈池处理
        </ActionButton>
      </SectionCard>

      <SectionCard
        title="知识库缺口 / 下轮内容补齐清单"
        action={<StatusChip tone="ai">{enabledDocs.length} 份启用</StatusChip>}
      >
        {visibleKnowledgeDocs.length > 0 ? (
          visibleKnowledgeDocs.map((doc) => (
            <DataRow
              key={doc.id}
              title={doc.title}
              desc={`${doc.category} · ${doc.applicableRole} · Owner ${doc.ownerName}`}
              chip={formatDocStatus(doc.parseStatus, doc.vectorStatus)}
              tone={formatDocStatus(doc.parseStatus, doc.vectorStatus) === '可复用' ? 'success' : 'ai'}
            />
          ))
        ) : (
          <div className="review-empty-state">暂无知识库元数据，复盘页会在后台上传后自动读取。</div>
        )}
        <ActionButton tone="secondary" onClick={() => navigate('/admin-config?tab=knowledge')}>
          去后台补齐知识库
        </ActionButton>
      </SectionCard>

      <SectionCard title="管理者摘要指标 / 下轮动作">
        <StatGrid
          items={[
            { value: metrics?.weeklyFeedbackCount ?? 0, label: '可见首周反馈' },
            { value: data.weekly?.managerAction?.managerActionStatus ?? 'unread', label: '经理处理状态' },
            { value: metrics?.pendingFollowUpCount ?? 0, label: '待协同跟进' },
          ]}
        />
        <div className="review-next-actions">
          {nextActions.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
