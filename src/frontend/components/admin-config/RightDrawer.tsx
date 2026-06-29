import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type RightDrawerProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function RightDrawer({ title, open, onClose, children, footer }: RightDrawerProps) {
  if (!open) return null;

  return (
    <aside className="admin-drawer" aria-label={title}>
      <div className="admin-drawer-head">
        <h2>{title}</h2>
        <button type="button" onClick={onClose} aria-label="关闭">
          <X size={18} />
        </button>
      </div>
      <div className="admin-drawer-body">{children}</div>
      {footer && <div className="admin-drawer-footer">{footer}</div>}
    </aside>
  );
}
