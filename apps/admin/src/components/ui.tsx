import type { BookingStatus } from '@rn-booking/shared';
import type { ComponentProps, ReactNode } from 'react';

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cx('rounded-xl border border-zinc-200 bg-white p-5 shadow-xs', className)}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

const buttonStyles = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
} as const;

export function buttonClass(variant: keyof typeof buttonStyles = 'primary', className?: string) {
  return cx(
    'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
    buttonStyles[variant],
    className,
  );
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof buttonStyles }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export const inputClass =
  'block h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm shadow-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

export function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block space-y-1.5', className)}>
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  confirmed: 'bg-brand-50 text-brand-700 ring-brand-100',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  no_show: 'bg-red-50 text-red-700 ring-red-200',
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={cx(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-zinc-500">
        {children}
      </td>
    </tr>
  );
}
