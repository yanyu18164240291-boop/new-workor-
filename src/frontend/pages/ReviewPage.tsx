import { ActionButton, DataRow, SectionCard, StatGrid } from '../components.tsx';
import type { DashboardData } from '../dashboardData.ts';

type Navigate = (path: string) => void;
type Toast = (message: string) => void;

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
