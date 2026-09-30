import type { LanguageModelV4Message } from '@ai-sdk/provider';
import {
  parseConciergeQuery,
  summarise,
  type ConciergeResult,
  type GetAvailabilityInput,
  type ServiceMatch,
  type Slot,
} from '@rn-booking/shared';
import { MockLanguageModelV4 } from 'ai/test';

/**
 * A deterministic stand-in for a real model, used when no API key is set.
 *
 * It behaves like a tool-calling model would: it reads the conversation,
 * calls searchServices, then getAvailability for the best matches, then writes
 * a reply from the tool results it was given. The AI SDK runs the real tools
 * in between, so demo mode exercises the same loop as production.
 */
export function createDemoConciergeModel(now: Date, timeZone: string) {
  let callCounter = 0;
  const nextId = () => `demo-call-${++callCounter}`;

  return new MockLanguageModelV4({
    provider: 'demo',
    modelId: 'rule-based-concierge',
    doGenerate: async ({ prompt }) => {
      const text = lastUserText(prompt);
      const parsed = parseConciergeQuery(text, now, timeZone);
      const { searches, availability } = readToolResults(prompt);

      if (searches.length === 0) {
        return toolCalls(
          [
            {
              toolName: 'searchServices',
              input: {
                query: parsed.query,
                category: parsed.category,
                maxPriceCents: parsed.maxPriceCents,
                nearMe: parsed.nearMe,
                limit: 4,
              },
            },
          ],
          nextId,
        );
      }

      if (availability.length === 0 && searches.flat().length > 0) {
        return toolCalls(
          searches
            .flat()
            .slice(0, 3)
            .map((service) => ({
              toolName: 'getAvailability',
              input: {
                serviceId: service.serviceId,
                date: parsed.date,
                earliest: parsed.earliest,
                latest: parsed.latest,
              } satisfies GetAvailabilityInput,
            })),
          nextId,
        );
      }

      const services = new Map(searches.flat().map((s) => [s.serviceId, s]));
      const results: ConciergeResult[] = availability.flatMap(({ input, slots }) => {
        const service = services.get(input.serviceId);
        return service && slots.length > 0 ? [{ service, date: input.date, slots }] : [];
      });
      return finish([{ type: 'text', text: summarise(results, parsed) }], 'stop');
    },
  });
}

function lastUserText(prompt: LanguageModelV4Message[]): string {
  const user = prompt.filter((m) => m.role === 'user').at(-1);
  if (!user) return '';
  return user.content.map((part) => (part.type === 'text' ? part.text : '')).join(' ');
}

interface AvailabilityCall {
  input: GetAvailabilityInput;
  slots: Slot[];
}

function readToolResults(prompt: LanguageModelV4Message[]) {
  const inputs = new Map<string, unknown>();
  for (const message of prompt) {
    if (message.role !== 'assistant') continue;
    for (const part of message.content) {
      if (part.type === 'tool-call') inputs.set(part.toolCallId, part.input);
    }
  }

  const searches: ServiceMatch[][] = [];
  const availability: AvailabilityCall[] = [];
  for (const message of prompt) {
    if (message.role !== 'tool') continue;
    for (const part of message.content) {
      if (part.type !== 'tool-result' || part.output.type !== 'json') continue;
      // Values come back from our own tools, so their shapes are known.
      if (part.toolName === 'searchServices') {
        searches.push(part.output.value as unknown as ServiceMatch[]);
      } else if (part.toolName === 'getAvailability') {
        availability.push({
          input: inputs.get(part.toolCallId) as GetAvailabilityInput,
          slots: part.output.value as unknown as Slot[],
        });
      }
    }
  }
  return { searches, availability };
}

function toolCalls(calls: { toolName: string; input: object }[], nextId: () => string) {
  return finish(
    calls.map((call) => ({
      type: 'tool-call' as const,
      toolCallId: nextId(),
      toolName: call.toolName,
      input: JSON.stringify(call.input),
    })),
    'tool-calls',
  );
}

function finish<T>(content: T[], reason: 'stop' | 'tool-calls') {
  return {
    content,
    finishReason: { unified: reason, raw: undefined },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };
}
