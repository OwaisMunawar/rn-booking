/** FormData to a plain object; checkboxes become booleans, empty strings are dropped. */
export function formToObject(
  form: FormData,
  booleans: readonly string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string' && value.trim() !== '') out[key] = value.trim();
  }
  for (const key of booleans) out[key] = form.get(key) === 'on' || form.get(key) === 'true';
  return out;
}
