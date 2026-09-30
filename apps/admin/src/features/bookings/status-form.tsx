'use client';

import type { BookingStatus } from '@rn-booking/shared';
import { useActionState } from 'react';

import { STATUS_LABELS, inputClass } from '@/components/ui';
import { setBookingStatus } from '@/server/actions/bookings';
import { idle } from '@/server/actions/action-state';

const STATUSES = Object.keys(STATUS_LABELS) as BookingStatus[];

export function StatusForm({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
  const [state, action, pending] = useActionState(setBookingStatus, idle);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <select
        name="status"
        defaultValue={status}
        aria-label="Booking status"
        disabled={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={`${inputClass} h-8 w-32 text-xs`}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {state.status === 'error' ? (
        <span role="alert" className="text-xs text-red-600">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
