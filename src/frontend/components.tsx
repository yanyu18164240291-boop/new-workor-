import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Grid3X3,
  Home,
  Inbox,
  MessageCircle,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  Wrench,
} from 'lucide-react';

import type { PageRoute } from './routes.ts';
import { getBottomNavItems, getOwnerHomePath } from './routes.ts';

type Navigate = (path: string) => void;
type Tone = 'default' | 'success' | 'warning' | 'danger' | 'ai' | 'blue';

export const icons = {
  alert: AlertTriangle,
  bar: BarChart3,
  bell: Bell,
  book: BookOpen,
  bot: Bot,
  check: CheckCircle2,
  clip: ClipboardList,
  file: FileText,
  grid: Grid3X3,
  home: Home,
  inbox: Inbox,
  message: MessageCircle,
  more: MoreHorizontal,
  search: Search,
  settings: Settings,
  shield: ShieldCheck,
  sparkles: Sparkles,
  user: UserRound,
  users: UsersRound,
  wrench: Wrench,
};

export function PrototypePage({ route, children }: { route: PageRoute; children: ReactNode }) {
  return (
    <div className="prototype-page">
      <div className="prototype-title">
        <span>{route.pageNo}</span>
        <strong>{route.title}</strong>
      </div>
      {children}
    </div>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone-shell" aria-label="海纳 AI 入职 Bot H5">
      <div className="phone-bezel">{children}</div>
    </div>
  );
}

export function AppHeader({
  route,
  subtitle,
  navigate,
  onHomeSearch,
  onHomeHistory,
}: {
  route: PageRoute;
  subtitle?: string;
  navigate: Navigate;
  onHomeSearch?: () => void;
  onHomeHistory?: () => void;
}) {
  if (route.pageNo === '01') {
    return (
      <header className="app-header app-header-home">
        <div className="home-brand-mark">海</div>
        <div className="app-header-copy">
          <h1>
            海纳AI入职Bot <span className="bot-badge">BOT</span>
          </h1>
          <p>{subtitle ?? route.purpose}</p>
        </div>
        <div className="header-actions">
          <button className="plain-icon" aria-label="搜索" onClick={onHomeSearch}>
            <Search size={17} />
          </button>
          <button className="plain-icon" aria-label="更多" onClick={onHomeHistory}>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <button className="plain-icon" aria-label="返回" onClick={() => navigate(getOwnerHomePath(route.owner))}>
        <ChevronLeft size={18} />
      </button>
      <div className="app-header-copy">
        <h1>{route.shortTitle}</h1>
        <p>{subtitle ?? route.purpose}</p>
      </div>
      <div className="header-actions">
        <button className="plain-icon" aria-label="搜索">
          <Search size={17} />
        </button>
        <button className="plain-icon" aria-label="更多">
          <MoreHorizontal size={18} />
        </button>
      </div>
    </header>
  );
}

export function PageBoard({ children }: { children: ReactNode }) {
  return <main className="page-board">{children}</main>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function SectionCard({ title, children, action, compact = false }: { title?: ReactNode; children: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <Card className={compact ? 'compact-card' : ''}>
      {title && (
        <div className="section-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}

export function IconTile({ icon, tone = 'blue' }: { icon: keyof typeof icons; tone?: Tone }) {
  const Icon = icons[icon];
  return (
    <span className={`icon-tile icon-tile-${tone}`}>
      <Icon size={17} />
    </span>
  );
}

export function StatusChip({ tone = 'default', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`status-chip status-chip-${tone}`}>{children}</span>;
}

export function DataRow({
  title,
  desc,
  chip,
  tone = 'default',
  onClick,
}: {
  title: string;
  desc?: string;
  chip?: string;
  tone?: Tone;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div>
        <strong>{title}</strong>
        {desc && <p>{desc}</p>}
      </div>
      {chip && <StatusChip tone={tone}>{chip}</StatusChip>}
    </>
  );
  return onClick ? (
    <button className="data-row" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="data-row static">{content}</div>
  );
}

export function StatGrid({ items }: { items: Array<{ value: string | number; label: string; tone?: string }> }) {
  return (
    <div className="metric-grid">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.value}</span>
          <p>{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function StepList({
  steps,
  hideStatus = false,
  showArrow = false,
}: {
  steps: Array<{ no: string; title: string; desc: string; status: string; onClick?: () => void }>;
  hideStatus?: boolean;
  showArrow?: boolean;
}) {
  return (
    <div className="step-list">
      {steps.map((step) => {
        const rowClass = `step-row ${hideStatus ? 'step-row-no-status' : ''} ${showArrow ? 'step-row-with-arrow' : ''}`;
        const rowKey = `${step.no}-${step.title}`;
        const content = (
          <>
            <span className={step.status === '已完成' ? 'step-dot done' : step.status === '进行中' ? 'step-dot active' : 'step-dot'}>{step.no}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.desc}</p>
            </div>
            {!hideStatus && <StatusChip tone={step.status === '已完成' ? 'success' : step.status === '进行中' ? 'warning' : 'blue'}>{step.status}</StatusChip>}
            {showArrow && <i className="step-arrow" aria-hidden="true" />}
          </>
        );
        return step.onClick ? (
          <button className={rowClass} key={rowKey} onClick={step.onClick}>
            {content}
          </button>
        ) : (
          <div className={rowClass} key={rowKey}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function LoadingState({ status, error }: { status: string; error: string }) {
  if (status === 'loading') {
    return (
      <Card className="quiet-card">
        <p>正在从后端读取 P0 demo 数据...</p>
      </Card>
    );
  }
  if (status === 'error') {
    return (
      <Card className="error-card">
        <strong>后端未连接</strong>
        <p>{error}</p>
        <p>请先运行 npm.cmd run dev:api，再打开 H5 页面。</p>
      </Card>
    );
  }
  return null;
}

export function ActionButton({
  children,
  onClick,
  tone = 'primary',
  disabled = false,
  hideIcon = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  hideIcon?: boolean;
}) {
  return (
    <button className={`action-button action-button-${tone}`} onClick={onClick} disabled={disabled}>
      <span>{children}</span>
      {!hideIcon && !disabled && tone !== 'ghost' && <ChevronRight size={15} />}
    </button>
  );
}

export function BottomNav({ currentPage, navigate }: { currentPage: string; navigate: Navigate }) {
  const items = getBottomNavItems(currentPage);

  return (
    <nav className="bottom-nav" aria-label="主要导航">
      {items.map((item) => {
        const Icon = icons[item.icon];
        const active = item.pages.includes(currentPage);
        return (
          <button key={item.label} className={active ? 'active' : ''} onClick={() => navigate(item.path)} aria-current={active ? 'page' : undefined}>
            <Icon size={17} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Toast({ message }: { message: string }) {
  return <div className="toast">{message}</div>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="section-heading">
          <h2>{title}</h2>
          <button className="text-button" onClick={onClose}>
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
