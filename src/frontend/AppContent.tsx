import type { ReactNode } from 'react';

import { canAccessAdminConfig } from './auth.ts';
import type { DashboardData } from './dashboardData.ts';
import { AdminConfigPage } from './pages/AdminConfig/AdminConfigPage.tsx';
import {
  FollowUpPage,
  HomePage,
  PermissionDetailPage,
  PermissionPage,
} from './pages/newcomerPages.tsx';

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
    const currentUser = data.authSession?.user;
    const adminUser = currentUser
      ? {
          name: currentUser.name,
          role: currentUser.jobTitle ?? '后台管理员',
          departmentName: currentUser.departmentName,
          jobTitle: currentUser.jobTitle,
          canAccessAdminConfig: currentUser.canAccessAdminConfig,
        }
      : { name: 'demo-admin', role: '后台管理员' };
    if (canAccessAdminConfig(adminUser)) return children;
    return (
      <div className="admin-workbench-panel">
        <section className="admin-card admin-access-denied">
          <h1>无权访问后台配置</h1>
          <p>当前账号不具备后台管理员角色，已阻止进入 Page 08 后台配置维护台。</p>
          {currentUser && (
            <div className="admin-access-details">
              <p>当前账号：{currentUser.name}</p>
              {currentUser.email && <p>email：{currentUser.email}</p>}
              <p>openId：{currentUser.openId}</p>
              {currentUser.userId && <p>userId：{currentUser.userId}</p>}
              {currentUser.departmentName && <p>部门：{currentUser.departmentName}</p>}
              {currentUser.jobTitle && <p>职务：{currentUser.jobTitle}</p>}
            </div>
          )}
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
    case '03':
      return <PermissionPage data={data} navigate={navigate} openModal={openApplyModal} onRoleChange={selectPreviewRole} />;
    case '04':
      return <PermissionDetailPage data={data} params={params} navigate={navigate} toast={toast} reload={reload} />;
    case '05':
      return <FollowUpPage toast={toast} openOwner={openOwnerModal} />;
    case '08':
      return renderAdminGuard(<AdminConfigPage data={data} search={search} toast={toast} reload={reload} navigate={navigate} />);
    default:
      return null;
  }
}
