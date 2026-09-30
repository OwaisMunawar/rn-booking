'use server';

import { bookingStatusSchema, DomainError } from '@rn-booking/shared';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canManageProvider } from '../authz';
import { getRepository } from '../repository';
import { requireSession } from '../session';
import { toResult, type ActionResult } from './result';

const schema = z.object({ bookingId: z.uuid(), status: bookingStatusSchema });

export async function setBookingStatus(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return toResult(async () => {
    const session = await requireSession();
    const { bookingId, status } = schema.parse(Object.fromEntries(form));
    const repo = await getRepository();
    const booking = await repo.getBooking(bookingId);
    if (!booking || !canManageProvider(session, booking.providerId)) {
      throw new DomainError('not_found', 'Booking not found.');
    }
    await repo.updateBookingStatus(bookingId, status);
    revalidatePath('/', 'layout');
    return `Marked as ${status.replace('_', ' ')}.`;
  });
}
