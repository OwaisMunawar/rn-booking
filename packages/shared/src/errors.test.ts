import { describe, expect, it } from 'vitest';

import { DomainError, errorMessage, isDomainError } from './errors';

describe('errors', () => {
  it('carries a code and cause', () => {
    const cause = new Error('driver');
    const error = new DomainError('conflict', 'Nope', { cause });
    expect(isDomainError(error)).toBe(true);
    expect(error.code).toBe('conflict');
    expect(error.cause).toBe(cause);
    expect(isDomainError(new Error('x'))).toBe(false);
  });

  it('produces a message for anything thrown', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage({ weird: true })).toBe('Something went wrong');
  });
});
