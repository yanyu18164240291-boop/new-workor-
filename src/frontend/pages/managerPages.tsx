import { api } from '../api.ts';
import { ActionButton, Card, DataRow, SectionCard, StatusChip } from '../components.tsx';
import type { DashboardData } from '../dashboardData.ts';
import { DEMO_NEWCOMER_ID } from '../demoConfig.ts';

type Navigate = (path: string) => void;
type Toast = (message: string) => void;
type Reload = () => Promise<void>;

function managerActionLabel(status?: string) {
  if (status === 'pending_follow_up') return '待沟通';
  if (status === 'viewed') return '已查看';
  if (status === 'followed_up') return '已安排沟通';
  if (status === 'closed') return '已关闭';
  return '已提交反馈';
}

function managerActionTone(status?: string): 'success' | 'warning' | 'blue' {
  if (status === 'pending_follow_up') return 'warning';
  if (status === 'viewed' || status === 'followed_up') return 'success';
  return 'blue';
}

export function ManagerPage({ data, navigate, toast }: { data: DashboardData; navigate: Navigate; toast: Toast }) {
  const overview = data.managerOverview;
  const newcomers = overview?.newcomers ?? [];
  const roleStats = overview?.roleStats ?? [];

  return (
    <>
      <Card className="manager-overview-hero-card">
        <div>
          <h2>
            今日新员工 <strong className="manager-overview-hero-number">{overview?.summary.visibleNewcomerCount ?? 0}</strong> 人
          </h2>
          <p>协同办公部门今日入职概览</p>
        </div>
      </Card>
      <SectionCard title="岗位统计">
        <div className="manager-role-stat-grid">
          {roleStats.map((item) => (
            <div className="manager-role-stat-card" key={item.roleId}>
              <strong>{item.count}</strong>
              <span>{item.roleName}</span>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="周内到岗名单">
        <div className="manager-newcomer-list">
          {newcomers.length === 0 && <p className="empty-state">暂无周内到岗新人</p>}
          {newcomers.map((newcomer) => (
              <button className="manager-newcomer-card" key={newcomer.id} type="button" onClick={() => navigate(`/manager/newcomer/${newcomer.id}`)}>
                <div className="manager-newcomer-avatar">{newcomer.name.slice(0, 1)}</div>
                <div className="manager-newcomer-main">
                  <strong>{newcomer.name}</strong>
                  <p>{newcomer.roleName}</p>
                  <p>{`+1：${newcomer.mentorName}`}</p>
                </div>
                <div className="manager-newcomer-side">
                  <StatusChip tone="blue">{newcomer.stage}</StatusChip>
                  <span className="manager-newcomer-link-icon" aria-hidden="true" />
                </div>
              </button>
            ))}
        </div>
      </SectionCard>
    </>
  );
}

function readonlyFeedbackTags(items: string[], emptyText: string) {
  if (items.length === 0) return <p>{emptyText}</p>;
  return (
    <div className="tag-row tag-grid tag-grid-two manager-feedback-tags">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function ManagerDetailPage({ data }: { data: DashboardData; navigate: Navigate; toast: Toast }) {
  const detail = data.managerDetail;
  const newcomer = detail?.newcomer ?? data.newcomer;
  const weeklyFeedback = detail?.weeklyFeedback;
  const workSummary = weeklyFeedback ? weeklyFeedback.workSummary : '';

  return (
    <>
      <Card className="newcomer-card">
        <div className="avatar-block">{newcomer?.name.slice(0, 1) ?? '新'}</div>
        <div>
          <h2>{newcomer?.name ?? '新人'}</h2>
          <p>{newcomer?.department ?? '协同办公部门'} · {newcomer?.stage ?? 'D7'} · {newcomer?.managerName ?? '直属经理'}</p>
        </div>
        <StatusChip tone="blue">{newcomer?.stage ?? 'D7'}</StatusChip>
      </Card>
      <SectionCard title="首周工作摘要">
        <Card className="quiet-card">{workSummary || '新人暂未填写首周工作摘要。'}</Card>
      </SectionCard>
      <SectionCard title="首周整体感受">
        {weeklyFeedback ? readonlyFeedbackTags([weeklyFeedback.overallFeeling || weeklyFeedback.statusText], '暂未提交反馈。') : <p>暂未提交反馈。</p>}
      </SectionCard>
      <SectionCard title="目前主要卡点（可多选）">
        {readonlyFeedbackTags(weeklyFeedback?.blockers ?? [], '新人暂未填写主要卡点。')}
      </SectionCard>
      <SectionCard title="希望管理者提供的支持（可多选）">
        {readonlyFeedbackTags(weeklyFeedback?.supportNeeded ?? [], '新人暂未填写希望获得的支持。')}
      </SectionCard>
      <SectionCard title="新人想说的话">
        <Card className="quiet-card">{weeklyFeedback?.message || '新人暂未填写想说的话。'}</Card>
      </SectionCard>
    </>
  );
}

export function ManagerFeedbackPage({ data, navigate, reload, toast }: { data: DashboardData; navigate: Navigate; reload: Reload; toast: Toast }) {
  async function record(status: 'pending_follow_up' | 'viewed', note: string) {
    if (!data.weekly) return;
    await api.updateManagerFeedbackAction(data.weekly.id, status, note);
    toast(status === 'pending_follow_up' ? '已记录安排沟通动作' : '已记录查看');
    await reload();
  }
  const newcomer = data.newcomer;
  const status = managerActionLabel(data.weekly?.managerAction?.managerActionStatus);
  const statusTone = managerActionTone(data.weekly?.managerAction?.managerActionStatus);

  return (
    <>
      <Card className="newcomer-card">
        <div className="avatar-block">{newcomer?.name.slice(0, 1) ?? '新'}</div>
        <div>
          <h2>新人首周反馈</h2>
          <p>由入职者填写，供管理者查看与跟进</p>
        </div>
        <StatusChip tone={data.weekly ? statusTone : 'warning'}>{data.weekly ? status : '未提交'}</StatusChip>
      </Card>
      {data.weekly ? (
        <>
          <SectionCard title="新人信息">
            <DataRow title={newcomer?.name ?? '新人'} desc={`${newcomer?.department ?? '协同办公部门'} · ${newcomer?.stage ?? 'D7'} · ${newcomer?.managerName ?? '直属经理'}`} chip="只读" tone="blue" />
          </SectionCard>
          <SectionCard title="首周整体感受">
            <StatusChip tone="success">{data.weekly.overallFeeling}</StatusChip>
          </SectionCard>
          <SectionCard title="目前主要卡点">
            <p>{data.weekly.blockers}</p>
          </SectionCard>
          <SectionCard title="希望管理者提供的支持">
            <div className="tag-row selected-first">
              {data.weekly.supportNeeded.split('、').map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="新人想说的话">
            <p>{data.weekly.message}</p>
          </SectionCard>
        </>
      ) : (
        <SectionCard title="新人暂未提交首周反馈">
          <p>可在 D7 前提醒新人填写。</p>
          <div className="dual-actions">
            <ActionButton onClick={() => toast('已模拟提醒新人填写首周反馈')}>提醒新人填写</ActionButton>
            <ActionButton tone="secondary" onClick={() => navigate(`/manager/newcomer/${newcomer?.id ?? DEMO_NEWCOMER_ID}`)}>
              返回详情
            </ActionButton>
          </div>
        </SectionCard>
      )}
      <Card className="notice-card">首周反馈不用于绩效评价。管理者只能查看和跟进，不允许修改新人原文。</Card>
      {data.weekly && (
        <div className="fixed-actions">
          <ActionButton onClick={() => record('pending_follow_up', '待沟通')}>安排沟通</ActionButton>
          <ActionButton tone="secondary" onClick={() => record('viewed', '已查看')}>
            记录已查看
          </ActionButton>
        </div>
      )}
    </>
  );
}
