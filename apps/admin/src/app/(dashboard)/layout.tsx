import Link from 'next/link';

import { buttonClass } from '@/components/ui';
import { signOut } from '@/server/actions/auth';
import { dataMode } from '@/server/env';
import { requireSession } from '@/server/session';

export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  const session = await requireSession();
  const nav = [
    { href: '/' as const, label: 'Overview' },
    { href: '/bookings' as const, label: 'Bookings' },
    session.providerId
      ? { href: `/providers/${session.providerId}` as const, label: 'My listing' }
      : { href: '/providers' as const, label: 'Providers' },
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-zinc-200 bg-white md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 p-5 md:block">
          <div>
            <p className="text-sm font-semibold">Booking Admin</p>
            <p className="text-xs text-zinc-500">
              {dataMode === 'demo' ? 'Demo data' : 'Supabase'}
            </p>
          </div>
          <form action={signOut} className="md:hidden">
            <button className={buttonClass('secondary')}>Sign out</button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-zinc-200 p-5 md:mt-6 md:block">
          <p className="text-sm font-medium">{session.name}</p>
          <p className="mb-3 text-xs capitalize text-zinc-500">{session.role}</p>
          <form action={signOut}>
            <button className={buttonClass('secondary', 'w-full')}>Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-5 md:p-8">{children}</main>
    </div>
  );
}
