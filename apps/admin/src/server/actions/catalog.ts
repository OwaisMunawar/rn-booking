'use server';

import {
  availabilityRuleInputSchema,
  providerInputSchema,
  serviceInputSchema,
} from '@rn-booking/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { assertAdmin, assertCanManageProvider } from '../authz';
import { getRepository } from '../repository';
import { requireSession } from '../session';
import { formToObject } from './form-data';
import { toResult, type ActionResult } from './result';

const providerForm = providerInputSchema.extend({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  userId: z.uuid().nullable().default(null),
  bio: z.string().max(500).default(''),
  neighborhood: z.string().max(80).default(''),
  address: z.string().max(160).default(''),
});

export async function saveProvider(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  let createdId: string | null = null;
  const result = await toResult(async () => {
    const session = await requireSession();
    const input = providerForm.parse(formToObject(form, ['isActive']));
    const repo = await getRepository();

    if (input.id) {
      assertCanManageProvider(session, input.id);
      const existing = await repo.getProvider(input.id);
      // Only admins may change who owns a listing.
      const userId = session.role === 'admin' ? input.userId : (existing?.userId ?? null);
      await repo.saveProvider({ ...input, userId });
      revalidatePath('/providers', 'layout');
      return 'Provider saved.';
    }

    assertAdmin(session);
    createdId = (await repo.saveProvider(input)).id;
    revalidatePath('/providers', 'layout');
    return 'Provider created.';
  });
  if (createdId) redirect(`/providers/${createdId}`);
  return result;
}

export async function deleteProvider(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  let deleted = false;
  const result = await toResult(async () => {
    const session = await requireSession();
    assertAdmin(session);
    const { id } = z.object({ id: z.uuid() }).parse(Object.fromEntries(form));
    await (await getRepository()).deleteProvider(id);
    deleted = true;
    revalidatePath('/providers', 'layout');
    return 'Provider deleted.';
  });
  if (deleted) redirect('/providers');
  return result;
}

const serviceForm = serviceInputSchema.extend({
  durationMinutes: z.coerce.number().int().min(5).max(480),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  price: z.coerce.number().min(0).max(10_000),
  description: z.string().max(300).default(''),
  priceCents: z.number().optional(),
});

export async function saveService(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return toResult(async () => {
    const session = await requireSession();
    const { price, ...input } = serviceForm.parse(formToObject(form, ['isActive']));
    assertCanManageProvider(session, input.providerId);
    const repo = await getRepository();
    if (input.id) {
      const existing = await repo.getService(input.id);
      // Stop a service being moved to a provider the user does not manage.
      if (existing) assertCanManageProvider(session, existing.providerId);
    }
    await repo.saveService({ ...input, priceCents: Math.round(price * 100) });
    revalidatePath(`/providers/${input.providerId}`);
    return input.id ? 'Service saved.' : 'Service added.';
  });
}

export async function deleteService(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return toResult(async () => {
    const session = await requireSession();
    const { id } = z.object({ id: z.uuid() }).parse(Object.fromEntries(form));
    const repo = await getRepository();
    const service = await repo.getService(id);
    if (!service) return 'Service already removed.';
    assertCanManageProvider(session, service.providerId);
    await repo.deleteService(id);
    revalidatePath(`/providers/${service.providerId}`);
    return 'Service deleted.';
  });
}

const availabilityPayload = z.object({
  providerId: z.uuid(),
  rules: z.array(availabilityRuleInputSchema).max(60),
});

export async function saveAvailability(
  payload: z.input<typeof availabilityPayload>,
): Promise<ActionResult> {
  return toResult(async () => {
    const session = await requireSession();
    const { providerId, rules } = availabilityPayload.parse(payload);
    assertCanManageProvider(session, providerId);
    await (await getRepository()).replaceAvailabilityRules(providerId, rules);
    revalidatePath(`/providers/${providerId}`, 'layout');
    return 'Weekly hours saved.';
  });
}
