import { useMemo, useState } from 'react';

import { api } from './api.ts';
import { AppContent } from './AppContent.tsx';
import { useDashboardData, usePathname } from './appState.ts';
import {
  ActionButton,
  AppHeader,
  BottomNav,
  DataRow,
  LoadingState,
  Modal,
  PageBoard,
  PhoneFrame,
  PrototypePage,
} from './components.tsx';
import {
  filterSelectablePermissions,
} from './permissionSelection.ts';
import { ApplyModal } from './pages/newcomerPages.tsx';
import { getBottomNavItems, matchRoute } from './routes.ts';

export function App() {
  const { pathname, search, navigate } = usePathname();
  const { route, params } = useMemo(() => matchRoute(pathname), [pathname]);
  const { data, status, error, reload, selectPreviewRole } = useDashboardData(route.pageNo, params);
  const [toastMessage, setToastMessage] = useState('');
  const [modal, setModal] = useState<'required' | 'optional' | 'owner' | null>(null);

  function toast(message: string) {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 2200);
  }

  const subtitle = route.pageNo === '01' ? '你的入职好帮手' : route.purpose;
  const bottomNavItems = getBottomNavItems(route.pageNo);
  const selectableRequiredPermissions = filterSelectablePermissions(data.package?.requiredPermissions ?? [], data.progress ?? []);
  const selectableOptionalPermissions = filterSelectablePermissions(data.package?.optionalPermissions ?? [], data.progress ?? []);
  const canRenderContent = status === 'ready' || Boolean(data.__staleWhileRevalidate);
  const content =
    canRenderContent ? (
      <AppContent
        pageNo={route.pageNo}
        data={data}
        params={params}
        search={search}
        navigate={navigate}
        toast={toast}
        reload={reload}
        selectPreviewRole={selectPreviewRole}
        openApplyModal={setModal}
        openOwnerModal={() => setModal('owner')}
      />
    ) : null;

  const modalLayer = (
    <>
      {toastMessage && <div className="toast">{toastMessage}</div>}
      {modal === 'required' && (
        <ApplyModal
          title="必开权限：批量登记"
          items={selectableRequiredPermissions}
          note="真实审批请进入权限详情页打开飞书审批入口；这里只登记你已在飞书提交的权限，并生成 4 小时回访。"
          onClose={() => setModal(null)}
          onConfirm={async (selectedIds) => {
            if (!data.newcomer) return;
            await api.syncPermissionApplications(
              data.newcomer.id,
              selectedIds,
              selectableRequiredPermissions.map((item) => item.id),
            );
            setModal(null);
            toast(selectedIds.length > 0 ? '已同步必开权限申请选择' : '已取消本次必开权限申请选择');
            await reload();
          }}
        />
      )}
      {modal === 'optional' && (
        <ApplyModal
          title="可选权限：批量登记"
          items={selectableOptionalPermissions}
          note="默认建议申请 ChatGPT 账号和 QoderWork 账号，BPM 系统需导师或权限 Owner 确认。"
          onClose={() => setModal(null)}
          onConfirm={async (selectedIds) => {
            if (!data.newcomer) return;
            await api.syncPermissionApplications(
              data.newcomer.id,
              selectedIds,
              selectableOptionalPermissions.map((item) => item.id),
            );
            setModal(null);
            toast(selectedIds.length > 0 ? '已同步可选权限申请选择' : '已取消本次可选权限申请选择');
            await reload();
          }}
        />
      )}
      {modal === 'owner' && (
        <Modal title="联系 Owner" onClose={() => setModal(null)}>
          <DataRow title="刘长省" desc="协同办公权限 Owner · 请在飞书中联系确认审批进度。" chip="Owner" tone="blue" />
          <ActionButton
            onClick={() => {
              setModal(null);
              toast('已展示 Owner 信息');
            }}
          >
            知道了
          </ActionButton>
        </Modal>
      )}
    </>
  );

  if (route.pageNo === '08') {
    return (
      <div className="admin-canvas admin-config-canvas">
        <LoadingState status={status} error={error} />
        {content}
        {modalLayer}
      </div>
    );
  }

  return (
    <div className="app-canvas">
      <div className="mobile-surface-layout">
        <PrototypePage route={route}>
          <PhoneFrame>
            <AppHeader
              route={route}
              subtitle={subtitle}
              navigate={navigate}
              onHomeSearch={() => window.dispatchEvent(new Event('haina-home-search'))}
              onHomeHistory={() => window.dispatchEvent(new Event('haina-home-history'))}
            />
            <PageBoard>
              <LoadingState status={canRenderContent ? 'ready' : status} error={error} />
              {content}
            </PageBoard>
            {bottomNavItems.length > 0 && <BottomNav currentPage={route.pageNo} navigate={navigate} />}
            {modalLayer}
          </PhoneFrame>
        </PrototypePage>
      </div>
    </div>
  );
}
