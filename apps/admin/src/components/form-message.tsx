import type { ActionResult } from '@/server/actions/action-state';

import { cx } from './ui';

export function FormMessage({ state }: { state: ActionResult }) {
  if (state.status === 'idle') return null;
  return (
    <p
      role={state.status === 'error' ? 'alert' : 'status'}
      className={cx('text-sm', state.status === 'error' ? 'text-red-600' : 'text-emerald-700')}
    >
      {state.message}
    </p>
  );
}
