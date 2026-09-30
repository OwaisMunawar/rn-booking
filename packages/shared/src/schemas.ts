import { z } from 'zod';

import { isValidTimeZone, parseTime } from './time';

export const roleSchema = z.enum(['customer', 'provider', 'admin']);
export type Role = z.infer<typeof roleSchema>;

export const categorySchema = z.enum(['hair', 'beauty', 'wellness', 'fitness', 'home', 'pets']);
export type Category = z.infer<typeof categorySchema>;

export const CATEGORY_LABELS: Record<Category, string> = {
  hair: 'Hair & barber',
  beauty: 'Nails & beauty',
  wellness: 'Massage & wellness',
  fitness: 'Fitness',
  home: 'Home services',
  pets: 'Pet care',
};

export const bookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

/** Statuses that hold a slot. Everything else frees it up again. */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed'];

export const timeZoneSchema = z
  .string()
  .refine(isValidTimeZone, { message: 'Unknown IANA timezone' });

export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-4]):[0-5]\d$/, 'Expected HH:mm')
  .refine((value) => parseTime(value) <= 24 * 60, 'Must be 24:00 or earlier');

export const isoDateSchema = z.iso.date();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const profileSchema = z.object({
  id: z.uuid(),
  fullName: z.string().min(1),
  email: z.email().nullable(),
  role: roleSchema,
});
export type Profile = z.infer<typeof profileSchema>;

export const providerSchema = z.object({
  id: z.uuid(),
  userId: z.uuid().nullable(),
  name: z.string().min(2).max(80),
  category: categorySchema,
  bio: z.string().max(500),
  neighborhood: z.string().max(80),
  address: z.string().max(160),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  timeZone: timeZoneSchema,
  isActive: z.boolean(),
});
export type Provider = z.infer<typeof providerSchema>;

export const providerInputSchema = providerSchema
  .omit({ id: true, rating: true, reviewCount: true })
  .extend({ id: z.uuid().optional() });
export type ProviderInput = z.infer<typeof providerInputSchema>;

export const serviceSchema = z.object({
  id: z.uuid(),
  providerId: z.uuid(),
  name: z.string().min(2).max(80),
  description: z.string().max(300),
  category: categorySchema,
  durationMinutes: z
    .number()
    .int()
    .min(5)
    .max(8 * 60),
  bufferMinutes: z.number().int().min(0).max(120),
  priceCents: z.number().int().nonnegative(),
  isActive: z.boolean(),
});
export type Service = z.infer<typeof serviceSchema>;

export const serviceInputSchema = serviceSchema
  .omit({ id: true })
  .extend({ id: z.uuid().optional() });
export type ServiceInput = z.infer<typeof serviceInputSchema>;

export type ServiceWithProvider = Service & { provider: Provider };

export const availabilityRuleKindSchema = z.enum(['working', 'break']);
export type AvailabilityRuleKind = z.infer<typeof availabilityRuleKindSchema>;

export const availabilityRuleInputSchema = z
  .object({
    kind: availabilityRuleKindSchema,
    weekday: z.number().int().min(0).max(6),
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
  })
  .refine((rule) => parseTime(rule.endTime) > parseTime(rule.startTime), {
    message: 'End time must be after start time',
    path: ['endTime'],
  });
export type AvailabilityRuleInput = z.infer<typeof availabilityRuleInputSchema>;

export type AvailabilityRule = AvailabilityRuleInput & { id: string; providerId: string };

export const bookingSchema = z.object({
  id: z.uuid(),
  customerId: z.uuid(),
  providerId: z.uuid(),
  serviceId: z.uuid(),
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema,
  /** End of the provider's clean-up buffer. The slot is blocked until this instant. */
  bufferEndAt: isoDateTimeSchema,
  status: bookingStatusSchema,
  priceCents: z.number().int().nonnegative(),
  notes: z.string().max(500).nullable(),
  createdAt: isoDateTimeSchema,
});
export type Booking = z.infer<typeof bookingSchema>;

export type BookingView = Booking & {
  serviceName: string;
  providerName: string;
  providerTimeZone: string;
  customerName: string;
};

export const createBookingInputSchema = z.object({
  serviceId: z.uuid(),
  startAt: isoDateTimeSchema,
  notes: z.string().max(500).optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

export const bookingFilterSchema = z.object({
  customerId: z.uuid().optional(),
  providerId: z.uuid().optional(),
  status: bookingStatusSchema.optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});
export type BookingFilter = z.infer<typeof bookingFilterSchema>;

export const serviceFilterSchema = z.object({
  query: z.string().optional(),
  category: categorySchema.optional(),
  providerId: z.uuid().optional(),
  maxPriceCents: z.number().int().nonnegative().optional(),
  includeInactive: z.boolean().optional(),
});
export type ServiceFilter = z.infer<typeof serviceFilterSchema>;
