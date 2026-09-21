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
    <section className={classNames('card p-4', className)}>
      {title && <h2 className="text-sm font-semibold">{title}</h2>}
      {subtitle && <p className="muted mt-0.5 text-xs">{subtitle}</p>}
      <div className={title ? 'mt-3' : undefined}>{children}</div>
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="muted py-6 text-sm">{message}</p>;
}
