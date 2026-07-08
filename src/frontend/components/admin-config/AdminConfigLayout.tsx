import type { ReactNode } from 'react';

import type { DashboardData } from '../../dashboardData.ts';
import { type AdminConfigFilters, type AdminConfigTabId } from '../../types/adminConfig.ts';
import { AdminSidebar } from './AdminSidebar.tsx';
import { AdminTopbar } from './AdminTopbar.tsx';

type AdminConfigLayoutProps = {
  activeTab: AdminConfigTabId;
  filters: AdminConfigFilters;
  onFiltersChange: (filters: AdminConfigFilters) => void;
  navigate: (path: string) => void;
  reload: () => Promise<void>;
  data: DashboardData;
  children: ReactNode;
};

export function AdminConfigLayout({ activeTab, filters, onFiltersChange, navigate, reload, data, children }: AdminConfigLayoutProps) {
  return (
    <div className="admin-workbench">
      <AdminSidebar activeTab={activeTab} navigate={navigate} />
      <main className="admin-workbench-main">
        <AdminTopbar filters={filters} onFiltersChange={onFiltersChange} reload={reload} data={data} />
        <section className="admin-workbench-content">{children}</section>
      </main>
    </div>
  );
}
