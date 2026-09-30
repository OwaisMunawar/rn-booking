import { DEMO_USERS } from '@rn-booking/shared';
import { describe, expect, it } from 'vitest';

import { decodeDemoSession, encodeDemoSession } from './demo-cookie';

const KEY = 'test-secret';

describe('demo session cookie', () => {
  it('round-trips a user id', () => {
    expect(decodeDemoSession(encodeDemoSession(DEMO_USERS.provider, KEY), KEY)).toBe(
      DEMO_USERS.provider,
    );
  });

  it('rejects a cookie whose user id was swapped', () => {
    const [, signature] = encodeDemoSession(DEMO_USERS.provider, KEY).split('.');
    expect(decodeDemoSession(`${DEMO_USERS.admin}.${signature}`, KEY)).toBeNull();
  });

  it('rejects cookies signed with another key, and garbage', () => {
    expect(decodeDemoSession(encodeDemoSession(DEMO_USERS.admin, 'other'), KEY)).toBeNull();
    expect(decodeDemoSession('nonsense', KEY)).toBeNull();
    expect(decodeDemoSession(undefined, KEY)).toBeNull();
  });
});
