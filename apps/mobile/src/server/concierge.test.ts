import { DEMO_TIME_ZONE, MemoryBookingRepository } from '@rn-booking/shared';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';

import { buildInstructions, runConcierge, selectModel } from './concierge';

// Wednesday 2026-10-07, 10:00 in Austin.
const NOW = new Date('2026-10-07T15:00:00Z');
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

describe('runConcierge in demo mode', () => {
  it('runs the tool loop and returns bookable slots', async () => {
    const repo = new MemoryBookingRepository({ now: () => NOW });
    const response = await runConcierge('haircut near me Saturday afternoon under $40', {
      repo,
      now: NOW,
      env: {},
    });

    expect(response.mode).toBe('demo');
    expect(response.results.length).toBeGreaterThan(0);
    for (const result of response.results) {
      expect(result.date).toBe('2026-10-10');
      expect(result.service.priceCents).toBeLessThanOrEqual(4000);
      expect(result.service.distanceKm).toBeLessThanOrEqual(5);
      expect(result.slots.every((s) => s.localTime >= '12:00' && s.localTime < '17:00')).toBe(true);
    }
    expect(response.interpretation).toContain('Sat, Oct 10');
    expect(response.reply).toContain('Saturday');
  });

  it('says so when nothing is available', async () => {
    const response = await runConcierge('massage under $5 tomorrow', {
      repo: new MemoryBookingRepository({ now: () => NOW }),
      now: NOW,
      env: {},
    });
    expect(response.results).toEqual([]);
    expect(response.reply).toMatch(/couldn't find/);
  });
});

describe('runConcierge with a live model', () => {
  it('collects results from whatever tools the model chose to call', async () => {
    const repo = new MemoryBookingRepository({ now: () => NOW });
    const [service] = await repo.listServices({ query: 'Swedish' });
    const model = new MockLanguageModelV4({
      doGenerate: [
        {
          content: [
            {
              type: 'tool-call',
              toolCallId: 'a',
              toolName: 'searchServices',
              input: JSON.stringify({ query: 'swedish massage' }),
            },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage,
          warnings: [],
        },
        {
          content: [
            {
              type: 'tool-call',
              toolCallId: 'b',
              toolName: 'getAvailability',
              input: JSON.stringify({
                serviceId: service?.id,
                date: '2026-10-08',
                earliest: '17:00',
              }),
            },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage,
          warnings: [],
        },
        {
          content: [{ type: 'text', text: 'Still Water has evening times tomorrow.' }],
          finishReason: { unified: 'stop', raw: undefined },
          usage,
          warnings: [],
        },
      ],
    });

    const response = await runConcierge('swedish massage tomorrow evening', {
      repo,
      now: NOW,
      model,
    });
    expect(response.mode).toBe('live');
    expect(response.reply).toBe('Still Water has evening times tomorrow.');
    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.service.providerName).toBe('Still Water Massage');
    expect(response.interpretation).toEqual(['swedish massage', 'Thu, Oct 8', '5:00 PM - close']);
  });

  it('falls back to rules when the provider fails', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const model = new MockLanguageModelV4({
      doGenerate: () => {
        throw new Error('gateway down');
      },
    });
    const response = await runConcierge('haircut tomorrow', {
      repo: new MemoryBookingRepository({ now: () => NOW }),
      now: NOW,
      model,
    });
    expect(response.mode).toBe('offline');
    expect(response.results.length).toBeGreaterThan(0);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe('model selection', () => {
  it('uses the gateway model when a key is present', () => {
    const repo = new MemoryBookingRepository();
    expect(selectModel({ repo, env: { AI_GATEWAY_API_KEY: 'x' } }, NOW, DEMO_TIME_ZONE)).toEqual({
      model: 'openai/gpt-5-mini',
      mode: 'live',
    });
    expect(
      selectModel(
        { repo, env: { AI_GATEWAY_API_KEY: 'x', CONCIERGE_MODEL: 'openai/gpt-5' } },
        NOW,
        DEMO_TIME_ZONE,
      ).model,
    ).toBe('openai/gpt-5');
    expect(selectModel({ repo, env: {} }, NOW, DEMO_TIME_ZONE).mode).toBe('demo');
  });

  it('grounds the model in the current date', () => {
    expect(buildInstructions(NOW, DEMO_TIME_ZONE)).toContain('Wednesday, Oct 7 (2026-10-07)');
  });
});
