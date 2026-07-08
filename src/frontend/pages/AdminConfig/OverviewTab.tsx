import { BookOpen, BriefcaseBusiness, ClipboardList, MessageCircle, Plus, ShieldCheck, UploadCloud } from 'lucide-react';

import { MetricCard } from '../../components/admin-config/MetricCard.tsx';
import { StatusTag } from '../../components/admin-config/StatusTag.tsx';
import type { DashboardData } from '../../dashboardData.ts';
import type { AdminConfigFilters } from '../../types/adminConfig.ts';

type OverviewTabProps = {
  data: DashboardData;
  filters: AdminConfigFilters;
  navigate: (path: string) => void;
};

type ChangeRecord = {
  configType: string;
  objectName: string;
  updatedBy?: string;
  updatedAt?: string;
  summary: string;
};

function countEnabled<T extends { enabled?: boolean }>(items: T[]) {
  return items.filter((item) => item.enabled !== false).length;
}

function formatCompleteness(done: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.round((done / total) * 100)}%`;
}

function isOnOrBeforeDate(updatedAt: string | undefined, selectedDate: string) {
  if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return true;
  if (!updatedAt) return true;
  return updatedAt.slice(0, 10) <= selectedDate;
}

function isSimulatedPendingStatus(status: string | undefined) {
  return typeof status === 'string' && status.includes('pending');
}

function getRecentChanges(data: DashboardData, selectedDate: string): ChangeRecord[] {
  const permissions =
    data.admin?.permissionItems.map((item) => ({
      configType: '岗位权限包',
      objectName: item.name,
      updatedBy: item.updatedBy,
      updatedAt: (item as { updatedAt?: string }).updatedAt,
      summary: `维护 ${item.category} / ${item.permissionType === 'required' ? '必开' : '可选'} 权限配置。`,
    })) ?? [];
  const knowledge =
    data.knowledgeDocs?.map((item) => ({
      configType: '知识库管理',
      objectName: item.title,
      updatedBy: item.updatedBy,
      updatedAt: (item as { updatedAt?: string }).updatedAt,
      summary: `更新 ${item.category} 资料元数据。`,
    })) ?? [];
  const feedback =
    data.anonymous?.map((item) => ({
      configType: '匿名反馈池',
      objectName: item.feedbackNo,
      updatedBy: item.updatedBy,
      updatedAt: (item as { updatedAt?: string }).updatedAt,
      summary: item.result || item.resolutionNote || '更新匿名反馈处理状态。',
    })) ?? [];

  return [...permissions, ...knowledge, ...feedback]
    .filter((item) => isOnOrBeforeDate(item.updatedAt, selectedDate))
    .sort((left, right) => String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')))
    .slice(0, 5);
}

export function OverviewTab({ data, filters, navigate }: OverviewTabProps) {
  const roles = data.admin?.roles ?? [];
  const permissions = data.admin?.permissionItems ?? [];
  const knowledgeDocs = data.knowledgeDocs ?? [];
  const anonymousFeedbacks = data.anonymous ?? [];
  const d1Config = data.admin?.d1GuideConfig ?? data.d1GuideConfig;
  const d1Items = d1Config?.items?.length
    ? d1Config.items
    : [d1Config?.joinGroup, d1Config?.employeeGuide, d1Config?.permissionPackage].filter(Boolean);
  const weeklyQuestions = data.weeklyConfig?.questions ?? [];
  const anonymousModules = data.anonymousConfig?.modules ?? [];
  const pendingAnonymous = anonymousFeedbacks.filter((item) => ['pending', 'open', 'in_progress'].includes(item.status)).length;
  const recentChanges = getRecentChanges(data, filters.date);

  const completenessRows = [
    { label: '岗位权限包', done: countEnabled(permissions), total: Math.max(permissions.length, 1), path: '/admin-config?tab=role-packages' },
    { label: 'D1 引导配置', done: d1Items.filter((item) => item?.enabled !== false).length, total: Math.max(d1Items.length, 1), path: '/admin-config?tab=d1-guide' },
    { label: '首周反馈表', done: countEnabled(weeklyQuestions), total: Math.max(weeklyQuestions.length, 1), path: '/admin-config?tab=weekly-feedback' },
    { label: '匿名反馈配置', done: countEnabled(anonymousModules), total: Math.max(anonymousModules.length, 1), path: '/admin-config?tab=anonymous-config' },
    { label: '知识库管理', done: knowledgeDocs.filter((item) => item.status !== 'offline').length, total: Math.max(knowledgeDocs.length, 1), path: '/admin-config?tab=knowledge' },
  ];

  const pendingItems = [
    { type: '匿名反馈', desc: `${pendingAnonymous} 条匿名反馈待处理`, tone: 'danger' as const, path: '/admin-config?tab=feedback-pool' },
    { type: '权限配置', desc: `${permissions.filter((item) => !item.enabled).length} 个权限项已停用或待确认`, tone: 'warning' as const, path: '/admin-config?tab=role-packages' },
    {
      type: '知识库',
      desc: `${knowledgeDocs.filter((item) => isSimulatedPendingStatus(item.parseStatus) || isSimulatedPendingStatus(item.vectorStatus)).length} 份资料处于模拟解析/向量化状态`,
      tone: 'success' as const,
      path: '/admin-config?tab=knowledge',
    },
    { type: '首周反馈', desc: `${weeklyQuestions.filter((item) => !item.enabled).length} 个问题处于停用状态`, tone: 'blue' as const, path: '/admin-config?tab=weekly-feedback' },
    { type: 'D1 引导', desc: `${d1Items.filter((item) => item?.enabled === false).length} 个任务未启用`, tone: 'ai' as const, path: '/admin-config?tab=d1-guide' },
  ];

  const quickActions = [
    { label: '新增权限项', icon: Plus, path: '/admin-config?tab=role-packages' },
    { label: '新增岗位', icon: BriefcaseBusiness, path: '/admin-config?tab=role-packages&action=new-role' },
    { label: '设置 D1 引导', icon: ShieldCheck, path: '/admin-config?tab=d1-guide' },
    { label: '新增反馈问题', icon: ClipboardList, path: '/admin-config?tab=weekly-feedback' },
    { label: '上传知识库资料', icon: UploadCloud, path: '/admin-config?tab=knowledge' },
    { label: '查看反馈池', icon: MessageCircle, path: '/admin-config?tab=feedback-pool' },
  ];

  return (
    <div className="admin-workbench-panel">
      <div className="admin-page-title">
        <h1>后台配置维护台</h1>
        <p>运营配置中心，所有保存写入真实后端数据库。</p>
      </div>

      <div className="admin-metric-grid">
        <MetricCard label="岗位数" value={`${roles.length} 个`} hint="较昨日 0" tone="blue" />
        <MetricCard label="权限项数" value={`${permissions.length} 项`} hint={`启用 ${countEnabled(permissions)}`} tone="success" />
        <MetricCard label="知识库资料数" value={`${knowledgeDocs.length} 份`} hint={`命中 ${knowledgeDocs.reduce((sum, item) => sum + item.hitCount, 0)}`} tone="ai" />
        <MetricCard label="待处理匿名反馈数" value={`${pendingAnonymous} 条`} hint="进入反馈池处理" tone="warning" />
      </div>

      <div className="admin-overview-grid">
        <section className="admin-card">
          <h2>配置完整度</h2>
          <div className="admin-progress-list">
            {completenessRows.map((item) => (
              <button key={item.label} type="button" onClick={() => navigate(item.path)}>
                <span>{item.label}</span>
                <i>
                  <b style={{ width: formatCompleteness(item.done, item.total) }} />
                </i>
                <strong>{formatCompleteness(item.done, item.total)}</strong>
                <em>
                  {item.done}/{item.total}
                </em>
              </button>
            ))}
          </div>
        </section>

        <section className="admin-card">
          <h2>待处理事项</h2>
          <div className="admin-queue-list">
            {pendingItems.map((item) => (
              <button key={item.type} type="button" onClick={() => navigate(item.path)}>
                <StatusTag tone={item.tone}>{item.type}</StatusTag>
                <span>{item.desc}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="admin-overview-grid admin-overview-bottom">
        <section className="admin-card">
          <h2>最近变更记录</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>配置类型</th>
                <th>变更对象</th>
                <th>操作人</th>
                <th>更新时间</th>
                <th>变更内容摘要</th>
              </tr>
            </thead>
            <tbody>
              {recentChanges.map((item) => (
                <tr key={`${item.configType}-${item.objectName}`}>
                  <td>{item.configType}</td>
                  <td>{item.objectName}</td>
                  <td>{item.updatedBy || 'demo-admin'}</td>
                  <td>{item.updatedAt || '2026-06-23'}</td>
                  <td>{item.summary}</td>
                </tr>
              ))}
              {recentChanges.length === 0 && (
                <tr>
                  <td colSpan={5}>当前日期筛选下暂无变更记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-card">
          <h2>快捷操作</h2>
          <div className="admin-quick-grid">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.label} type="button" onClick={() => navigate(item.path)}>
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="admin-info-strip">
        <BookOpen size={17} />
        所有配置将影响新人端和复盘端展示，请确认信息准确后保存。
      </div>
    </div>
  );
}
