import { Link } from 'react-router-dom'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, Minus } from 'lucide-react'
import { DiffText } from '../ui/DiffText'
import { diffSegments } from '../../lib/diff'
import { MaskedAccount } from '../ui/MaskedValue'
import { RISK_BANDS } from '../../lib/risk'
import { formatINR } from '../../lib/format'
import { formatDate, formatDateShort } from '../../lib/time'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/** The shell every comparison shares: label, "on record" and "on this invoice". */
function Comparison({ label, recordLabel = 'On record', incomingLabel = 'On this invoice', children }) {
  return (
    <div className="rounded-card border border-hairline bg-base-800/50 p-4">
      <p className="text-[0.73rem] uppercase tracking-wider text-ink-muted">{label}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <p className="mb-1 text-[0.72rem] text-ink-faint">{recordLabel}</p>
          {children[0]}
        </div>
        <ArrowRight
          className="hidden h-4 w-4 shrink-0 text-ink-faint sm:block"
          aria-hidden="true"
        />
        <div>
          <p className="mb-1 text-[0.72rem] text-ink-faint">{incomingLabel}</p>
          {children[1]}
        </div>
      </div>
    </div>
  )
}

function BankEvidence({ evidence, incomingLabel }) {
  return (
    <div className="space-y-3">
      <Comparison label="Bank account" incomingLabel={incomingLabel}>
        <MaskedAccount value={evidence.onRecord} label="account on record" />
        <span className="inline-flex items-center gap-2">
          <MaskedAccount value={evidence.onInvoice} label="account on this request" />
          <span className="rounded-pill border border-risk-suspicious-edge bg-risk-suspicious-dim px-2 py-0.5 text-[0.68rem] font-medium text-risk-suspicious">
            Different
          </span>
        </span>
      </Comparison>

      {evidence.ifscOnInvoice && evidence.ifscOnRecord && (
        <Comparison label="IFSC" incomingLabel={incomingLabel}>
          <DiffText segments={diffSegments(evidence.ifscOnRecord, evidence.ifscOnInvoice).a} />
          <DiffText
            segments={diffSegments(evidence.ifscOnRecord, evidence.ifscOnInvoice).b}
            tone={RISK_BANDS.suspicious}
          />
        </Comparison>
      )}

      {evidence.changedOn && (
        <p className="text-[0.78rem] text-ink-secondary">
          The account on record last changed on{' '}
          <span className="font-mono text-ink-primary">{formatDate(evidence.changedOn)}</span>.
        </p>
      )}
    </div>
  )
}

function DomainEvidence({ evidence, incomingLabel }) {
  const diff = diffSegments(evidence.onRecord, evidence.onInvoice)
  return (
    <Comparison label="Email domain" incomingLabel={incomingLabel}>
      <DiffText segments={diff.a} />
      <span className="inline-flex flex-wrap items-center gap-2">
        <DiffText segments={diff.b} tone={RISK_BANDS.suspicious} />
        {!diff.identical && (
          <span className="rounded-pill border border-risk-suspicious-edge bg-risk-suspicious-dim px-2 py-0.5 text-[0.68rem] font-medium text-risk-suspicious">
            {diff.b.middle.length === 0
              ? `${diff.a.middle.length} character${diff.a.middle.length === 1 ? '' : 's'} missing`
              : `${diff.b.middle.length} character${diff.b.middle.length === 1 ? '' : 's'} differ`}
          </span>
        )}
      </span>
    </Comparison>
  )
}

function AmountTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-card border border-hairline-strong bg-base-900 px-3 py-2 shadow-panel">
      <p className="font-mono text-[0.72rem] text-ink-secondary">{row.label}</p>
      <p className="mt-0.5 font-mono text-[0.84rem] font-medium text-ink-primary">
        {formatINR(row.amount)}
      </p>
      {row.current && (
        <p className="mt-1 text-[0.72rem] font-medium text-risk-suspicious">This invoice</p>
      )}
    </div>
  )
}

function AmountEvidence({ evidence, history = [] }) {
  const reduced = useReducedMotion()

  // The current invoice is labelled by date like every other bar; the red fill
  // and the tooltip are what mark it out, so the axis never collides.
  const data = [
    ...history.map((h) => ({ label: formatDateShort(h.date), amount: h.amount, current: false })),
    {
      label: evidence.date ? formatDateShort(evidence.date) : 'Latest',
      amount: evidence.amount,
      current: true,
    },
  ]

  return (
    <div className="rounded-card border border-hairline bg-base-800/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[0.73rem] uppercase tracking-wider text-ink-muted">Amount vs vendor average</p>
        <p className="text-[0.78rem] text-ink-secondary">
          Average{' '}
          <span className="font-mono text-ink-primary">{formatINR(evidence.average)}</span>
          {' · '}
          <span className="font-mono font-medium text-risk-suspicious">
            +{Math.round(evidence.percentAbove)}%
          </span>
        </p>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-[2px]"
          style={{ background: RISK_BANDS.suspicious.hex }}
          aria-hidden="true"
        />
        <span className="text-[0.72rem] text-ink-secondary">This invoice</span>
      </div>

      <div className="mt-3 h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: '#7382A0', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148,174,214,0.18)' }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              tick={{ fill: '#7382A0', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              tickLine={false}
              axisLine={false}
              width={46}
            />
            <Tooltip content={<AmountTooltip />} cursor={{ fill: 'rgba(148,174,214,0.07)' }} />
            <ReferenceLine
              y={evidence.average}
              stroke="#8793AD"
              strokeDasharray="4 4"
              label={{
                value: 'avg',
                position: 'insideTopLeft',
                fill: '#8793AD',
                fontSize: 10,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
            <Bar dataKey="amount" radius={[3, 3, 0, 0]} isAnimationActive={!reduced} animationDuration={450}>
              {data.map((row) => (
                <Cell
                  key={row.label}
                  fill={row.current ? RISK_BANDS.suspicious.hex : 'rgba(148,174,214,0.35)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function DuplicateEvidence({ evidence }) {
  const match = evidence.match
  if (!match) return null
  return (
    <div className="rounded-card border border-hairline bg-base-800/50 p-4">
      <p className="text-[0.73rem] uppercase tracking-wider text-ink-muted">Matching invoice</p>
      <Link
        to={`/invoices/${match.id}`}
        className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-hairline
                   bg-base-900 px-3 py-2.5 transition-colors duration-snap ease-out
                   hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base-900"
      >
        <span className="min-w-0">
          <span className="block font-mono text-[0.8rem] text-ink-primary">{match.invoiceNumber}</span>
          <span className="block text-[0.76rem] text-ink-secondary">
            {formatDate(match.invoiceDate)} · {formatINR(match.amount)}
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
      </Link>
    </div>
  )
}

function PairEvidence({ evidence, incomingLabel }) {
  const diff = diffSegments(String(evidence.onRecord), String(evidence.onInvoice))
  return (
    <Comparison label={evidence.label} incomingLabel={incomingLabel}>
      <DiffText segments={diff.a} />
      <DiffText segments={diff.b} tone={RISK_BANDS.suspicious} />
    </Comparison>
  )
}

function GenericEvidence({ evidence }) {
  return (
    <div className="flex items-start gap-2.5 rounded-card border border-hairline bg-base-800/50 p-4">
      <Minus className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
      <p className="text-[0.82rem] leading-relaxed text-ink-secondary">{evidence.detail}</p>
    </div>
  )
}

/** Picks the right comparison for a flag's evidence. */
export function Evidence({ flag, history = [], incomingLabel = 'On this invoice' }) {
  const e = flag.evidence
  if (!e) return null

  switch (e.kind) {
    case 'bank':
      return <BankEvidence evidence={e} incomingLabel={incomingLabel} />
    case 'domain':
      return <DomainEvidence evidence={e} incomingLabel={incomingLabel} />
    case 'amount':
      return <AmountEvidence evidence={e} history={history} />
    case 'duplicate':
      return <DuplicateEvidence evidence={e} />
    case 'pair':
      return <PairEvidence evidence={e} incomingLabel={incomingLabel} />
    default:
      return <GenericEvidence evidence={e} />
  }
}
