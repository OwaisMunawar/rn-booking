import { DomainError, errorMessage } from '@rn-booking/shared';
import { unstable_rethrow } from 'next/navigation';
import { ZodError } from 'zod';

import type { ActionResult } from './action-state';

export type { ActionResult } from './action-state';

/**
 * Wraps a server action body so domain and validation failures come back as
 * data for the form, while redirects and notFound still propagate.
 */
export async function toResult(run: () => Promise<string>): Promise<ActionResult> {
  try {
    return { status: 'success', message: await run() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join('.');
        fieldErrors[key] ??= issue.message;
      }
      return { status: 'error', message: 'Please fix the highlighted fields.', fieldErrors };
    }
    if (error instanceof DomainError) return { status: 'error', message: error.message };
    console.error('Unexpected action failure', error);
    return { status: 'error', message: errorMessage(error) };
  }
}
