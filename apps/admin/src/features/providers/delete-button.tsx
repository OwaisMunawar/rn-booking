'use client';

import { useActionState } from 'react';

import { FormMessage } from '@/components/form-message';
import { Button } from '@/components/ui';
import { idle, type ActionResult } from '@/server/actions/action-state';

export function DeleteButton({
  id,
  label,
  confirmText,
  action: serverAction,
}: {
  id: string;
  label: string;
  confirmText: string;
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
}) {
  const [state, action, pending] = useActionState(serverAction, idle);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
      className="flex items-center gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger" disabled={pending}>
        {label}
      </Button>
      {state.status === 'error' ? <FormMessage state={state} /> : null}
    </form>
  );
}
