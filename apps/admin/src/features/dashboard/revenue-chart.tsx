import { formatDateLabel, formatPrice, type RevenuePoint } from '@rn-booking/shared';

const WIDTH = 640;
const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 28, left: 48 };

/** Daily completed revenue as a server-rendered SVG bar chart. No client JS. */
export function RevenueChart({ points }: { points: RevenuePoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.cents));
  // Round the axis up to a friendly number of dollars.
  const step = 10 ** Math.max(0, Math.floor(Math.log10(max / 100)));
  const top = Math.ceil(max / 100 / step) * step * 100;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(points.length, 1);
  const barW = Math.max(4, slot * 0.62);
  const y = (cents: number) => PAD.top + plotH - (cents / top) * plotH;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Completed revenue for the last ${points.length} days`}
      className="h-auto w-full"
    >
      {[0, 0.5, 1].map((fraction) => (
        <g key={fraction}>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(top * fraction)}
            y2={y(top * fraction)}
            className="stroke-zinc-200"
          />
          <text
            x={PAD.left - 8}
            y={y(top * fraction) + 4}
            textAnchor="end"
            className="fill-zinc-400 text-[11px]"
          >
            {formatPrice(top * fraction)}
          </text>
        </g>
      ))}
      {points.map((point, i) => {
        const x = PAD.left + i * slot + (slot - barW) / 2;
        return (
          <g key={point.date}>
            <rect
              x={x}
              y={y(point.cents)}
              width={barW}
              height={Math.max(0, PAD.top + plotH - y(point.cents))}
              rx={3}
              className={i === points.length - 1 ? 'fill-brand-600' : 'fill-brand-500/70'}
            >
              <title>{`${formatDateLabel(point.date)}: ${formatPrice(point.cents)}`}</title>
            </rect>
            {i % 2 === points.length % 2 ? null : (
              <text
                x={x + barW / 2}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-zinc-400 text-[11px]"
              >
                {formatDateLabel(point.date).split(', ')[1]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
