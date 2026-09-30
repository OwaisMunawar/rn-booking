export type DomainErrorCode =
  | 'not_found'
  | 'validation'
  | 'slot_unavailable'
  | 'conflict'
  | 'unauthenticated'
  | 'forbidden'
  | 'backend';

/**
 * The one error type that crosses layer boundaries. Repositories translate
 * driver errors (Postgres codes, network failures) into these so the UI can
 * switch on `code` instead of parsing messages.
 */
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/** A user-presentable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong';
}
