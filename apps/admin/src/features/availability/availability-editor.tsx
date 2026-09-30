'use client';

import type { AvailabilityRuleInput, AvailabilityRuleKind } from '@rn-booking/shared';
import { useState, useTransition } from 'react';

import { FormMessage } from '@/components/form-message';
import { Button, cx, inputClass } from '@/components/ui';
import { saveAvailability } from '@/server/actions/catalog';
import { idle, type ActionResult } from '@/server/actions/action-state';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Monday first, the way people read a week.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

type Row = AvailabilityRuleInput & { key: number };

let nextKey = 0;
const withKey = (rule: AvailabilityRuleInput): Row => ({ ...rule, key: nextKey++ });

export function AvailabilityEditor({
  providerId,
  initialRules,
}: {
  providerId: string;
  initialRules: AvailabilityRuleInput[];
}) {
  const [rows, setRows] = useState<Row[]>(() => initialRules.map(withKey));
  const [state, setState] = useState<ActionResult>(idle);
  const [pending, startTransition] = useTransition();

  const update = (key: number, patch: Partial<AvailabilityRuleInput>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const remove = (key: number) => setRows((current) => current.filter((row) => row.key !== key));
  const add = (weekday: number, kind: AvailabilityRuleKind) =>
    setRows((current) => [
      ...current,
      withKey(
        kind === 'working'
          ? { kind, weekday, startTime: '09:00', endTime: '17:00' }
          : { kind, weekday, startTime: '12:00', endTime: '13:00' },
      ),
    ]);
  const copyMondayToWeekdays = () =>
    setRows((current) => {
      const monday = current.filter((row) => row.weekday === 1);
      const others = current.filter((row) => row.weekday === 0 || row.weekday === 6);
      return [
        ...monday,
        ...others,
        ...[2, 3, 4, 5].flatMap((weekday) => monday.map((row) => withKey({ ...row, weekday }))),
      ];
    });

  const save = () =>
    startTransition(async () => {
      const rules = rows.map(({ kind, weekday, startTime, endTime }) => ({
        kind,
        weekday,
        startTime,
        endTime,
      }));
      setState(await saveAvailability({ providerId, rules }));
    });

  return (
    <div className="space-y-4">
      <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
        {ORDER.map((weekday) => {
          const dayRows = rows
            .filter((row) => row.weekday === weekday)
            .sort((a, b) => a.kind.localeCompare(b.kind) || a.startTime.localeCompare(b.startTime));
          return (
            <div
              key={weekday}
              className="grid gap-3 p-4 md:grid-cols-[140px_1fr_auto] md:items-start"
            >
              <div className="pt-1.5">
                <p className="text-sm font-medium">{WEEKDAYS[weekday]}</p>
                {dayRows.every((row) => row.kind !== 'working') ? (
                  <p className="text-xs text-zinc-500">Closed</p>
                ) : null}
              </div>
              <div className="space-y-2">
                {dayRows.map((row) => (
                  <div key={row.key} className="flex flex-wrap items-center gap-2">
                    <span
                      className={cx(
                        'w-16 rounded-md px-2 py-1 text-center text-xs font-medium',
                        row.kind === 'working'
                          ? 'bg-brand-50 text-brand-700'
                          : 'bg-amber-50 text-amber-800',
                      )}
                    >
                      {row.kind === 'working' ? 'Open' : 'Break'}
                    </span>
                    <input
                      type="time"
                      aria-label={`${WEEKDAYS[weekday]} ${row.kind} start`}
                      value={row.startTime}
                      onChange={(e) => update(row.key, { startTime: e.target.value })}
                      className={`${inputClass} w-32`}
                    />
                    <span className="text-zinc-400">to</span>
                    <input
                      type="time"
                      aria-label={`${WEEKDAYS[weekday]} ${row.kind} end`}
                      value={row.endTime}
                      onChange={(e) => update(row.key, { endTime: e.target.value })}
                      className={`${inputClass} w-32`}
                    />
                    <button
                      type="button"
                      onClick={() => remove(row.key)}
                      className="text-sm text-zinc-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => add(weekday, 'working')}>
                  Add hours
                </Button>
                <Button type="button" variant="secondary" onClick={() => add(weekday, 'break')}>
                  Add break
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? 'Saving...' : 'Save weekly hours'}
        </Button>
        <Button type="button" variant="secondary" onClick={copyMondayToWeekdays}>
          Copy Monday to Tue-Fri
        </Button>
        <FormMessage state={state} />
      </div>
    </div>
  );
}
