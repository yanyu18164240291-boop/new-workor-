import { CalendarDays, ChevronDown, RefreshCw, Search } from 'lucide-react';

import type { DashboardData } from '../../dashboardData.ts';
import { type AdminConfigFilters } from '../../types/adminConfig.ts';

type AdminTopbarProps = {
  filters: AdminConfigFilters;
  onFiltersChange: (filters: AdminConfigFilters) => void;
  reload: () => Promise<void>;
  data: DashboardData;
};

const organizationOptions = [
  '全部组织',
  '海底捞国际控股有限公司-集团总部-中台业务-技术管理中心-信息技术部-运维与网安组-安全与合规组',
  '协同办公部门',
];

export function AdminTopbar({ filters, onFiltersChange, reload, data }: AdminTopbarProps) {
  function updateFilter(key: keyof AdminConfigFilters, value: string) {
    onFiltersChange({ ...filters, [key]: value });
  }
  const adminName = data.authSession?.user?.name ?? 'demo-admin';
  const adminRole = data.authSession?.user?.jobTitle ?? '后台管理员';
  const avatarText = adminName.slice(0, 1).toUpperCase();

  return (
    <header className="admin-workbench-topbar">
      <label className="admin-workbench-search">
        <Search size={16} />
        <input
          aria-label="搜索岗位、权限、文档、反馈"
          placeholder="搜索岗位、权限、文档、反馈..."
          value={filters.keyword}
          onChange={(event) => updateFilter('keyword', event.target.value)}
        />
      </label>

      <div className="admin-workbench-filters">
        <label className="admin-workbench-select-filter">
          组织：
          <select className="admin-workbench-compact-select" value={filters.organization} onChange={(event) => updateFilter('organization', event.target.value)}>
            {organizationOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <label className="admin-workbench-select-filter">
          状态：
          <select className="admin-workbench-compact-select" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option>全部状态</option>
            <option>启用</option>
            <option>停用</option>
            <option>待处理</option>
            <option>处理中</option>
          </select>
          <ChevronDown size={14} />
        </label>
        <label className="admin-workbench-date-filter">
          <CalendarDays size={15} />
          <input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} aria-label="日期：2026-06-23" />
        </label>
      </div>

      <div className="admin-workbench-user">
        <span>{avatarText}</span>
        <div>
          <strong>{adminName}</strong>
          <small>{adminRole}</small>
        </div>
        <ChevronDown size={14} />
      </div>

      <button className="admin-workbench-refresh" type="button" onClick={() => void reload()}>
        <RefreshCw size={16} />
        刷新数据
      </button>
    </header>
  );
}
