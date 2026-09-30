import { DomainError, type BookingFilter, type Profile, type Provider } from '@rn-booking/shared';

/**
 * Pure authorisation rules for the admin panel. Kept free of Next.js imports so
 * they are unit tested directly. In Supabase mode RLS enforces the same rules
 * again in the database.
 */

export type StaffRole = 'admin' | 'provider';

export interface StaffSession {
  userId: string;
  name: string;
  email: string | null;
  role: StaffRole;
  /** The provider a provider-role user manages. Null for admins. */
  providerId: string | null;
}

/** Builds a staff session, or null for customers and providers without a listing. */
export function toStaffSession(
  profile: Profile,
  providers: readonly Provider[],
): StaffSession | null {
  if (profile.role === 'customer') return null;
  const providerId =
    profile.role === 'provider'
      ? (providers.find((p) => p.userId === profile.id)?.id ?? null)
      : null;
  if (profile.role === 'provider' && !providerId) return null;
  return {
    userId: profile.id,
    name: profile.fullName,
    email: profile.email,
    role: profile.role,
    providerId,
  };
}

export function isAdmin(session: StaffSession): boolean {
  return session.role === 'admin';
}

export function assertAdmin(session: StaffSession): void {
  if (!isAdmin(session)) throw new DomainError('forbidden', 'Only admins can do that.');
}

export function canManageProvider(session: StaffSession, providerId: string): boolean {
  return isAdmin(session) || session.providerId === providerId;
}

export function assertCanManageProvider(session: StaffSession, providerId: string): void {
  if (!canManageProvider(session, providerId)) {
    throw new DomainError('forbidden', 'You can only manage your own listing.');
  }
}

/** Providers only ever see their own bookings, whatever filter they send. */
export function scopeBookingFilter(session: StaffSession, filter: BookingFilter): BookingFilter {
  return isAdmin(session) ? filter : { ...filter, providerId: session.providerId ?? undefined };
}
