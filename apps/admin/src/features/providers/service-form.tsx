'use client';

import type { Category, Service } from '@rn-booking/shared';
import { useActionState } from 'react';

import { FormMessage } from '@/components/form-message';
import { Button, Field, inputClass } from '@/components/ui';
import { saveService } from '@/server/actions/catalog';
import { idle } from '@/server/actions/action-state';

export function ServiceForm({
  providerId,
  category,
  service,
}: {
  providerId: string;
  category: Category;
  service?: Service;
}) {
  const [state, action, pending] = useActionState(saveService, idle);
  const error = (field: string) =>
    state.status === 'error' ? state.fieldErrors?.[field] : undefined;

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="providerId" value={providerId} />
      <input type="hidden" name="category" value={category} />
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      <Field label="Name" error={error('name')} className="sm:col-span-3">
        <input name="name" required defaultValue={service?.name} className={inputClass} />
      </Field>
      <Field label="Price ($)" error={error('price')}>
        <input
          name="price"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={service ? service.priceCents / 100 : undefined}
          className={inputClass}
        />
      </Field>
      <Field label="Minutes" error={error('durationMinutes')}>
        <input
          name="durationMinutes"
          type="number"
          min="5"
          max="480"
          step="5"
          required
          defaultValue={service?.durationMinutes ?? 30}
          className={inputClass}
        />
      </Field>
      <Field label="Buffer" error={error('bufferMinutes')}>
        <input
          name="bufferMinutes"
          type="number"
          min="0"
          max="120"
          step="5"
          defaultValue={service?.bufferMinutes ?? 10}
          className={inputClass}
        />
      </Field>
      <Field label="Description" error={error('description')} className="sm:col-span-5">
        <input name="description" defaultValue={service?.description} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={service?.isActive ?? true}
          className="size-4"
        />
        Bookable
      </label>
      <div className="flex items-center gap-3 sm:col-span-6">
        <Button type="submit" variant={service ? 'secondary' : 'primary'} disabled={pending}>
          {pending ? 'Saving...' : service ? 'Save service' : 'Add service'}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
