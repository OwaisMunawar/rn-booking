import { Card } from '@/components/ui';

export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="space-y-1">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </Card>
  );
}
