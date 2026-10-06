import { RiskGauge } from '../ui/RiskGauge'
import { StatusPill } from '../ui/StatusPill'
import { Button } from '../ui/Button'
import { FlagCard } from '../risk/FlagCard'
import { RecommendationCard } from '../risk/RecommendationCard'
import { ScoreBreakdownBar } from '../risk/ScoreBreakdownBar'
import { MaskedAccount } from '../ui/MaskedValue'
import { formatINR } from '../../lib/format'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/**
 * Step 3: the score, why it scored that way, and what to do about it.
 * Uses the same flag and recommendation cards as the invoice detail page, so a
 * reviewer sees one treatment wherever a score is explained.
 */
export function ResultCard({ invoice, onUploadAnother }) {
  const reduced = useReducedMotion()
  const play = !reduced

  return (
    <div className="space-y-5">
      <div className="surface-panel overflow-hidden">
        <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[auto_1fr] lg:gap-10">
          <div className="flex flex-col items-center lg:items-start">
            <RiskGauge score={invoice.riskScore} size={170} stroke={10} label="Invoice risk score" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-display-sm text-ink-primary">{invoice.vendor}</h3>
              <StatusPill status={invoice.status} />
            </div>

            <dl className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[0.8rem] text-ink-muted">Invoice number</dt>
                <dd className="font-mono text-[0.84rem] text-ink-primary">{invoice.invoiceNumber}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[0.8rem] text-ink-muted">Amount</dt>
                <dd className="font-mono text-[0.84rem] text-ink-primary">{formatINR(invoice.amount)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[0.8rem] text-ink-muted">Bank account</dt>
                <dd>
                  <MaskedAccount value={invoice.bankAccount} size="sm" />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[0.8rem] text-ink-muted">IFSC</dt>
                <dd className="font-mono text-[0.84rem] text-ink-primary">{invoice.ifsc}</dd>
              </div>
            </dl>

            <div className="mt-6">
              <ScoreBreakdownBar flags={invoice.flags} score={invoice.riskScore} play={play} />
            </div>
          </div>
        </div>
      </div>

      {invoice.flags.length > 0 && (
        <section aria-labelledby="result-flags">
          <h4 id="result-flags" className="mb-3 text-[0.9rem] font-semibold text-ink-primary">
            Why it was flagged
          </h4>
          <ul className="space-y-2.5">
            {invoice.flags.map((flag, i) => (
              <FlagCard
                key={flag.id}
                flag={flag}
                score={invoice.riskScore}
                index={i}
                play={play}
                baseDelay={0.35}
              />
            ))}
          </ul>
        </section>
      )}

      <RecommendationCard recommendation={invoice.recommendation} play={play} delay={0.9} />

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Button
          to={`/invoices/${invoice.id}`}
          size="md"
          className="w-full"
          wrapperClassName="w-full sm:w-auto"
        >
          View details
        </Button>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onUploadAnother}
          className="w-full sm:w-auto"
        >
          Upload another
        </Button>
      </div>
    </div>
  )
}
