import type { ReactNode } from 'react';

import { canAccessAdminConfig } from './auth.ts';
import type { DashboardData } from './dashboardData.ts';
import { AdminConfigPage } from './pages/AdminConfig/AdminConfigPage.tsx';
import { ReviewPage } from './pages/ReviewPage.tsx';
import { ManagerDetailPage, ManagerFeedbackPage, ManagerPage } from './pages/managerPages.tsx';
import {
  AnonymousFeedbackPage,
  D1Page,
  FollowUpPage,
  HomePage,
  PermissionDetailPage,
  PermissionPage,
  WeeklyFeedbackPage,
} from './pages/newcomerPages.tsx';
import { currentAdminUser } from './types/adminConfig.ts';

export function AppContent({
  pageNo,
  data,
  params,
  search,
  navigate,
  toast,
  reload,
  selectPreviewRole,
  openApplyModal,
  openOwnerModal,
}: {
  pageNo: string;
  data: DashboardData;
  params: Record<string, string>;
  search: string;
  navigate: (path: string) => void;
  toast: (message: string) => void;
  reload: () => Promise<void>;
  selectPreviewRole: (roleId: string) => Promise<void>;
  openApplyModal: (type: 'required' | 'optional') => void;
  openOwnerModal: () => void;
}) {
  function renderAdminGuard(children: ReactNode) {
    if (canAccessAdminConfig(currentAdminUser)) return children;
    return (
      <div className="admin-workbench-panel">
        <section className="admin-card admin-access-denied">
          <h1>无权访问后台配置</h1>
          <p>当前账号不具备后台管理员角色，已阻止进入 Page 08 后台配置维护台。</p>
          <button className="admin-primary-action" type="button" onClick={() => navigate('/')}>
            返回新人首页
          </button>
        </section>
      </div>
    );
  }

  switch (pageNo) {
    case '01':
      return <HomePage data={data} navigate={navigate} />;
    case '02':
      return <D1Page data={data} navigate={navigate} toast={toast} onRoleChange={selectPreviewRole} />;
    case '03':
      return <PermissionPage data={data} navigate={navigate} openModal={openApplyModal} onRoleChange={selectPreviewRole} />;
    case '04':
      return <PermissionDetailPage data={data} params={params} navigate={navigate} toast={toast} reload={reload} />;
    case '05':
      return <FollowUpPage navigate={navigate} toast={toast} openOwner={openOwnerModal} />;
    case '06':
      return <WeeklyFeedbackPage data={data} reload={reload} toast={toast} />;
    case '07':
      return <AnonymousFeedbackPage data={data} reload={reload} toast={toast} />;
    case '08':
      return renderAdminGuard(<AdminConfigPage data={data} search={search} toast={toast} reload={reload} navigate={navigate} />);
    case '09':
      return renderAdminGuard(<ReviewPage data={data} navigate={navigate} toast={toast} />);
    case '10':
      return <ManagerPage data={data} navigate={navigate} toast={toast} />;
    case '11':
      return <ManagerDetailPage data={data} navigate={navigate} toast={toast} />;
    case '12':
      return <ManagerFeedbackPage data={data} reload={reload} toast={toast} />;
    default:
      return null;
  }
}
