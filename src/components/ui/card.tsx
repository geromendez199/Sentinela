import { classNames } from '@/lib/utils/format';

export function Card({
  title,
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={classNames('card p-5 sm:p-6', className)}>
      {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
      {subtitle && <p className="muted mt-1.5 text-xs leading-relaxed">{subtitle}</p>}
      <div className={title ? 'mt-5' : undefined}>{children}</div>
    </section>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return <div className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-neutral-50/60 px-5 py-7 text-center"><p className="muted max-w-sm text-sm leading-relaxed">{message}</p>{action}</div>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block rounded-lg ${className}`} />;
}
