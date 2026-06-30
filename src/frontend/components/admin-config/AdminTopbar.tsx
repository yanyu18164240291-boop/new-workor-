import { CalendarDays, ChevronDown, RefreshCw, Search } from 'lucide-react';

import { currentAdminUser, type AdminConfigFilters } from '../../types/adminConfig.ts';

type AdminTopbarProps = {
  filters: AdminConfigFilters;
  onFiltersChange: (filters: AdminConfigFilters) => void;
  reload: () => Promise<void>;
};

export function AdminTopbar({ filters, onFiltersChange, reload }: AdminTopbarProps) {
  function updateFilter(key: keyof AdminConfigFilters, value: string) {
    onFiltersChange({ ...filters, [key]: value });
  }

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
        <label>
          组织：
          <select value={filters.organization} onChange={(event) => updateFilter('organization', event.target.value)}>
            <option>全部组织</option>
            <option>协同办公部门</option>
          </select>
          <ChevronDown size={14} />
        </label>
        <label>
          状态：
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option>全部状态</option>
            <option>启用</option>
            <option>停用</option>
            <option>待处理</option>
            <option>处理中</option>
          </select>
          <ChevronDown size={14} />
        </label>
        <label>
          <CalendarDays size={15} />
          <input type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} aria-label="日期：2026-06-23" />
        </label>
      </div>

      <div className="admin-workbench-user">
        <span>D</span>
        <div>
          <strong>demo-admin</strong>
          <small>{currentAdminUser.role}</small>
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
