import { useState } from 'react';

import { AdminConfigLayout } from '../../components/admin-config/AdminConfigLayout.tsx';
import type { DashboardData } from '../../dashboardData.ts';
import {
  adminConfigTabs,
  defaultAdminConfigFilters,
  resolveAdminConfigTab,
  type AdminConfigFilters,
  type AdminConfigTabId,
} from '../../types/adminConfig.ts';

type AdminConfigPageProps = {
  data: DashboardData;
  search: string;
  toast: (message: string) => void;
  reload: () => Promise<void>;
  navigate: (path: string) => void;
};

function PlaceholderTab({ activeTab, data, toast }: { activeTab: AdminConfigTabId; data: DashboardData; toast: (message: string) => void }) {
  const tab = adminConfigTabs.find((item) => item.id === activeTab);
  const roleCount = data.admin?.roles.length ?? 0;
  const permissionCount = data.admin?.permissionItems.length ?? 0;

  return (
    <div className="admin-workbench-panel">
      <div className="admin-page-title">
        <span>Page 08</span>
        <h1>{tab?.label ?? '配置总览'}</h1>
        <p>后台配置维护台正在按桌面工作台拆分为低耦合模块，所有保存动作将走 service 层和真实后端。</p>
      </div>
      <div className="admin-placeholder-card">
        <strong>当前配置基线</strong>
        <p>
          已加载 {roleCount} 个岗位、{permissionCount} 个权限项。后续任务会把该占位模块替换为表格、右侧抽屉和弹窗上传。
        </p>
        <button type="button" onClick={() => toast('已保存配置')}>
          保存配置
        </button>
      </div>
    </div>
  );
}

export function AdminConfigPage({ data, search, toast, reload, navigate }: AdminConfigPageProps) {
  const activeTab = resolveAdminConfigTab(search);
  const [filters, setFilters] = useState<AdminConfigFilters>(defaultAdminConfigFilters);

  return (
    <AdminConfigLayout activeTab={activeTab} filters={filters} onFiltersChange={setFilters} navigate={navigate} reload={reload}>
      <PlaceholderTab activeTab={activeTab} data={data} toast={toast} />
    </AdminConfigLayout>
  );
}
