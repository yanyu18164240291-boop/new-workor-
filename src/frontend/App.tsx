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
  StatusBar,
} from './components.tsx';
import {
  filterSelectablePermissions,
} from './permissionSelection.ts';
import { ApplyModal } from './pages/newcomerPages.tsx';
import { getBottomNavItems, getShellKind, matchRoute } from './routes.ts';

export function App() {
  const { pathname, search, navigate } = usePathname();
  const { route, params } = useMemo(() => matchRoute(pathname), [pathname]);
  const { data, status, error, reload } = useDashboardData();
  const [toastMessage, setToastMessage] = useState('');
  const [modal, setModal] = useState<'required' | 'optional' | 'owner' | null>(null);

  function toast(message: string) {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(''), 2200);
  }

  const subtitle = route.pageNo === '01' ? '你的入职好帮手' : route.purpose;
  const shellKind = getShellKind(route);
  const bottomNavItems = getBottomNavItems(route.pageNo);
  const selectableRequiredPermissions = filterSelectablePermissions(data.package?.requiredPermissions ?? [], data.progress ?? []);
  const selectableOptionalPermissions = filterSelectablePermissions(data.package?.optionalPermissions ?? [], data.progress ?? []);
  const content =
    status === 'ready' ? (
      <AppContent
        pageNo={route.pageNo}
        data={data}
        params={params}
        search={search}
        navigate={navigate}
        toast={toast}
        reload={reload}
        openApplyModal={setModal}
        openOwnerModal={() => setModal('owner')}
      />
    ) : null;

  const modalLayer = (
    <>
      {toastMessage && <div className="toast">{toastMessage}</div>}
      {modal === 'required' && (
        <ApplyModal
          title="必开权限：一键申请"
          items={selectableRequiredPermissions}
          note="H5 原型仅模拟提交到审批系统，不调用真实审批接口；确认后权限进入进行中，并生成 4 小时回访。"
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
          title="可选权限：一键申请"
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
          <DataRow title="刘长省" desc="协同办公权限Owner · H5 中仅展示模拟信息，不真实发消息。" chip="Owner" tone="blue" />
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

  if (shellKind === 'desktop') {
    return (
      <div className="admin-canvas">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <span>海</span>
            <div>
              <strong>海纳入职后台</strong>
              <p>配置维护 / 试点复盘</p>
            </div>
          </div>
          <nav className="admin-side-nav" aria-label="后台导航">
            {[
              ['权限配置', '/admin-config', '08'],
              ['知识库管理', '/admin-config?tab=knowledge', '08k'],
              ['匿名反馈池', '/admin-config?tab=feedback', '08f'],
              ['V1 试点复盘', '/review', '09'],
            ].map(([label, path, key]) => {
              const active =
                (key === '08' && route.pageNo === '08' && !search) ||
                (key === '08k' && route.pageNo === '08' && search.includes('knowledge')) ||
                (key === '08f' && route.pageNo === '08' && search.includes('feedback')) ||
                (key === '09' && route.pageNo === '09');
              return (
                <button key={key} className={active ? 'active' : ''} onClick={() => navigate(path)}>
                  {label}
                </button>
              );
            })}
          </nav>
        </aside>
        <main className="admin-main">
          <header className="admin-topbar">
            <div>
              <span>Page {route.pageNo}</span>
              <h1>{route.title}</h1>
              <p>{route.purpose}</p>
            </div>
            <button
              className="admin-primary"
              onClick={async () => {
                await reload();
                toast('已从后端刷新配置数据');
              }}
            >
              刷新后端数据
            </button>
          </header>
          <section className="admin-content">
            <LoadingState status={status} error={error} />
            {content}
          </section>
          {modalLayer}
        </main>
      </div>
    );
  }

  return (
    <div className="app-canvas">
      <div className="mobile-surface-layout">
        <PrototypePage route={route}>
          <PhoneFrame>
            <StatusBar time={route.pageNo === '05' ? '14:30' : route.pageNo === '06' ? '17:40' : route.pageNo === '07' ? '18:05' : '09:41'} />
            <AppHeader route={route} subtitle={subtitle} navigate={navigate} />
            <PageBoard>
              <LoadingState status={status} error={error} />
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
