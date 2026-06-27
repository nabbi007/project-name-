import React from 'react';

export interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: ChartSegment[];
  centerLabel?: string;
  centerSub?: string;
  size?: number;
}

export function DonutChart({
  segments,
  centerLabel,
  centerSub,
  size = 152,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 38;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const arcs =
    total > 0
      ? segments
          .filter((s) => s.value > 0)
          .map((segment) => {
            const length = (segment.value / total) * circumference;
            const arc = (
              <circle
                key={segment.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
                className="transition-all duration-500"
              />
            );
            offset += length;
            return arc;
          })
      : [
          <circle
            key="empty"
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e7e5e4"
            strokeWidth={stroke}
          />,
        ];

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0" aria-hidden>
      {arcs}
      {centerLabel != null && (
        <>
          <text
            x="50"
            y={centerSub ? 46 : 50}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#171717"
            style={{ fontSize: '11px', fontWeight: 600 }}
          >
            {centerLabel}
          </text>
          {centerSub && (
            <text
              x="50"
              y="58"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#737373"
              style={{ fontSize: '6px' }}
            >
              {centerSub}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

export function ChartLegend({ segments }: { segments: ChartSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <ul className="space-y-2 flex-1 min-w-0">
      {segments.map((s) => {
        const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
        return (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-surface-600 flex-1 truncate text-xs">{s.label}</span>
            <span className="font-medium text-surface-900 tabular-nums text-xs">{s.value}</span>
            <span className="text-surface-400 text-xs w-7 text-right tabular-nums">{pct}%</span>
          </li>
        );
      })}
    </ul>
  );
}

interface BarItem {
  label: string;
  value: number;
  color: string;
}

export function HorizontalBarChart({ items }: { items: BarItem[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-surface-500">{item.label}</span>
            <span className="text-xs font-medium text-surface-900 tabular-nums">{item.value}</span>
          </div>
          <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.max(item.value > 0 ? 4 : 0, (item.value / max) * 100)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface DashboardChartsProps {
  farmerCount: number;
  liveCount: number;
  pendingOrders?: number;
}

export const AgentDashboardCharts: React.FC<DashboardChartsProps> = ({
  farmerCount,
  liveCount,
  pendingOrders = 0,
}) => {
  const listingSegments: ChartSegment[] = [
    { label: 'Live', value: liveCount, color: '#22c55e' },
  ];

  const overviewBars: BarItem[] = [
    { label: 'Farmers', value: farmerCount, color: '#3b82f6' },
    { label: 'Live listings', value: liveCount, color: '#22c55e' },
    { label: 'Pending orders', value: pendingOrders, color: '#a78bfa' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-900">Live listings</h2>
        <p className="text-xs text-surface-500 mt-0.5 mb-4">Published on the marketplace</p>
        <div className="flex items-center gap-5">
          <DonutChart segments={listingSegments} centerLabel={String(liveCount)} centerSub="live" />
          <ChartLegend segments={listingSegments} />
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-surface-900">Activity</h2>
        <p className="text-xs text-surface-500 mt-0.5 mb-4">Relative scale</p>
        <HorizontalBarChart items={overviewBars} />
      </div>
    </div>
  );
};

export default AgentDashboardCharts;
