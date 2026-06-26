import type { ReactNode } from 'react';

type MetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'blue' | 'success' | 'warning' | 'danger' | 'ai';
};

export function MetricCard({ label, value, hint, tone = 'blue' }: MetricCardProps) {
  return (
    <div className={`admin-metric-card admin-metric-${tone}`}>
      <span>{value}</span>
      <strong>{label}</strong>
      {hint && <p>{hint}</p>}
    </div>
  );
}
