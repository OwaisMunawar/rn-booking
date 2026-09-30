/** Form state shared by server actions and the client forms that call them. */
export type ActionResult =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

export const idle: ActionResult = { status: 'idle' };
