type StatusTagProps = {
  children: string;
  tone?: 'blue' | 'success' | 'warning' | 'danger' | 'ai' | 'neutral';
};

export function StatusTag({ children, tone = 'neutral' }: StatusTagProps) {
  return <span className={`admin-status-tag admin-status-${tone}`}>{children}</span>;
}
