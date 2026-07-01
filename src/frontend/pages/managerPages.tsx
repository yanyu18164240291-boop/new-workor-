import { api } from '../api.ts';
import { ActionButton, Card, DataRow, SectionCard, StatGrid, StatusChip, StepList } from '../components.tsx';
import type { DashboardData } from '../dashboardData.ts';
import { DEMO_WEEKLY_FEEDBACK_ID } from '../demoConfig.ts';

type Navigate = (path: string) => void;
type Toast = (message: string) => void;
type Reload = () => Promise<void>;

function roleName(data: DashboardData, roleId?: string): string {
  return data.roles?.find((role) => role.id === roleId)?.name ?? '岗位已停用';
}

function visibleManagerNewcomers(data: DashboardData) {
  return data.newcomers ?? [];
}

export function ManagerPage({ data, navigate, toast }: { data: DashboardData; navigate: Navigate; toast: Toast }) {
  const newcomers = visibleManagerNewcomers(data);
  const roleCounts = (data.roles ?? []).map((role) => ({
    value: newcomers.filter((newcomer) => newcomer.roleId === role.id).length,
    label: role.name,
  }));

  return (
    <>
      <SectionCard title={`今日新员工 ${newcomers.length} 人`} action={<StatusChip tone="success">需关注</StatusChip>}>
        <StatGrid items={roleCounts.length > 0 ? roleCounts : [{ value: 0, label: '暂无启用岗位' }]} />
      </SectionCard>
      <SectionCard title="今日到岗名单" action={<button className="text-button">点击查看详情</button>}>
        {newcomers.length > 0 ? (
          newcomers.map((newcomer) => (
            <DataRow
              key={newcomer.id}
              title={newcomer.name}
              desc={`${roleName(data, newcomer.roleId)} · ${newcomer.stage} · ${newcomer.managerName}`}
              chip={newcomer.weeklyFeedbackSubmitted ? '首周反馈需查看' : '权限待跟进'}
              tone={newcomer.weeklyFeedbackSubmitted ? 'success' : 'warning'}
              onClick={() => navigate(`/manager/newcomer/${newcomer.id}`)}
            />
          ))
        ) : (
          <Card className="quiet-card">当前没有归属于启用岗位的新人。停用岗位的历史记录仍保留，但不进入管理端概览。</Card>
        )}
      </SectionCard>
      <SectionCard title="今日管理动作">
        <p>1. 查看 ChatGPT 账号权限卡点，确认是否需要导师跟进。</p>
        <p>2. 查看新人首周反馈，输出支持动作。</p>
        <ActionButton tone="secondary" onClick={() => toast('已模拟提醒导师跟进')}>
          提醒导师跟进
        </ActionButton>
      </SectionCard>
    </>
  );
}

export function ManagerDetailPage({ data, navigate, toast }: { data: DashboardData; navigate: Navigate; toast: Toast }) {
  const currentRoleName = roleName(data, data.newcomer?.roleId);
  if (!data.roles?.some((role) => role.id === data.newcomer?.roleId)) {
    return <Card className="quiet-card">该新人的岗位已停用，管理端概览不再展示；历史跟进记录仍保留。</Card>;
  }

  return (
    <>
      <Card className="newcomer-card">
        <div className="avatar-block">燕</div>
        <div>
          <h2>燕余</h2>
          <p>{currentRoleName} · D7 · 首周中</p>
        </div>
        <StatusChip tone="success">跟进中</StatusChip>
      </Card>
      <StatGrid
        items={[
          { value: 5, label: '已完成事项' },
          { value: 2, label: '待跟进权限' },
          { value: 1, label: '需支持事项' },
        ]}
      />
      <SectionCard title="新人首周工作摘要">
        <StepList
          steps={[
            { no: 'D1', title: '09:30 完成 D1 到达包', desc: '加入群、查看指南、查看权限包', status: '已完成' },
            { no: 'D1', title: '10:45 查看岗位权限包', desc: 'OA / Mail / ChatGPT / QoderWork', status: '已完成' },
            { no: 'D3', title: '19:30 提交 OA 权限进度', desc: '进入 4 小时回访', status: '待回访' },
          ]}
        />
      </SectionCard>
      <SectionCard title="本周完成情况">
        <DataRow title="邮箱 / OA 权限" desc="已提交，等待开通或回访" chip="待跟进" tone="warning" />
        <DataRow title="ChatGPT 账号" desc="已申请并登记回访" chip="待回访" tone="warning" />
        <DataRow title="QoderWork 账号" desc="已完成申请" chip="已完成" tone="success" />
      </SectionCard>
      <SectionCard title="新人写给管理者">
        <p>{data.weekly?.message ?? '新人暂未提交首周反馈'}</p>
        <div className="dual-actions">
          <ActionButton onClick={() => navigate(`/manager/feedback/${DEMO_WEEKLY_FEEDBACK_ID}`)}>查看完整反馈</ActionButton>
          <ActionButton tone="secondary" onClick={() => toast('已模拟提醒 +1 跟进')}>
            提醒 +1
          </ActionButton>
        </div>
      </SectionCard>
      <Card className="notice-card">管理者视角只做入职支持和卡点跟进，不展示匿名反馈原文、聊天记录、绩效评价或能力评分。</Card>
    </>
  );
}

export function ManagerFeedbackPage({ data, reload, toast }: { data: DashboardData; reload: Reload; toast: Toast }) {
  async function record(status: string, note: string) {
    if (!data.weekly) return;
    await api.updateManagerFeedbackAction(data.weekly.id, status, note);
    toast(status === 'arranged_talk' ? '已记录安排沟通动作' : '已记录查看');
    await reload();
  }
  return (
    <>
      <Card className="newcomer-card">
        <div className="avatar-block">燕</div>
        <div>
          <h2>新人首周反馈</h2>
          <p>由入职者填写，供管理者查看与跟进</p>
        </div>
        <StatusChip tone="success">已提交反馈</StatusChip>
      </Card>
      {data.weekly ? (
        <>
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
        <Card className="quiet-card">新人暂未提交首周反馈，可在 D7 前提醒新人填写。</Card>
      )}
      <Card className="notice-card">首周反馈不用于绩效评价。管理者只能查看和跟进，不允许修改新人原文。</Card>
      <div className="fixed-actions">
        <ActionButton onClick={() => record('arranged_talk', '已安排本周沟通')}>安排沟通</ActionButton>
        <ActionButton tone="secondary" onClick={() => record('viewed', '已查看')}>
          记录已查看
        </ActionButton>
      </div>
    </>
  );
}
