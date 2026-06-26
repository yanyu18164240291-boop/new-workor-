import type { DashboardData } from './dashboardData.ts';
import { AdminPage, ReviewPage } from './pages/adminPages.tsx';
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

export function AppContent({
  pageNo,
  data,
  params,
  search,
  navigate,
  toast,
  reload,
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
  openApplyModal: (type: 'required' | 'optional') => void;
  openOwnerModal: () => void;
}) {
  switch (pageNo) {
    case '01':
      return <HomePage data={data} navigate={navigate} />;
    case '02':
      return <D1Page data={data} navigate={navigate} toast={toast} />;
    case '03':
      return <PermissionPage data={data} navigate={navigate} openModal={openApplyModal} />;
    case '04':
      return <PermissionDetailPage data={data} params={params} navigate={navigate} toast={toast} reload={reload} />;
    case '05':
      return <FollowUpPage navigate={navigate} toast={toast} openOwner={openOwnerModal} />;
    case '06':
      return <WeeklyFeedbackPage data={data} reload={reload} toast={toast} />;
    case '07':
      return <AnonymousFeedbackPage data={data} reload={reload} toast={toast} />;
    case '08':
      return <AdminPage data={data} search={search} toast={toast} reload={reload} />;
    case '09':
      return <ReviewPage data={data} navigate={navigate} toast={toast} />;
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
