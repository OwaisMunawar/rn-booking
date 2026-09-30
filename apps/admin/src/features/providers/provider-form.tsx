'use client';

import { CATEGORY_LABELS, type Provider } from '@rn-booking/shared';
import { useActionState } from 'react';

import { FormMessage } from '@/components/form-message';
import { Button, Field, inputClass } from '@/components/ui';
import { saveProvider } from '@/server/actions/catalog';
import { idle } from '@/server/actions/action-state';

const TIME_ZONES = [
  'America/Chicago',
  'America/New_York',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Karachi',
];

export function ProviderForm({ provider }: { provider?: Provider }) {
  const [state, action, pending] = useActionState(saveProvider, idle);
  const error = (field: string) =>
    state.status === 'error' ? state.fieldErrors?.[field] : undefined;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {provider ? <input type="hidden" name="id" value={provider.id} /> : null}
      {provider?.userId ? <input type="hidden" name="userId" value={provider.userId} /> : null}
      <Field label="Name" error={error('name')}>
        <input name="name" required defaultValue={provider?.name} className={inputClass} />
      </Field>
      <Field label="Category" error={error('category')}>
        <select name="category" defaultValue={provider?.category ?? 'hair'} className={inputClass}>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Bio" error={error('bio')} className="sm:col-span-2">
        <textarea
          name="bio"
          rows={3}
          defaultValue={provider?.bio}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      <Field label="Neighbourhood" error={error('neighborhood')}>
        <input name="neighborhood" defaultValue={provider?.neighborhood} className={inputClass} />
      </Field>
      <Field label="Address" error={error('address')}>
        <input name="address" defaultValue={provider?.address} className={inputClass} />
      </Field>
      <Field label="Latitude" error={error('lat')}>
        <input
          name="lat"
          type="number"
          step="any"
          required
          defaultValue={provider?.lat ?? 30.2672}
          className={inputClass}
        />
      </Field>
      <Field label="Longitude" error={error('lng')}>
        <input
          name="lng"
          type="number"
          step="any"
          required
          defaultValue={provider?.lng ?? -97.7431}
          className={inputClass}
        />
      </Field>
      <Field label="Timezone" error={error('timeZone')}>
        <input
          name="timeZone"
          list="time-zones"
          required
          defaultValue={provider?.timeZone ?? 'America/Chicago'}
          className={inputClass}
        />
        <datalist id="time-zones">
          {TIME_ZONES.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={provider?.isActive ?? true}
          className="size-4"
        />
        Listed in the app
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : provider ? 'Save provider' : 'Create provider'}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
