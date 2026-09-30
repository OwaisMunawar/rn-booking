import { describe, expect, it } from 'vitest';

import {
  distanceKm,
  formatDistance,
  formatClock,
  formatDateLabel,
  formatDuration,
  formatInstant,
  formatPrice,
} from './format';

describe('format', () => {
  it('formats prices without needless cents', () => {
    expect(formatPrice(3500)).toBe('$35');
    expect(formatPrice(3550)).toBe('$35.50');
  });

  it('labels calendar dates without timezone drift', () => {
    expect(formatDateLabel('2026-10-10')).toBe('Sat, Oct 10');
    expect(formatDateLabel('2026-10-10', { weekday: 'long' })).toBe('Saturday, Oct 10');
  });

  it('formats 24h times as 12h clock times', () => {
    expect(formatClock('00:15')).toBe('12:15 AM');
    expect(formatClock('12:00')).toBe('12:00 PM');
    expect(formatClock('16:45')).toBe('4:45 PM');
  });

  it('formats instants in the given zone', () => {
    expect(formatInstant('2026-10-10T19:00:00Z', 'America/Chicago')).toBe('Sat, Oct 10, 2:00 PM');
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(90)).toBe('1 hr 30 min');
  });

  it('formats distances', () => {
    expect(formatDistance(0.04)).toBe('under 0.1 km');
    expect(formatDistance(2.13)).toBe('2.1 km');
  });

  it('computes great-circle distance', () => {
    const km = distanceKm({ lat: 30.2672, lng: -97.7431 }, { lat: 30.2988, lng: -97.7057 });
    expect(km).toBeGreaterThan(4.5);
    expect(km).toBeLessThan(5.5);
  });
});
