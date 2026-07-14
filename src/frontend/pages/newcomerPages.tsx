import { useEffect, useState } from 'react';

import { api, type HomeAiAnswer, type PermissionItem } from '../api.ts';
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
import { getHomeQuickQuestions } from '../routes.ts';
import {
  createInitialApplySelection,
  mapPermissionUiStatus,
  toggleApplySelection,
} from '../permissionSelection.ts';

function formatHomeTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatHomeAiReply(answer: HomeAiAnswer): string {
  if (answer.citations.length === 0) return answer.answer;
  const sources = answer.citations.map((citation) => `${citation.title}（${citation.ownerName}）`).join('、');
  return `${answer.answer}\n\n引用：${sources}`;
}

function RolePreviewSelect({
  data,
  variant = 'card',
}: {
  data: DashboardData;
  variant?: 'card' | 'inline';
}) {
  const roles = data.roles ?? [];
  const selectedRoleId = data.selectedRoleId ?? data.package?.role.id ?? data.newcomer?.roleId ?? '';
  const selectedRoleName = data.package?.role.name ?? roles.find((role) => role.id === selectedRoleId)?.name ?? '协同办公产品实习生';
  const departmentName = data.authSession?.user?.departmentName ?? data.newcomer?.department ?? data.package?.role.department ?? '';

  return (
    <div className={`role-preview-select role-preview-select-${variant}`}>
      <span>当前岗位</span>
      <strong>{selectedRoleName}</strong>
      {departmentName && <small>{departmentName}</small>}
    </div>
  );
}

export function HomePage({ data, navigate }: { data: DashboardData; navigate: (path: string) => void }) {
  const stats = buildHomeProgressStats({
    permissions: [...(data.package?.requiredPermissions ?? []), ...(data.package?.optionalPermissions ?? [])],
    progress: data.progress ?? [],
    followUps: data.followUps ?? [],
  });
  const progressByPermission = new Map((data.progress ?? []).map((item) => [item.permissionItemId, item]));
  const progressItems = [...(data.package?.requiredPermissions ?? []), ...(data.package?.optionalPermissions ?? [])].slice(0, 4);
  const profileName = data.authSession?.user?.name?.trim() || data.newcomer?.name || '新同学';
  const departmentName = data.authSession?.user?.departmentName?.trim() || data.newcomer?.department || '协同办公部门';
  const roleName = data.authSession?.user?.jobTitle?.trim() || data.package?.role.name || '岗位新人';
  const welcomeHeadline = `${profileName}您好呀！欢迎进入${departmentName}`;
  const welcomeBody = `我是海纳AI入职Bot。你的岗位是${roleName}，我会帮你查询岗位权限、准备申请信息并跟进处理进度。`;
  const [answer, setAnswer] = useState('');
  const [homeChatMessages, setHomeChatMessages] = useState<HomeChatMessage[]>([]);
  const [isHomeChatActive, setIsHomeChatActive] = useState(false);
  const [isHomeAiPending, setIsHomeAiPending] = useState(false);
  const [progressCollapsed, setProgressCollapsed] = useState(true);
  const [activeHomePanel, setActiveHomePanel] = useState<'search' | 'history' | null>(null);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [dismissedHomeSearchRecordIds, setDismissedHomeSearchRecordIds] = useState<string[]>([]);
  const [showAttachSheet, setShowAttachSheet] = useState(false);
  const homeOpeningMessage: HomeChatMessage = {
    id: 'home-opening-message',
    role: 'bot',
    text: `${welcomeHeadline}。${welcomeBody}`,
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
        { id: 'history-oa-bot', role: 'bot', text: '先在权限包中确认需要的权限，再按权限详情中的入口提交；遇到问题时联系权限 Owner。' },
      ] as HomeChatMessage[],
    },
  ];
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

  async function handleSendHomeChat() {
    const question = answer.trim();
    if (!question || isHomeAiPending) return;

    setIsHomeChatActive(true);
    setIsHomeAiPending(true);
    setAnswer('');
    const userMessage: HomeChatMessage = { id: `${Date.now()}-user`, role: 'user', text: question };
    setHomeChatMessages((messages) => [...messages.slice(-6), userMessage]);
    try {
      let reply = buildHomeBotReply(question);
      if (data.newcomer?.id) {
        try {
          reply = formatHomeAiReply(await api.askHomeAi(data.newcomer.id, { question }));
        } catch {
          reply = buildHomeBotReply(question) || '后端问答暂时不可用，请稍后重试。';
        }
      }
      setHomeChatMessages((messages) => [
        ...messages.slice(-6),
        { id: `${Date.now()}-bot`, role: 'bot', text: reply },
      ]);
    } finally {
      setIsHomeAiPending(false);
    }
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
              <h2 className="home-greeting-line">{welcomeHeadline}</h2>
              <p>{welcomeBody}</p>
            </Card>
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
            {isHomeAiPending && (
              <div className="home-chat-message home-chat-message-bot" aria-busy="true">
                <span className="home-chat-avatar home-chat-avatar-bot" aria-hidden="true">海</span>
                <div className="home-chat-message-bubble">正在检索入职知识库...</div>
              </div>
            )}
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
            disabled={isHomeAiPending}
            placeholder="请输入你的问题，例如：ChatGPT账号怎么申请？"
            onChange={(event) => setAnswer(event.target.value)}
            onFocus={() => setIsHomeChatActive(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleSendHomeChat();
            }}
          />
          <button type="button" disabled={isHomeAiPending} onClick={() => void handleSendHomeChat()}>
            {isHomeAiPending ? '等待' : '发送'}
          </button>
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
          <p>按当前岗位配置 · 数据来自后台权限包</p>
          <RolePreviewSelect data={data} variant="inline" />
        </div>
        <StatusChip tone="blue">岗位默认推荐</StatusChip>
      </Card>
      <SectionCard title="必开权限" action={<button className="mini-primary" onClick={() => openModal('required')}>必开权限：批量登记</button>}>
        {required.map((item) => {
          const status = mapPermissionUiStatus(progressByPermission.get(item.id)?.status);
          return <DataRow key={item.id} title={item.name} desc={`Owner：${item.ownerName}`} chip={status.chip} tone={status.tone} onClick={() => navigate(`/permission-detail/${item.id}`)} />;
        })}
      </SectionCard>
      <SectionCard title="可选权限" action={<button className="mini-primary" onClick={() => openModal('optional')}>可选权限：批量登记</button>}>
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
        BPM 系统等敏感权限需导师或权限 Owner 确认后再申请。当前阶段暂不进入真实审批流程；先在系统内登记提交状态并进入 4 小时回访。
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
        <p className="link-text">真实审批暂未启用，当前仅保留申请信息和提交登记。</p>
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
            { no: '1', title: '待登记申请', desc: '复制理由，按当前试点流程线下确认', status: isSubmitted ? '已完成' : '进行中' },
            { no: '2', title: '等待 Owner 跟进', desc: '登记后进入回访，不跳转真实审批', status: isSubmitted ? '进行中' : '下一步' },
            { no: '3', title: '完成开通', desc: '确认账号可登录后结束提醒', status: '下一步' },
          ]}
        />
      </SectionCard>
      <div className="fixed-actions">
        <ActionButton
          tone="secondary"
          hideIcon
          onClick={() => {
            toast('当前阶段暂不进入真实审批流程，请先复制理由并登记提交状态');
          }}
        >
          暂不打开审批
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

export function FollowUpPage({ toast, openOwner }: { toast: (message: string) => void; openOwner: () => void }) {
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
                navigator.clipboard?.writeText(
                  '你好，我是协同办公组新入职同学，今天上午已提交 ChatGPT 账号申请。想确认下当前是否还需要我补充信息，辛苦帮忙看一下，谢谢。',
                );
                toast('已复制催办话术，请在飞书中发送给 Owner');
              }}
            >
              复制催办话术
            </ActionButton>
            <ActionButton tone="secondary" hideIcon onClick={openOwner}>
              联系 Owner
            </ActionButton>
          </div>
        </SectionCard>
      )}
      <SectionCard title="流程修正说明">
        <p>权限申请暂不进入真实审批流程；批量登记只用于同步已提交状态并生成 4 小时回访。</p>
      </SectionCard>
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
