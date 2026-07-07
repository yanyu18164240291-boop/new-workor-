import { useEffect, useState } from 'react';

import { getAnonymousFeedbackFlow, toggleMultiChoice } from '../anonymousFeedbackModel.ts';
import { api, type PermissionItem, type WeeklyFeedbackQuestion } from '../api.ts';
import {
  ActionButton,
  Card,
  DataRow,
  IconTile,
  Modal,
  SectionCard,
  StatGrid,
  StatusChip,
  StepList,
} from '../components.tsx';
import type { DashboardData } from '../dashboardData.ts';
import { buildHomeBotReply, type HomeChatMessage } from '../homeChatModel.ts';
import { buildHomeProgressStats } from '../homeProgress.ts';
import { getHomeQuickQuestions, getHomeShortcutItems } from '../routes.ts';
import {
  createInitialApplySelection,
  mapPermissionUiStatus,
  toggleApplySelection,
} from '../permissionSelection.ts';
import { findMissingWeeklyRequiredQuestion } from '../weeklyFeedbackFormModel.ts';

const weeklyRequiredStarQuestionKeys = new Set(['overall_feeling', 'message', 'work_summary']);

function formatHomeTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function RolePreviewSelect({
  data,
  onRoleChange,
  variant = 'card',
}: {
  data: DashboardData;
  onRoleChange?: (roleId: string) => Promise<void>;
  variant?: 'card' | 'inline';
}) {
  const [switching, setSwitching] = useState(false);
  const roles = data.roles ?? [];
  const selectedRoleId = data.selectedRoleId ?? data.package?.role.id ?? data.newcomer?.roleId ?? '';
  const selectedRoleName = data.package?.role.name ?? roles.find((role) => role.id === selectedRoleId)?.name ?? '协同办公产品实习生';

  async function handleChange(roleId: string) {
    if (!roleId || roleId === selectedRoleId || !onRoleChange) return;
    try {
      setSwitching(true);
      await onRoleChange(roleId);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className={`role-preview-select role-preview-select-${variant}`}>
      <span>当前位置</span>
      {roles.length > 0 ? (
        <select value={selectedRoleId} disabled={switching} onChange={(event) => void handleChange(event.target.value)}>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      ) : (
        <strong>{selectedRoleName}</strong>
      )}
      {switching && <small>正在切换</small>}
    </div>
  );
}

export function HomePage({ data, navigate }: { data: DashboardData; navigate: (path: string) => void }) {
  const stats = buildHomeProgressStats({
    permissions: [...(data.package?.requiredPermissions ?? []), ...(data.package?.optionalPermissions ?? [])],
    progress: data.progress ?? [],
    followUps: data.followUps ?? [],
    newcomer: data.newcomer,
  });
  const progressByPermission = new Map((data.progress ?? []).map((item) => [item.permissionItemId, item]));
  const progressItems = [...(data.package?.requiredPermissions ?? []), ...(data.package?.optionalPermissions ?? [])].slice(0, 4);
  const [answer, setAnswer] = useState('');
  const [homeChatMessages, setHomeChatMessages] = useState<HomeChatMessage[]>([]);
  const [isHomeChatActive, setIsHomeChatActive] = useState(false);
  const [progressCollapsed, setProgressCollapsed] = useState(true);
  const [activeHomePanel, setActiveHomePanel] = useState<'search' | 'history' | null>(null);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [dismissedHomeSearchRecordIds, setDismissedHomeSearchRecordIds] = useState<string[]>([]);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const homeOpeningMessage: HomeChatMessage = {
    id: 'home-opening-message',
    role: 'bot',
    text: '你好呀！我是海纳AI入职Bot 👋 我会陪你完成入职第一周：先知道今天做什么，再处理岗位权限，提交后我会在 4 个工作小时内回访。',
  };
  const visibleHomeChatMessages = isHomeChatActive ? [homeOpeningMessage, ...homeChatMessages] : homeChatMessages;
  const searchableMessages = [homeOpeningMessage, ...homeChatMessages];
  const homeSearchResults = searchableMessages.filter((message) => {
    const query = homeSearchQuery.trim().toLowerCase();
    return !query || message.text.toLowerCase().includes(query);
  });
  const homeHistoryItems = [
    {
      id: 'current',
      title: homeChatMessages.length > 0 ? '当前对话' : '当前对话（待开始）',
      time: '刚刚',
      messages: searchableMessages,
    },
    {
      id: 'chatgpt-account',
      title: 'ChatGPT账号申请方式',
      time: '今天 09:35',
      messages: [
        { id: 'history-chatgpt-user', role: 'user', text: 'ChatGPT账号怎么申请？' },
        { id: 'history-chatgpt-bot', role: 'bot', text: '从首页进入“权限申请”，打开 ChatGPT 账号详情，复制申请理由后提交审批。' },
      ] as HomeChatMessage[],
    },
    {
      id: 'oa-login',
      title: 'OA系统登录问题',
      time: '昨天 17:20',
      messages: [
        { id: 'history-oa-user', role: 'user', text: 'OA系统怎么登录？' },
        { id: 'history-oa-bot', role: 'bot', text: '先完成 D1 引导和部门群加入，再按权限包里的入口登录；失败时联系权限 Owner。' },
      ] as HomeChatMessage[],
    },
  ];
  const homeShortcutItems = getHomeShortcutItems();
  const homeSearchRecordItems = homeHistoryItems.filter((item) => item.id !== 'current');
  const visibleHomeSearchRecords = (homeSearchQuery ? homeSearchResults : homeSearchRecordItems).filter(
    (item) => !dismissedHomeSearchRecordIds.includes(item.id),
  );
  const homeAttachActions = [
    { key: 'image', label: '图片', icon: 'image', tone: 'blue' },
    { key: 'camera', label: '拍照', icon: 'camera', tone: 'default' },
    { key: 'file', label: '文件', icon: 'paperclip', tone: 'warning' },
    { key: 'doc', label: '云文档', icon: 'file', tone: 'ai' },
  ] as const;

  useEffect(() => {
    const openSearch = () => {
      setIsHomeChatActive(true);
      setActiveHomePanel('search');
      setShowAttachSheet(false);
    };
    const openHistory = () => {
      setIsHomeChatActive(true);
      setActiveHomePanel('history');
      setShowAttachSheet(false);
    };
    window.addEventListener('haina-home-search', openSearch);
    window.addEventListener('haina-home-history', openHistory);
    return () => {
      window.removeEventListener('haina-home-search', openSearch);
      window.removeEventListener('haina-home-history', openHistory);
    };
  }, []);

  function handleSendHomeChat() {
    const question = answer.trim();
    const reply = buildHomeBotReply(question);
    if (!question || !reply) return;

    setIsHomeChatActive(true);
    setHomeChatMessages((messages) => [
      ...messages.slice(-6),
      { id: `${Date.now()}-user`, role: 'user', text: question },
      { id: `${Date.now()}-bot`, role: 'bot', text: reply },
    ]);
    setAnswer('');
  }

  function handleOpenAttachmentSheet() {
    setIsHomeChatActive(true);
    setActiveHomePanel(null);
    setShowAttachSheet((value) => !value);
  }

  return (
    <>
      {activeHomePanel === 'search' && (
        <div className="home-search-screen">
          <div className="home-search-shell">
            <label>
              <IconTile icon="search" tone="default" />
              <input
                autoFocus
                value={homeSearchQuery}
                placeholder="搜索消息、智能体"
                onChange={(event) => setHomeSearchQuery(event.target.value)}
              />
            </label>
            <button type="button" onClick={() => setActiveHomePanel(null)}>取消</button>
          </div>
          <div className="home-search-records">
            {visibleHomeSearchRecords.map((item) => (
              <div className="home-search-record-row" key={item.id}>
                <button className="home-search-record-main" type="button" onClick={() => {
                  setHomeSearchQuery('messages' in item ? item.messages[0]?.text ?? item.title : item.text);
                }}>
                  <span className="home-search-history-icon" aria-hidden="true" />
                  <strong>{'title' in item ? item.title : item.text}</strong>
                </button>
                <button
                  aria-label="删除历史搜索"
                  className="home-search-record-remove"
                  type="button"
                  onClick={() => setDismissedHomeSearchRecordIds((ids) => [...ids, item.id])}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeHomePanel === 'history' && (
        <div className="home-side-panel">
          <div className="home-side-profile">
            <span>{data.newcomer?.name?.slice(0, 1) ?? '海'}</span>
            <div>
              <strong>{data.newcomer?.name ?? 'Yan.'}</strong>
              <p>入职助手 · 设置</p>
            </div>
            <button type="button" onClick={() => setActiveHomePanel(null)}>关闭</button>
          </div>
          <div className="home-side-shortcuts">
            {homeShortcutItems.map((item) => (
              <button type="button" key={item.path} onClick={() => {
                setActiveHomePanel(null);
                navigate(item.path);
              }}>
                <IconTile icon={item.icon} tone={item.tone} />
                <strong>{item.label}</strong>
              </button>
            ))}
          </div>
          <div className="home-side-records">
            <div className="home-side-record-title">
              <strong>对话记录</strong>
              <span>最近30天</span>
            </div>
            {homeHistoryItems.map((item) => (
              <button type="button" key={item.id} onClick={() => setActiveHomePanel(null)}>
                <strong className="home-side-record-main">{item.title}</strong>
                <span className="home-side-record-meta">{item.time}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={`home-content-pad${isHomeChatActive ? ' home-content-pad-chatting' : ''}`}>
        {!isHomeChatActive && (
          <div className="home-bot-row">
            <IconTile icon="bot" tone="blue" />
            <Card className="bot-bubble-card">
              <h2>你好呀！我是海纳AI入职Bot 👋</h2>
              <p>我会陪你完成入职第一周：先知道今天做什么，再处理岗位权限，提交后我会在 4 个工作小时内回访。</p>
            </Card>
          </div>
        )}
        {!isHomeChatActive && (
          <div className="home-shortcut-row">
            {homeShortcutItems.map((item) => (
              <button className={`home-shortcut-card home-shortcut-${item.tone}`} key={item.path} onClick={() => navigate(item.path)}>
                <IconTile icon={item.icon} tone={item.tone} />
                <strong>{item.label}</strong>
                <span>{item.desc}</span>
              </button>
            ))}
          </div>
        )}
        <Card className="home-progress-card">
          <button className="home-progress-head" onClick={() => setProgressCollapsed((value) => !value)}>
            <h2>我的入职进度</h2>
            <span>{progressCollapsed ? '展开' : '收起'}</span>
          </button>
          {!progressCollapsed && (
            <>
              <StatGrid items={stats} />
              <div className="list-space">
                {progressItems.map((item) => {
                  const status = mapPermissionUiStatus(progressByPermission.get(item.id)?.status);
                  return <DataRow key={item.id} title={item.name} desc={progressByPermission.get(item.id)?.submittedAt ? `提交于 ${formatHomeTime(progressByPermission.get(item.id)?.submittedAt)}` : '尚未提交'} chip={status.chip} tone={status.tone} onClick={() => navigate(`/permission-detail/${item.id}`)} />;
                })}
              </div>
            </>
          )}
        </Card>
      </div>
      <div className={`home-fixed-chat${isHomeChatActive ? ' home-fixed-chat-chatting' : ''}`}>
        {visibleHomeChatMessages.length > 0 && (
          <div className="home-chat-thread" aria-live="polite">
            {visibleHomeChatMessages.map((message) => (
              <div className={`home-chat-message home-chat-message-${message.role}`} key={message.id}>
                <span className={`home-chat-avatar home-chat-avatar-${message.role}`} aria-hidden="true">
                  {message.role === 'bot' ? '海' : '我'}
                </span>
                <div className="home-chat-message-bubble">{message.text}</div>
              </div>
            ))}
            {isHomeChatActive && homeChatMessages.length === 0 && (
              <div className="home-suggested-questions">
                {getHomeQuickQuestions().map((question) => (
                  <button className="home-suggested-question-card" type="button" key={question} onClick={() => setAnswer(question)}>
                    <span aria-hidden="true">#</span>
                    <strong>{question}</strong>
                    <i aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="home-chat-input-row">
          <button type="button" onClick={handleOpenAttachmentSheet}>＋</button>
          <input
            value={answer}
            placeholder="请输入你的问题，例如：ChatGPT账号怎么申请？"
            onChange={(event) => setAnswer(event.target.value)}
            onFocus={() => setIsHomeChatActive(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSendHomeChat();
            }}
          />
          <button type="button" onClick={handleSendHomeChat}>发送</button>
        </div>
        {showAttachSheet && (
          <div className="home-attach-sheet home-attach-sheet-below">
            <div className="home-panel-head">
              <strong>添加内容</strong>
              <button type="button" onClick={() => setShowAttachSheet(false)}>关闭</button>
            </div>
            <div className="home-attach-grid">
              {homeAttachActions.map((item) => (
                <button className="home-attach-option-icon" type="button" key={item.key} onClick={() => setShowAttachSheet(false)}>
                  <IconTile icon={item.icon} tone={item.tone} />
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function D1Page({
  data,
  navigate,
  toast,
  onRoleChange,
}: {
  data: DashboardData;
  navigate: (path: string) => void;
  toast: (message: string) => void;
  onRoleChange?: (roleId: string) => Promise<void>;
}) {
  const guide = data.d1GuideConfig;
  const actions = [
    guide?.joinGroup
      ? {
          no: '1',
          title: guide.joinGroup.title,
          desc: `进入 ${guide.joinGroup.targetGroupName}，申请会发送给 ${guide.joinGroup.sendToEmployeeName}`,
          status: '已完成',
          label: '已完成',
          onClick: () => toast(`已模拟打开 ${guide.joinGroup.applyUrl}`),
        }
      : null,
    guide?.employeeGuide
      ? {
          no: '2',
          title: guide.employeeGuide.title,
          desc: guide.employeeGuide.documentTitle ?? '办公规范、门禁、餐饮、常见问题',
          status: '进行中',
          label: '进行中',
          onClick: () => toast(`已模拟打开 ${guide.employeeGuide.documentUrl}`),
        }
      : null,
    guide?.permissionPackage
      ? {
          no: '3',
          title: guide.permissionPackage.title,
          desc: guide.permissionPackage.description,
          status: '下一步',
          label: '下一步',
          onClick: () => navigate(guide.permissionPackage.routePath ?? '/permissions'),
        }
      : null,
  ].filter(Boolean) as Array<{ no: string; title: string; desc: string; status: string; label: string; onClick: () => void }>;
  return (
    <>
      <SectionCard title="D1 到达引导包">
        <p>先完成 3 个关键动作：进部门群、查看员工指南册、查看岗位权限包。</p>
        <Card className="notice-card inner">
          <RolePreviewSelect data={data} onRoleChange={onRoleChange} />
        </Card>
      </SectionCard>
      <SectionCard title="今日关键路径" action={<span className="time-hint">预计 20-30 分钟</span>}>
        <StepList showArrow hideStatus steps={actions.map((item) => ({ no: item.no, title: item.title, desc: item.desc, status: item.status, onClick: item.onClick }))} />
      </SectionCard>
      <SectionCard title="Bot 提醒">
        <p>加入飞书部门群仅模拟发送申请，不会调用真实飞书接口。员工指南册打开的是后台配置的飞书文档链接。</p>
      </SectionCard>
    </>
  );
}

export function PermissionPage({
  data,
  navigate,
  openModal,
  onRoleChange,
}: {
  data: DashboardData;
  navigate: (path: string) => void;
  openModal: (type: 'required' | 'optional') => void;
  onRoleChange?: (roleId: string) => Promise<void>;
}) {
  const required = data.package?.requiredPermissions ?? [];
  const optional = data.package?.optionalPermissions ?? [];
  const progressByPermission = new Map((data.progress ?? []).map((item) => [item.permissionItemId, item]));
  return (
    <>
      <Card className="permission-package-card">
        <IconTile icon="shield" tone="warning" />
        <div>
          <h2>{data.package?.role.name ?? '协同办公产品实习生'}权限包</h2>
          <p>适用于入职第一周 · D1-D7</p>
          <RolePreviewSelect data={data} onRoleChange={onRoleChange} variant="inline" />
        </div>
        <StatusChip tone="blue">岗位默认推荐</StatusChip>
      </Card>
      <SectionCard title="必开权限" action={<button className="mini-primary" onClick={() => openModal('required')}>必开权限：一键申请</button>}>
        {required.map((item) => {
          const status = mapPermissionUiStatus(progressByPermission.get(item.id)?.status);
          return <DataRow key={item.id} title={item.name} desc={`Owner：${item.ownerName}`} chip={status.chip} tone={status.tone} onClick={() => navigate(`/permission-detail/${item.id}`)} />;
        })}
      </SectionCard>
      <SectionCard title="可选权限" action={<button className="mini-primary" onClick={() => openModal('optional')}>可选权限：一键申请</button>}>
        {optional.map((item) => {
          const status = mapPermissionUiStatus(progressByPermission.get(item.id)?.status);
          return (
            <DataRow
              key={item.id}
              title={item.name}
              desc={item.sensitive ? '敏感权限需导师或 Owner 确认' : `Owner：${item.ownerName}`}
              chip={status.chip}
              tone={status.tone}
              onClick={() => navigate(`/permission-detail/${item.id}`)}
            />
          );
        })}
      </SectionCard>
      <Card className="notice-card">
        BPM 系统等敏感权限需导师或权限 Owner 确认后再申请。一键申请会把未申请权限更新为进行中，并进入 4 小时回访。
      </Card>
    </>
  );
}

export function PermissionDetailPage({
  data,
  params,
  navigate,
  toast,
  reload,
}: {
  data: DashboardData;
  params: Record<string, string>;
  navigate: (path: string) => void;
  toast: (message: string) => void;
  reload: () => Promise<void>;
}) {
  const item = [...(data.package?.requiredPermissions ?? []), ...(data.package?.optionalPermissions ?? [])].find((permission) => permission.id === params.id);
  const progress = data.progress?.find((record) => record.permissionItemId === item?.id);
  const isSubmitted = Boolean(progress);
  const permissionStatus = mapPermissionUiStatus(progress?.status);

  async function submitProgress() {
    if (!data.newcomer || !item) return;
    const result = await api.submitPermissionProgress(data.newcomer.id, item.id);
    toast('已登记提交状态');
    await reload();
    navigate(`/follow-up/${result.followUpTask.id}`);
  }

  return (
    <>
      <Card className="permission-detail-card">
        <div className="detail-head">
          <IconTile icon="sparkles" tone="ai" />
          <div>
            <h2>{item?.name ?? 'ChatGPT 账号'}申请</h2>
            <p>{item?.category ?? 'AI 工具'} / 协同办公提效</p>
          </div>
          <StatusChip tone={permissionStatus.tone}>{permissionStatus.chip}</StatusChip>
        </div>
      </Card>
      <SectionCard title="申请入口">
        <p className="link-text">{item?.applyUrl ?? 'approval.haina-ai.com/v1/tools/chatgpt-access'}</p>
      </SectionCard>
      <SectionCard title="申请理由模板">
        <p>{item?.reasonTemplate ?? '本人为协同办公组新入职产品实习生，需申请 ChatGPT 账号用于 PRD 编写、资料整理、测试用例生成，提升办公效率。'}</p>
      </SectionCard>
      <SectionCard title="审批人 / 负责人">
        <DataRow title={item?.approverName ?? '刘长省（协同办公组）'} desc={`Owner：${item?.ownerName ?? '协同办公权限Owner'} · ${item?.ownerContact ?? 'IT 支持群'}`} chip="可联系" tone="blue" />
      </SectionCard>
      <SectionCard title="常见等待原因">
        <div className="tag-row">
          {(item?.commonWaitingReasons ?? ['审批人暂未处理', '申请理由不够清楚', '账号额度等待中']).map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="申请进度追踪">
        <StepList
          steps={[
            { no: '1', title: '待提交申请', desc: '复制理由并打开审批入口', status: isSubmitted ? '已完成' : '进行中' },
            { no: '2', title: '等待审批中', desc: '提交后等待审批人与系统开通', status: isSubmitted ? '进行中' : '下一步' },
            { no: '3', title: '完成开通', desc: '确认账号可登录后结束提醒', status: '下一步' },
          ]}
        />
      </SectionCard>
      <div className="fixed-actions">
        <ActionButton
          tone="secondary"
          hideIcon
          onClick={() => {
            toast('已打开审批入口');
          }}
        >
          打开入口
        </ActionButton>
        <ActionButton
          tone="secondary"
          hideIcon
          onClick={() => {
            navigator.clipboard?.writeText(item?.reasonTemplate ?? '');
            toast('已复制申请理由');
          }}
        >
          复制理由
        </ActionButton>
        <ActionButton hideIcon onClick={submitProgress}>我已提交</ActionButton>
      </div>
    </>
  );
}

export function FollowUpPage({ navigate, toast, openOwner }: { navigate: (path: string) => void; toast: (message: string) => void; openOwner: () => void }) {
  const [unfinished, setUnfinished] = useState(true);
  return (
    <>
      <SectionCard title="你登记的权限有进展了吗？">
        <p>我不会真实催办，只帮你准备话术与 Owner 路径。</p>
      </SectionCard>
      <SectionCard title="ChatGPT账号申请">
        <div className="time-pair">
          <span>提交时间：09:15</span>
          <span>预计回访：13:15</span>
        </div>
        <div className="segmented">
          <button className={!unfinished ? 'selected' : ''} onClick={() => setUnfinished(false)}>
            已完成
          </button>
          <button className={unfinished ? 'selected' : ''} onClick={() => setUnfinished(true)}>
            未完成
          </button>
        </div>
      </SectionCard>
      {unfinished && (
        <SectionCard title="未完成时，下一步">
          <Card className="notice-card inner">
            催办话术示例：你好，我是协同办公组新入职同学，今天上午已提交 ChatGPT 账号申请。想确认下当前是否还需要我补充信息，辛苦帮忙看一下，谢谢。
          </Card>
          <div className="dual-actions">
            <ActionButton
              hideIcon
              onClick={() => {
                toast('已模拟发送催办信息');
              }}
            >
              发送催办信息
            </ActionButton>
            <ActionButton tone="secondary" hideIcon onClick={openOwner}>
              联系 Owner
            </ActionButton>
          </div>
          <ActionButton tone="secondary" hideIcon onClick={() => navigate('/anonymous-feedback')}>
            匿名反馈
          </ActionButton>
        </SectionCard>
      )}
      <SectionCard title="流程修正说明">
        <p>点击“一键申请”会把未申请权限更新为进行中，并生成 4 小时回访任务；真实审批与飞书消息仍保持模拟。</p>
      </SectionCard>
    </>
  );
}

export function WeeklyFeedbackPage({ data, reload, toast }: { data: DashboardData; reload: () => Promise<void>; toast: (message: string) => void }) {
  const [submitted, setSubmitted] = useState(false);
  const questions = data.weeklyConfig?.questions ?? [];
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      questions
        .filter((question) => question.inputType === 'single' && question.options[0])
        .map((question) => [question.id, [question.options[0].id]]),
    ),
  );
  const [textByQuestion, setTextByQuestion] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelectedByQuestion((current) => {
      const next: Record<string, string[]> = {};
      for (const question of questions) {
        if (question.inputType === 'text') continue;
        const validOptionIds = new Set(question.options.map((option) => option.id));
        const selected = (current[question.id] ?? []).filter((id) => validOptionIds.has(id));
        next[question.id] = selected.length > 0 ? selected : question.inputType === 'single' && question.options[0] ? [question.options[0].id] : [];
      }
      return next;
    });
    setTextByQuestion((current) => {
      const next: Record<string, string> = {};
      for (const question of questions) {
        if (question.inputType !== 'text') continue;
        next[question.id] = current[question.id] ?? (question.questionKey === 'message' ? '这一周整体适应还可以，团队同学都很友好。目前主要还是部分权限没有完全开通。' : '');
      }
      return next;
    });
  }, [data.weeklyConfig]);

  function toggleOption(question: WeeklyFeedbackQuestion, optionId: string) {
    setSelectedByQuestion((current) => {
      const selected = current[question.id] ?? [];
      if (question.inputType === 'single') return { ...current, [question.id]: [optionId] };
      return selected.includes(optionId)
        ? { ...current, [question.id]: selected.filter((id) => id !== optionId) }
        : { ...current, [question.id]: [...selected, optionId] };
    });
  }

  async function submit() {
    if (!data.newcomer) return;
    const missing = findMissingWeeklyRequiredQuestion(questions, selectedByQuestion, textByQuestion);
    if (missing) {
      toast(`请先完成：${missing.title}`);
      return;
    }
    await api.submitWeeklyFeedback({
      newcomerId: data.newcomer.id,
      answers: questions.map((question) =>
        question.inputType === 'text'
          ? { questionId: question.id, textValue: textByQuestion[question.id] ?? '' }
          : { questionId: question.id, selectedOptionIds: selectedByQuestion[question.id] ?? [] },
      ),
    });
    setSubmitted(true);
    toast('已提交首周反馈');
    await reload();
  }

  function weeklyQuestionTitle(question: WeeklyFeedbackQuestion) {
    return (
      <>
        {question.title}
        {question.required && weeklyRequiredStarQuestionKeys.has(question.questionKey) && <span className="required-star">*</span>}
      </>
    );
  }

  return (
    <>
      <SectionCard title="填写给管理者看的首周反馈">
        <p>该反馈不匿名，由新人填写，提交后供管理者在页面 12 查看与跟进，不用于绩效评价。</p>
      </SectionCard>
      {questions.map((question) => (
        <SectionCard title={weeklyQuestionTitle(question)} key={question.id}>
          {question.inputType === 'text' ? (
            <textarea
              value={textByQuestion[question.id] ?? ''}
              maxLength={question.maxLength ?? 500}
              onChange={(event) => setTextByQuestion((current) => ({ ...current, [question.id]: event.target.value }))}
            />
          ) : (
            <div className="tag-row tag-grid tag-grid-two">
              {question.options.map((option) => {
                const selected = (selectedByQuestion[question.id] ?? []).includes(option.id);
                return (
                  <button key={option.id} type="button" className={selected ? 'selected' : ''} onClick={() => toggleOption(question, option.id)}>
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>
      ))}
      {questions.length === 0 && <Card className="quiet-card">首周反馈题目尚未配置，请先到后台配置维护台补充题目与选项。</Card>}
      {submitted || data.weekly ? (
        <Card className="success-card">首周反馈已提交，管理者可在“管理者视角 / 新人首周反馈”中只读查看。</Card>
      ) : null}
      <div className="fixed-actions">
        <ActionButton hideIcon onClick={submit}>提交反馈</ActionButton>
      </div>
    </>
  );
}

export function AnonymousFeedbackPage({ data, reload, toast }: { data: DashboardData; reload: () => Promise<void>; toast: (message: string) => void }) {
  const [done, setDone] = useState(false);
  const flow = getAnonymousFeedbackFlow();
  const sections = Object.fromEntries(flow.sections.map((section) => [section.key, section]));
  const modules = (data.anonymousConfig?.modules ?? [])
    .filter((module) => module.enabled)
    .map((module) => ({
      ...module,
      problemTypes: module.problemTypes.filter((item) => item.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
      expectedActions: module.expectedActions.filter((item) => item.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((module) => module.problemTypes.length > 0 && module.expectedActions.length > 0);
  const [description, setDescription] = useState('');
  const [moduleKey, setModuleKey] = useState('');
  const [problemTypeKey, setProblemTypeKey] = useState('');
  const [problemTypeOtherText, setProblemTypeOtherText] = useState('');
  const [expectedActionKeys, setExpectedActionKeys] = useState<string[]>([]);
  const [expectedActionOtherText, setExpectedActionOtherText] = useState('');
  const selectedModule = modules.find((item) => item.moduleKey === moduleKey) ?? modules[0];
  const selectedProblemType = selectedModule?.problemTypes.find((item) => item.typeKey === problemTypeKey);
  const selectedExpectedActions = selectedModule?.expectedActions.filter((item) => expectedActionKeys.includes(item.actionKey)) ?? [];

  useEffect(() => {
    if (!selectedModule) return;
    if (moduleKey !== selectedModule.moduleKey) setModuleKey(selectedModule.moduleKey);
    if (!selectedModule.problemTypes.some((item) => item.typeKey === problemTypeKey)) {
      setProblemTypeKey(selectedModule.problemTypes[0]?.typeKey ?? '');
      setProblemTypeOtherText('');
    }
    const validActionKeys = new Set(selectedModule.expectedActions.map((item) => item.actionKey));
    const keptActionKeys = expectedActionKeys.filter((key) => validActionKeys.has(key));
    if (keptActionKeys.length !== expectedActionKeys.length) setExpectedActionKeys(keptActionKeys);
    if (keptActionKeys.length === 0 && selectedModule.expectedActions[0]) setExpectedActionKeys([selectedModule.expectedActions[0].actionKey]);
  }, [selectedModule, moduleKey, problemTypeKey, expectedActionKeys]);

  async function submit() {
    if (!description.trim()) {
      toast('请先填写问题描述');
      return;
    }
    if (!problemTypeKey) {
      toast('请选择问题类型');
      return;
    }
    if (selectedProblemType?.requiresText && !problemTypeOtherText.trim()) {
      toast('请补充其他问题类型说明');
      return;
    }
    if (expectedActionKeys.length === 0) {
      toast('请选择希望如何处理');
      return;
    }
    if (selectedExpectedActions.some((item) => item.requiresText) && !expectedActionOtherText.trim()) {
      toast('请补充其他处理方式说明');
      return;
    }
    await api.submitAnonymousFeedback({
      moduleKey,
      problemTypeKey,
      problemTypeOtherText: problemTypeOtherText.trim() || undefined,
      expectedActionKeys,
      expectedActionOtherText: expectedActionOtherText.trim() || undefined,
      description: description.trim(),
      isAnonymous: true,
      submittedByNewcomerId: data.newcomer?.id,
    });
    setDone(true);
    toast('已提交匿名反馈');
    await reload();
  }

  function sectionTitle(key: 'description' | 'module' | 'type' | 'expectedAction') {
    const section = sections[key];
    return (
      <>
        {section.title}
        {section.required && <span className="required-star">*</span>}
        {section.suffix && <span className="title-suffix">{section.suffix}</span>}
      </>
    );
  }

  return (
    <>
      <SectionCard title="你可以匿名反馈流程问题">
        <p>反馈会进入产品 / 内容 Owner 的匿名反馈池，不向管理者展示原文，也不用于个人评价。</p>
      </SectionCard>
      <SectionCard title={sectionTitle('description')}>
        <textarea value={description} placeholder={flow.description.placeholder} onChange={(event) => setDescription(event.target.value)} />
      </SectionCard>
      <SectionCard title={sectionTitle('module')}>
        <div className="tag-row tag-grid tag-grid-two">
          {modules.map((item) => (
            <button
              key={item.moduleKey}
              type="button"
              className={selectedModule?.moduleKey === item.moduleKey ? 'selected' : ''}
              onClick={() => {
                setModuleKey(item.moduleKey);
                setProblemTypeKey(item.problemTypes[0]?.typeKey ?? '');
                setProblemTypeOtherText('');
                setExpectedActionKeys(item.expectedActions[0] ? [item.expectedActions[0].actionKey] : []);
                setExpectedActionOtherText('');
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </SectionCard>
      <SectionCard title={sectionTitle('type')}>
        <div className="tag-row tag-grid tag-grid-two">
          {(selectedModule?.problemTypes ?? []).map((item) => (
            <button key={item.typeKey} type="button" className={problemTypeKey === item.typeKey ? 'selected' : ''} onClick={() => setProblemTypeKey(item.typeKey)}>
              {item.label}
            </button>
          ))}
        </div>
        {selectedProblemType?.requiresText && (
          <input
            className="inline-text-input"
            value={problemTypeOtherText}
            placeholder="请补充具体问题类型"
            onChange={(event) => setProblemTypeOtherText(event.target.value)}
          />
        )}
      </SectionCard>
      <SectionCard title={sectionTitle('expectedAction')}>
        <div className="tag-row tag-grid tag-grid-two">
          {(selectedModule?.expectedActions ?? []).map((item) => (
            <button key={item.actionKey} type="button" className={expectedActionKeys.includes(item.actionKey) ? 'selected' : ''} onClick={() => setExpectedActionKeys((current) => toggleMultiChoice(current, item.actionKey))}>
              {item.label}
            </button>
          ))}
        </div>
        {selectedExpectedActions.some((item) => item.requiresText) && (
          <input
            className="inline-text-input"
            value={expectedActionOtherText}
            placeholder="请补充希望如何处理"
            onChange={(event) => setExpectedActionOtherText(event.target.value)}
          />
        )}
      </SectionCard>
      {modules.length === 0 && <Card className="quiet-card">匿名反馈分类尚未配置，请先到后台配置维护台补充。</Card>}
      {done && <Card className="success-card">匿名反馈已进入反馈池，后台配置维护台可查看处理状态。</Card>}
      <div className="fixed-actions">
        <ActionButton tone="secondary" hideIcon onClick={() => window.history.back()}>
          取消
        </ActionButton>
        <ActionButton hideIcon onClick={submit}>提交反馈</ActionButton>
      </div>
    </>
  );
}

export function ApplyModal({
  title,
  items,
  note,
  onClose,
  onConfirm,
}: {
  title: string;
  items: PermissionItem[];
  note: string;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void | Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState(() => createInitialApplySelection(items.map((item) => item.id)));
  const selectedCount = selectedIds.size;
  return (
    <Modal title={title} onClose={onClose}>
      {items.length > 0 ? (
        <div className="modal-list">
          {items.map((item) => {
            const selected = selectedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`selectable-permission-row ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                onClick={() => setSelectedIds((current) => toggleApplySelection(current, item.id))}
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.permissionType === 'optional' && item.sensitive ? '默认不选中，需确认后申请' : '将进入进行中并生成回访任务'}</small>
                </span>
                <em>{selected ? '勾选' : '未选'}</em>
              </button>
            );
          })}
        </div>
      ) : (
        <Card className="quiet-card inner">当前没有未申请权限，已申请过的权限不会重复展示。</Card>
      )}
      <Card className="notice-card inner">{note}</Card>
      <div className="dual-actions">
        <ActionButton tone="secondary" hideIcon onClick={onClose}>
          取消
        </ActionButton>
        <ActionButton hideIcon disabled={items.length === 0} onClick={() => onConfirm([...selectedIds])}>
          {selectedCount > 0 ? '确认申请' : '确认取消'}
        </ActionButton>
      </div>
    </Modal>
  );
}
