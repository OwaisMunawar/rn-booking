import {
  DEMO_TIME_ZONE,
  describeQuery,
  formatDateLabel,
  getAvailability,
  getAvailabilityInputSchema,
  runRuleBasedConcierge,
  searchServices,
  searchServicesInputSchema,
  toLocalDate,
  type BookingRepository,
  type ConciergeResponse,
  type ConciergeResult,
  type ParsedQuery,
  type ServiceMatch,
} from '@rn-booking/shared';
import { generateText, stepCountIs, tool, type LanguageModel } from 'ai';
import { z } from 'zod';

import { createDemoConciergeModel } from './demo-model';

export const conciergeRequestSchema = z.object({
  message: z.string().trim().min(2).max(300),
});

export interface ConciergeDeps {
  repo: BookingRepository;
  now?: Date;
  /** Marketplace timezone used to resolve "today" and weekday names. */
  timeZone?: string;
  /** Overrides model selection; tests pass a mock here. */
  model?: LanguageModel;
  env?: Record<string, string | undefined>;
}

export const DEFAULT_MODEL = 'openai/gpt-5-mini';

/** A gateway model id when AI_GATEWAY_API_KEY is set, otherwise the demo model. */
export function selectModel(deps: ConciergeDeps, now: Date, timeZone: string) {
  if (deps.model) return { model: deps.model, mode: 'live' as const };
  const env = deps.env ?? process.env;
  if (env.AI_GATEWAY_API_KEY) {
    return { model: env.CONCIERGE_MODEL ?? DEFAULT_MODEL, mode: 'live' as const };
  }
  return { model: createDemoConciergeModel(now, timeZone), mode: 'demo' as const };
}

export function buildInstructions(now: Date, timeZone: string): string {
  const today = toLocalDate(now, timeZone);
  return [
    'You are the booking concierge for a local services marketplace in Austin, Texas.',
    `Today is ${formatDateLabel(today, { weekday: 'long' })} (${today}). Resolve weekday names to the next such date on or after today.`,
    'Always call searchServices first, then getAvailability for the one to three most relevant services.',
    'Map time-of-day words to earliest/latest: morning 06:00-12:00, afternoon 12:00-17:00, evening 17:00-22:00.',
    'Prices are in US cents: "under $40" means maxPriceCents 4000. "Near me" means nearMe true.',
    'Only suggest times returned by getAvailability. Never invent providers, prices or slots.',
    'Reply in at most three short plain-text sentences. The app shows the bookable times itself.',
  ].join('\n');
}

export async function runConcierge(
  message: string,
  deps: ConciergeDeps,
): Promise<ConciergeResponse> {
  const now = deps.now ?? new Date();
  const timeZone = deps.timeZone ?? DEMO_TIME_ZONE;
  const { repo } = deps;
  const { model, mode } = selectModel(deps, now, timeZone);

  try {
    const result = await generateText({
      model,
      instructions: buildInstructions(now, timeZone),
      prompt: message,
      stopWhen: stepCountIs(4),
      tools: {
        searchServices: tool({
          description: 'Search bookable services by keyword, category, price ceiling and distance.',
          inputSchema: searchServicesInputSchema,
          execute: (input) => searchServices(repo, input),
        }),
        getAvailability: tool({
          description:
            'List open start times for one service on one date, optionally within a time window.',
          inputSchema: getAvailabilityInputSchema,
          execute: (input) => getAvailability(repo, input, now),
        }),
      },
    });

    const matches = new Map<string, ServiceMatch>();
    const results: ConciergeResult[] = [];
    const understood: Partial<ParsedQuery> = {};

    for (const step of result.steps) {
      for (const call of step.toolResults) {
        if (call.dynamic) continue;
        if (call.toolName === 'searchServices') {
          for (const match of call.output) matches.set(match.serviceId, match);
          Object.assign(understood, {
            query: call.input.query,
            category: call.input.category,
            maxPriceCents: call.input.maxPriceCents,
            nearMe: call.input.nearMe ?? false,
          });
        } else if (call.toolName === 'getAvailability') {
          const service = matches.get(call.input.serviceId);
          Object.assign(understood, {
            date: call.input.date,
            earliest: call.input.earliest,
            latest: call.input.latest,
          });
          if (service && call.output.length > 0) {
            results.push({ service, date: call.input.date, slots: call.output });
          }
        }
      }
    }

    return {
      mode,
      reply: result.text.trim(),
      results,
      interpretation: describeQuery({
        date: understood.date ?? toLocalDate(now, timeZone),
        nearMe: understood.nearMe ?? false,
        ...definedOnly(understood),
      }),
    };
  } catch (error) {
    if (mode === 'demo') throw error;
    // A provider outage should degrade the feature, not break booking.
    console.error('Concierge model call failed, falling back to rules', error);
    return runRuleBasedConcierge(repo, message, now, timeZone);
  }
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
