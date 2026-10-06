import {
  CartesianGrid, Dot, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { bandForScore, RISK_BANDS } from '../../lib/risk'
import { formatINR } from '../../lib/format'
import { formatDate, formatDateShort } from '../../lib/time'
import { useReducedMotion } from '../../hooks/useReducedMotion'

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const band = bandForScore(row.riskScore)
  return (
    <div className="rounded-card border border-hairline-strong bg-base-900 px-3 py-2.5 shadow-panel">
      <p className="font-mono text-[0.72rem] text-ink-secondary">{row.invoiceNumber}</p>
      <p className="mt-0.5 font-mono text-[0.86rem] font-medium text-ink-primary">
        {formatINR(row.amount)}
      </p>
      <p className="mt-1 font-mono text-[0.7rem] text-ink-faint">{formatDate(row.date)}</p>
      <p className={`mt-1 text-[0.72rem] font-medium ${band.text}`}>
        {band.label} · score {row.riskScore}
      </p>
      {row.outlier && (
        <p className="mt-1 text-[0.7rem] text-ink-muted">Outside this vendor&rsquo;s usual range</p>
      )}
    </div>
  )
}

/**
 * Invoice amounts over time with the average as a dashed line. Points sit in a
 * risk colour only when the invoice itself is flagged, so the colour still means
 * risk and not merely "far from average".
 */
export function AmountTrendChart({ trend = [], average = 0 }) {
  const reduced = useReducedMotion()

  if (trend.length < 2) {
    return (
      <p className="py-10 text-center text-[0.84rem] text-ink-muted">
        Not enough invoices yet to show a trend.
      </p>
    )
  }

  // An outlier is well away from the average AND flagged — both, so the marker
  // never contradicts the status.
  const data = trend.map((row) => ({
    ...row,
    outlier: average > 0 && Math.abs(row.amount - average) / average > 0.35 && row.status !== 'normal',
  }))

  const renderDot = (props) => {
    const { cx, cy, payload, index } = props
    if (!payload.outlier) {
      return (
        <Dot key={`d-${index}`} cx={cx} cy={cy} r={2.5} fill="#2BD6FF" stroke="none" />
      )
    }
    const band = bandForScore(payload.riskScore)
    return (
      <Dot
        key={`d-${index}`}
        cx={cx}
        cy={cy}
        r={5}
        fill={band.hex}
        stroke="#0A0F1C"
        strokeWidth={2}
      />
    )
  }

  return (
    <div>
      <div className="h-60 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="rgba(148,174,214,0.10)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={{ fill: '#7382A0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148,174,214,0.18)' }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              tick={{ fill: '#7382A0', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'rgba(148,174,214,0.25)' }} />
            <ReferenceLine y={average} stroke="#8793AD" strokeDasharray="5 4" />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#2BD6FF"
              strokeWidth={2}
              dot={renderDot}
              activeDot={{ r: 5, fill: '#2BD6FF', stroke: '#0A0F1C', strokeWidth: 2 }}
              isAnimationActive={!reduced}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-pill bg-accent" aria-hidden="true" />
          <span className="text-[0.76rem] text-ink-secondary">Invoice amount</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-pill bg-ink-muted" aria-hidden="true" />
          <span className="text-[0.76rem] text-ink-secondary">
            Average <span className="font-mono text-ink-primary">{formatINR(average)}</span>
          </span>
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full border-2 border-base-900"
            style={{ background: RISK_BANDS.suspicious.hex }}
            aria-hidden="true"
          />
          <span className="text-[0.76rem] text-ink-secondary">Flagged outlier</span>
        </li>
      </ul>
    </div>
  )
}
