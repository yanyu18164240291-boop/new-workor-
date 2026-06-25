import { useEffect, useMemo, useState } from 'react';

import { api, type WeeklyFeedbackConfig } from './api.ts';
import {
  ActionButton,
  AppHeader,
  BottomNav,
  Card,
  DataRow,
  LoadingState,
  Modal,
  PageBoard,
  PhoneFrame,
  PrototypePage,
  SectionCard,
  StatGrid,
  StatusBar,
  StatusChip,
  StepList,
} from './components.tsx';
import type { DashboardData } from './dashboardData.ts';
import {
  filterSelectablePermissions,
} from './permissionSelection.ts';
import {
  AnonymousFeedbackPage,
  ApplyModal,
  D1Page,
  FollowUpPage,
  HomePage,
  PermissionDetailPage,
  PermissionPage,
  WeeklyFeedbackPage,
} from './pages/newcomerPages.tsx';
import { DEMO_NEWCOMER_ID, DEMO_SECONDARY_NEWCOMER_ID, DEMO_WEEKLY_FEEDBACK_ID } from './demoConfig.ts';
import { getBottomNavItems, getShellKind, matchRoute } from './routes.ts';

function usePathname() {
  const [location, setLocation] = useState(`${window.location.pathname}${window.location.search}`);

  useEffect(() => {
    const onPop = () => setLocation(`${window.location.pathname}${window.location.search}`);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setLocation(`${window.location.pathname}${window.location.search}`);
  };

  return { pathname: location.split('?')[0], search: location.includes('?') ? location.split('?')[1] : '', navigate };
}

function useDashboardData() {
  const [data, setData] = useState<DashboardData>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  async function load() {
    try {
      setStatus('loading');
      const newcomer = await api.getNewcomer(DEMO_NEWCOMER_ID);
      const [permissionPackage, progress, followUps, d1GuideConfig, admin, knowledgeDocs, metrics, weeklyConfig, weeklyAnalysis, anonymousConfig, weekly, anonymous] = await Promise.all([
        api.getPermissionPackage(newcomer.roleId),
        api.getPermissionProgress(newcomer.id),
        api.getFollowUpTasks(newcomer.id),
        api.getD1GuideConfig(),
        api.getAdminConfig(),
        api.getKnowledgeDocs(),
        api.getReviewMetrics(),
        api.getWeeklyFeedbackConfig(),
        api.getWeeklyFeedbackAnalysis(),
        api.getAnonymousFeedbackConfig(),
        api.getWeeklyFeedback(newcomer.id),
        api.getAnonymousFeedbacks(),
      ]);
      setData({
        newcomer,
        package: permissionPackage,
        progress,
        followUps,
        d1GuideConfig,
        admin,
        knowledgeDocs,
        metrics,
        weeklyConfig,
        weeklyAnalysis,
        anonymousConfig,
        weekly,
        anonymous,
      });
      setStatus('ready');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '后端数据加载失败');
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { data, status, error, reload: load };
}

function AdminPage({ data, search, toast, reload }: { data: DashboardData; search: string; toast: (message: string) => void; reload: () => Promise<void> }) {
  const showFeedback = search.includes('feedback');
  const showKnowledge = search.includes('knowledge');
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyFeedbackConfig>({ questions: [] });

  useEffect(() => {
    setWeeklyDraft(data.weeklyConfig ?? { questions: [] });
  }, [data.weeklyConfig]);

  function updateWeeklyQuestion(questionId: string, title: string) {
    setWeeklyDraft((current) => ({
      questions: current.questions.map((question) => (question.id === questionId ? { ...question, title } : question)),
    }));
  }

  function updateWeeklyOption(questionId: string, optionId: string, label: string) {
    setWeeklyDraft((current) => ({
      questions: current.questions.map((question) =>
        question.id === questionId
          ? { ...question, options: question.options.map((option) => (option.id === optionId ? { ...option, label } : option)) }
          : question,
      ),
    }));
  }

  async function saveWeeklyConfig() {
    await api.updateWeeklyFeedbackConfig(
      weeklyDraft.questions.map((question) => ({
        id: question.id,
        title: question.title,
        options: question.options.map((option) => ({ id: option.id, label: option.label })),
      })),
    );
    toast('已保存首周反馈配置');
    await reload();
  }

  async function createKnowledgeDocFromAdmin() {
    await api.createKnowledgeDoc({
      title: `后台上传演示资料 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
      category: '入职流程',
      applicableRole: data.package?.role.name ?? '协同办公产品实习生',
      applicableStage: 'D1-D7',
      sourceUrl: 'mock-drive://admin-upload',
      ownerName: '内容 Owner',
    });
    toast('已保存知识库资料元数据，解析和向量化仍为模拟状态');
    await reload();
  }

  return (
    <>
      <SectionCard title="共性流程固定，个性内容配置">
        <p>岗位权限包、权限申请路由、知识库与反馈池均从真实后端读取；上传/解析/向量化仍为模拟状态。</p>
        <div className="tab-switcher">
          <span className={!showFeedback && !showKnowledge ? 'selected' : ''}>权限配置</span>
          <span className={showKnowledge ? 'selected' : ''}>知识库</span>
          <span className={showFeedback ? 'selected' : ''}>匿名反馈池</span>
        </div>
      </SectionCard>
      {!showFeedback && (
        <SectionCard title="配置入口">
          <StatGrid
            items={[
              { value: data.admin?.roles.length ?? 0, label: '岗位权限角色' },
              { value: data.admin?.permissionItems.length ?? 0, label: '权限申请路由' },
              { value: data.knowledgeDocs?.length ?? 0, label: '知识库文档' },
            ]}
          />
          {(data.package?.requiredPermissions ?? []).map((item) => (
            <DataRow key={item.id} title={item.name} desc={`Owner：${item.ownerName} · ${item.applyUrl}`} chip="必开" tone="blue" />
          ))}
        </SectionCard>
      )}
      {!showFeedback && !showKnowledge && (
        <SectionCard title="新人首周反馈配置">
          <div className="admin-config-form">
            {weeklyDraft.questions.map((question) => (
              <div className="admin-question-editor" key={question.id}>
                <div className="config-row-head">
                  <span>{question.inputType === 'single' ? '单选' : question.inputType === 'multi' ? '多选' : '文本'}</span>
                  <input value={question.title} onChange={(event) => updateWeeklyQuestion(question.id, event.target.value)} />
                </div>
                {question.inputType !== 'text' && (
                  <div className="config-option-grid">
                    {question.options.map((option) => (
                      <input key={option.id} value={option.label} onChange={(event) => updateWeeklyOption(question.id, option.id, event.target.value)} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p>题目与选项来自数据库配置，后台配置接口更新后，新人端会同步展示最新问题。</p>
          <ActionButton onClick={saveWeeklyConfig}>保存首周反馈配置</ActionButton>
        </SectionCard>
      )}
      {!showFeedback && !showKnowledge && (
        <SectionCard title="匿名反馈联动配置">
          {(data.anonymousConfig?.modules ?? []).map((module) => (
            <DataRow
              key={module.moduleKey}
              title={module.label}
              desc={`问题类型：${module.problemTypes.map((item) => item.label).join('、')} · 处理动作：${module.expectedActions
                .map((item) => item.label)
                .join('、')}`}
              chip="三级联动"
              tone="ai"
            />
          ))}
          <p>新人端的模块、问题类型和希望处理动作均从数据库配置读取；提交后同时保存中文展示值与结构化 key。</p>
        </SectionCard>
      )}
      {showKnowledge && (
        <SectionCard title="知识库上传窗口">
          {(data.knowledgeDocs ?? []).map((doc) => (
            <DataRow key={doc.id} title={doc.title} desc={`${doc.category} · ${doc.ownerName} · 命中 ${doc.hitCount}`} chip={doc.vectorStatus} tone={doc.vectorStatus.includes('已') ? 'success' : 'warning'} />
          ))}
          <ActionButton
            onClick={createKnowledgeDocFromAdmin}
          >
            上传知识库资料
          </ActionButton>
        </SectionCard>
      )}
      {showFeedback && (
        <>
          <SectionCard title="新人首周反馈分析">
            <StatGrid
              items={[
                { value: data.weeklyAnalysis?.submissionCount ?? 0, label: '提交人数' },
                { value: data.weeklyAnalysis?.questions.length ?? 0, label: '分析题目' },
                { value: data.weeklyConfig?.questions.length ?? 0, label: '配置题目' },
              ]}
            />
            {(data.weeklyAnalysis?.questions ?? [])
              .filter((question) => question.inputType !== 'text')
              .map((question) => (
                <DataRow
                  key={question.questionKey}
                  title={question.title}
                  desc={question.options.map((option) => `${option.label} ${option.count}`).join(' · ')}
                  chip="选项分布"
                  tone="blue"
                />
              ))}
          </SectionCard>
          <SectionCard title="后台匿名反馈池">
            {(data.anonymous ?? []).map((item) => (
              <DataRow key={item.id} title={item.type} desc={`${item.module} · ${item.description}`} chip={item.status} tone="warning" />
            ))}
          </SectionCard>
        </>
      )}
    </>
  );
}

function ReviewPage({ data, navigate }: { data: DashboardData; navigate: (path: string) => void }) {
  const funnel = ['收到 Bot 入口', '打开新人首页', '查看 D1 引导', '查看岗位权限包', '发起一键权限申请', '点击我已提交'];
  return (
    <>
      <SectionCard title="本期核心指标">
        <StatGrid
          items={[
            { value: 3, label: '试点新人' },
            { value: '100%', label: '入口触达率' },
            { value: data.metrics?.anonymousFeedbackCount ?? 0, label: '匿名反馈' },
            { value: '2/3', label: '首周反馈' },
          ]}
        />
      </SectionCard>
      <SectionCard title="新人主流程漏斗">
        <div className="bar-list">
          {funnel.map((item, index) => (
            <div key={item}>
              <span>{item}</span>
              <i style={{ width: `${100 - index * 8}%` }} />
              <em>{index < 4 ? '100%' : '67%'}</em>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="未完成 / 匿名反馈类型">
        <div className="mini-bars">
          <span>审批等待</span>
          <span>不知道 Owner</span>
          <span>入口不清</span>
          <span>申请理由不会写</span>
        </div>
      </SectionCard>
      <SectionCard title="下轮内容补齐清单">
        <DataRow title="ChatGPT 账号申请路径说明不够清晰" chip="知识库" tone="ai" />
        <DataRow title="QoderWork Owner 路径需要补充" chip="权限" tone="warning" />
        <ActionButton tone="secondary" onClick={() => navigate('/admin-config?tab=knowledge')}>
          去后台补齐知识库
        </ActionButton>
      </SectionCard>
    </>
  );
}

function ManagerPage({ data, navigate, toast }: { data: DashboardData; navigate: (path: string) => void; toast: (message: string) => void }) {
  return (
    <>
      <SectionCard title="今日新员工 2 人" action={<StatusChip tone="success">需关注</StatusChip>}>
        <StatGrid
          items={[
            { value: 2, label: '产品实习生' },
            { value: 0, label: '高风险' },
            { value: 1, label: '待跟进' },
          ]}
        />
      </SectionCard>
      <SectionCard title="今日到岗名单" action={<button className="text-button">点击查看详情</button>}>
        <DataRow title="燕余" desc="协同办公产品实习生 · D7 · 刘长省" chip="首周反馈需查看" tone="success" onClick={() => navigate(`/manager/newcomer/${DEMO_NEWCOMER_ID}`)} />
        <DataRow title="崔令飞" desc="协同办公产品实习生 · D1 · 刘长省" chip="权限待跟进" tone="warning" onClick={() => navigate(`/manager/newcomer/${DEMO_SECONDARY_NEWCOMER_ID}`)} />
      </SectionCard>
      <SectionCard title="今日管理动作">
        <p>1. 查看 ChatGPT 账号权限卡点，确认是否需要导师跟进。</p>
        <p>2. 查看新人首周反馈，输出支持动作。</p>
        <ActionButton
          tone="secondary"
          onClick={() => {
            toast('已模拟提醒导师跟进');
          }}
        >
          提醒导师跟进
        </ActionButton>
      </SectionCard>
    </>
  );
}

function ManagerDetailPage({ data, navigate, toast }: { data: DashboardData; navigate: (path: string) => void; toast: (message: string) => void }) {
  return (
    <>
      <Card className="newcomer-card">
        <div className="avatar-block">燕</div>
        <div>
          <h2>燕余</h2>
          <p>协同办公产品实习生 · D7 · 首周中</p>
        </div>
        <StatusChip tone="success">跟进中</StatusChip>
      </Card>
      <StatGrid
        items={[
          { value: 5, label: '已完成事项' },
          { value: 2, label: '待跟进权限' },
          { value: 1, label: '需支持事项' },
        ]}
      />
      <SectionCard title="新人首周工作摘要">
        <StepList
          steps={[
            { no: 'D1', title: '09:30 完成 D1 到达包', desc: '加入群、查看指南、查看权限包', status: '已完成' },
            { no: 'D1', title: '10:45 查看岗位权限包', desc: 'OA / Mail / ChatGPT / QoderWork', status: '已完成' },
            { no: 'D3', title: '19:30 提交 OA 权限进度', desc: '进入 4 小时回访', status: '待回访' },
          ]}
        />
      </SectionCard>
      <SectionCard title="本周完成情况">
        <DataRow title="邮箱 / OA 权限" desc="已提交，等待开通或回访" chip="待跟进" tone="warning" />
        <DataRow title="ChatGPT 账号" desc="已申请并登记回访" chip="待回访" tone="warning" />
        <DataRow title="QoderWork 账号" desc="已完成申请" chip="已完成" tone="success" />
      </SectionCard>
      <SectionCard title="新人写给管理者">
        <p>{data.weekly?.message ?? '新人暂未提交首周反馈'}</p>
        <div className="dual-actions">
          <ActionButton onClick={() => navigate(`/manager/feedback/${DEMO_WEEKLY_FEEDBACK_ID}`)}>查看完整反馈</ActionButton>
          <ActionButton
            tone="secondary"
            onClick={() => {
              toast('已模拟提醒 +1 跟进');
            }}
          >
            提醒 +1
          </ActionButton>
        </div>
      </SectionCard>
      <Card className="notice-card">管理者视角只做入职支持和卡点跟进，不展示匿名反馈原文、聊天记录、绩效评价或能力评分。</Card>
    </>
  );
}

function ManagerFeedbackPage({ data, reload, toast }: { data: DashboardData; reload: () => Promise<void>; toast: (message: string) => void }) {
  async function record(status: string, note: string) {
    if (!data.weekly) return;
    await api.updateManagerFeedbackAction(data.weekly.id, status, note);
    toast(status === 'arranged_talk' ? '已记录安排沟通动作' : '已记录查看');
    await reload();
  }
  return (
    <>
      <Card className="newcomer-card">
        <div className="avatar-block">燕</div>
        <div>
          <h2>新人首周反馈</h2>
          <p>由入职者填写，供管理者查看与跟进</p>
        </div>
        <StatusChip tone="success">已提交反馈</StatusChip>
      </Card>
      {data.weekly ? (
        <>
          <SectionCard title="首周整体感受">
            <StatusChip tone="success">{data.weekly.overallFeeling}</StatusChip>
          </SectionCard>
          <SectionCard title="目前主要卡点">
            <p>{data.weekly.blockers}</p>
          </SectionCard>
          <SectionCard title="希望管理者提供的支持">
            <div className="tag-row selected-first">
              {data.weekly.supportNeeded.split('、').map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="新人想说的话">
            <p>{data.weekly.message}</p>
          </SectionCard>
        </>
      ) : (
        <Card className="quiet-card">新人暂未提交首周反馈，可在 D7 前提醒新人填写。</Card>
      )}
      <Card className="notice-card">首周反馈不用于绩效评价。管理者只能查看和跟进，不允许修改新人原文。</Card>
      <div className="fixed-actions">
        <ActionButton onClick={() => record('arranged_talk', '已安排本周沟通')}>安排沟通</ActionButton>
        <ActionButton tone="secondary" onClick={() => record('viewed', '已查看')}>
          记录已查看
        </ActionButton>
      </div>
    </>
  );
}

function AppContent({
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
      return <ReviewPage data={data} navigate={navigate} />;
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
