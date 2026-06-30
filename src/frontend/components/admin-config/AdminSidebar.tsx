import {
  Archive,
  BookOpen,
  BriefcaseBusiness,
  ClipboardList,
  MessageCircle,
  ShieldCheck,
  TableProperties,
} from 'lucide-react';

import { adminConfigTabs, type AdminConfigTabId } from '../../types/adminConfig.ts';

type AdminSidebarProps = {
  activeTab: AdminConfigTabId;
  navigate: (path: string) => void;
};

const icons = {
  overview: TableProperties,
  'role-packages': BriefcaseBusiness,
  'd1-guide': ShieldCheck,
  'weekly-feedback': ClipboardList,
  'anonymous-config': MessageCircle,
  knowledge: BookOpen,
  'feedback-pool': Archive,
} satisfies Record<AdminConfigTabId, typeof TableProperties>;

export function AdminSidebar({ activeTab, navigate }: AdminSidebarProps) {
  return (
    <aside className="admin-workbench-sidebar">
      <div className="admin-workbench-brand">
        <span>海</span>
        <div>
          <strong>海纳AI入职Bot</strong>
          <p>后台配置台</p>
        </div>
      </div>

      <nav className="admin-workbench-nav" aria-label="核心配置">
        <p>核心配置</p>
        {adminConfigTabs.map((tab) => {
          const Icon = icons[tab.id];
          return (
            <button key={tab.id} className={tab.id === activeTab ? 'active' : ''} type="button" onClick={() => navigate(tab.path)}>
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="admin-workbench-sidebar-footer">
        <small>
          © 2026 Haidilao
          <br />
          v1.0.0
        </small>
      </div>
    </aside>
  );
}
