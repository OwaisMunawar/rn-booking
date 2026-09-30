import {
  DEMO_USERS,
  demoProfiles,
  demoProviders,
  DomainError,
  type Profile,
} from '@rn-booking/shared';
import { describe, expect, it } from 'vitest';

import {
  assertAdmin,
  assertCanManageProvider,
  canManageProvider,
  scopeBookingFilter,
  toStaffSession,
  type StaffSession,
} from './authz';

const profile = (id: string): Profile => {
  const found = demoProfiles.find((p) => p.id === id);
  if (!found) throw new Error(`No demo profile ${id}`);
  return found;
};

const FADE = demoProviders[0]?.id ?? '';
const LOFT = demoProviders[1]?.id ?? '';
const admin = toStaffSession(profile(DEMO_USERS.admin), demoProviders) as StaffSession;
const provider = toStaffSession(profile(DEMO_USERS.provider), demoProviders) as StaffSession;

describe('toStaffSession', () => {
  it('gives admins no provider scope', () => {
    expect(admin).toMatchObject({ role: 'admin', providerId: null });
  });

  it('links providers to the listing they own', () => {
    expect(provider).toMatchObject({ role: 'provider', providerId: FADE });
  });

  it('rejects customers', () => {
    expect(toStaffSession(profile(DEMO_USERS.customer), demoProviders)).toBeNull();
  });

  it('rejects provider accounts without a listing', () => {
    expect(toStaffSession(profile(DEMO_USERS.provider), [])).toBeNull();
  });
});

describe('provider scoping', () => {
  it('lets admins manage any provider', () => {
    expect(canManageProvider(admin, LOFT)).toBe(true);
    expect(() => assertAdmin(admin)).not.toThrow();
  });

  it('limits providers to their own listing', () => {
    expect(canManageProvider(provider, FADE)).toBe(true);
    expect(canManageProvider(provider, LOFT)).toBe(false);
    expect(() => assertCanManageProvider(provider, LOFT)).toThrow(DomainError);
    expect(() => assertAdmin(provider)).toThrow('Only admins');
  });

  it('overrides any provider filter a provider sends', () => {
    expect(scopeBookingFilter(provider, { providerId: LOFT, status: 'confirmed' })).toEqual({
      providerId: FADE,
      status: 'confirmed',
    });
    expect(scopeBookingFilter(admin, { providerId: LOFT })).toEqual({ providerId: LOFT });
  });
});
