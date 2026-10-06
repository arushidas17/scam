import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BAND_ORDER } from '../../lib/risk'
import { formatDateShort } from '../../lib/time'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const AXIS_COLOUR = '#7382A0'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0)

  return (
    <div className="rounded-card border border-hairline-strong bg-base-900 px-3 py-2.5 shadow-panel">
      <p className="font-mono text-[0.72rem] text-ink-secondary">{formatDateShort(label)}</p>
      <ul className="mt-2 space-y-1">
        {[...payload].reverse().map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-2.5 text-[0.76rem]">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: entry.color }}
              aria-hidden="true"
            />
            <span className="text-ink-secondary">{entry.name}</span>
            <span className="ml-auto font-mono font-medium text-ink-primary">{entry.value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2.5 border-t border-hairline pt-2 text-[0.76rem]">
        <span className="text-ink-muted">Total</span>
        <span className="ml-auto font-mono font-medium text-ink-primary">{total}</span>
      </div>
    </div>
  )
}

/** Stacked invoices per day for the last 14 days, split by status. */
export function InvoicesPerDayChart({ data = [] }) {
  const reduced = useReducedMotion()

  return (
    <div>
      {/* Legend pairs each colour with its label, so the stack is readable
          without relying on colour recognition alone. */}
      <ul className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {BAND_ORDER.map((band) => {
          const Icon = band.icon
          return (
            <li key={band.status} className="flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${band.text}`} aria-hidden="true" strokeWidth={1.9} />
              <span className="text-[0.76rem] text-ink-secondary">{band.label}</span>
            </li>
          )
        })}
      </ul>

      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%">
            <CartesianGrid stroke="rgba(148,174,214,0.10)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={{ fill: AXIS_COLOUR, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148,174,214,0.18)' }}
              interval="preserveStartEnd"
              minTickGap={14}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: AXIS_COLOUR, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: 'rgba(148,174,214,0.07)' }}
            />
            {BAND_ORDER.map((band, index) => (
              <Bar
                key={band.status}
                dataKey={band.status}
                name={band.label}
                stackId="invoices"
                fill={band.hex}
                // Only the top segment gets the rounded cap.
                radius={index === BAND_ORDER.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={!reduced}
                animationDuration={520}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
