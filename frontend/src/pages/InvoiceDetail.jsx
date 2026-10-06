import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import { RiskGauge } from '../components/ui/RiskGauge'
import { StatusPill } from '../components/ui/StatusPill'
import { Skeleton, SkeletonLines, LoadingRegion } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { MaskedAccount } from '../components/ui/MaskedValue'
import { useToast } from '../components/ui/useToast'
import { ScoreBreakdownBar } from '../components/risk/ScoreBreakdownBar'
import { FlagCard } from '../components/risk/FlagCard'
import { Evidence } from '../components/risk/Evidence'
import { RecommendationCard } from '../components/risk/RecommendationCard'
import { DocumentViewer } from '../components/invoice/DocumentViewer'
import { ActivityTimeline } from '../components/invoice/ActivityTimeline'
import { DecisionBar } from '../components/invoice/DecisionBar'
import { getInvoice, decideInvoice } from '../services/invoices'
import { useAsync } from '../hooks/useAsync'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { formatINR } from '../lib/format'
import { formatDate } from '../lib/time'
import { FileQuestion } from 'lucide-react'

function Panel({ title, children, className = '', action }) {
  return (
    <section className={`surface p-5 ${className}`} aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[0.9rem] font-semibold text-ink-primary">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, value, mono = true }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 last:border-0">
      <dt className="shrink-0 text-[0.78rem] text-ink-muted">{label}</dt>
      <dd className={`min-w-0 truncate text-right text-[0.8rem] text-ink-primary ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const reduced = useReducedMotion()

  const loader = useCallback(() => getInvoice(id), [id])
  const { data: invoice, loading, error } = useAsync(loader, [id])

  const [highlighted, setHighlighted] = useState(null)
  const [decision, setDecision] = useState(null)
  const [activity, setActivity] = useState(null)

  // Clear anything invoice-specific when the route moves to another invoice,
  // adopted during render rather than in an effect so there is no extra pass.
  const [lastId, setLastId] = useState(id)
  if (lastId !== id) {
    setLastId(id)
    setDecision(null)
    setActivity(null)
    setHighlighted(null)
  }

  // The choreographed entrance. Framer only applies `initial` on mount, so this
  // plays once when the invoice renders and never replays on a later update —
  // no timer needed to stop it.
  const play = !reduced

  const handleDecide = async (action, note) => {
    const result = await decideInvoice(id, action, note)
    setDecision(result.decision)
    setActivity(result.activity)

    toast({
      title: result.decision.label,
      body: `${invoice.invoiceNumber} · ${invoice.vendor}`,
      tone: action === 'approve' ? 'success' : action === 'escalate' ? 'warning' : 'info',
      action: result.nextId
        ? { label: 'Next in queue →', onClick: () => navigate(`/invoices/${result.nextId}`) }
        : null,
    })
  }

  if (loading) {
    return (
      <LoadingRegion label="Loading invoice">
        <div className="mx-auto w-full max-w-[86rem] space-y-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-80" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Skeleton className="h-[30rem] w-full rounded-card" />
            <div className="space-y-4">
              <Skeleton className="h-56 w-full rounded-card" />
              <SkeletonLines count={5} />
            </div>
          </div>
        </div>
      </LoadingRegion>
    )
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto w-full max-w-[86rem]">
        <div className="surface">
          <EmptyState
            icon={FileQuestion}
            title="That invoice could not be found"
            body="It may have been removed, or the link may be wrong."
            action={{ label: 'Back to invoices', to: '/invoices' }}
          />
        </div>
      </div>
    )
  }

  const currentDecision = decision ?? invoice.decision
  const events = activity ?? invoice.activity
  const { queue } = invoice

  const navButton =
    'inline-flex h-9 items-center gap-1.5 rounded-pill border border-hairline bg-base-900 px-3 ' +
    'text-[0.82rem] text-ink-secondary transition-colors duration-snap ease-out ' +
    'hover:border-hairline-strong hover:text-ink-primary focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-base-950 aria-disabled:cursor-not-allowed aria-disabled:opacity-40'

  return (
    <div className="mx-auto w-full max-w-[86rem] pb-24 lg:pb-0">
      {/* --- Header --- */}
      <Link
        to="/invoices"
        className="inline-flex items-center gap-1.5 rounded text-[0.82rem] text-ink-secondary
                   transition-colors duration-snap ease-out hover:text-ink-primary
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        All invoices
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-[1.3rem] font-semibold tracking-tight text-ink-primary">
              {invoice.invoiceNumber}
            </h2>
            <StatusPill status={currentDecision ? invoice.status : invoice.status} />
            {currentDecision && (
              <span className="rounded-pill border border-hairline-strong bg-base-800 px-2.5 py-1 text-[0.72rem] font-medium text-ink-primary">
                {currentDecision.label}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.86rem]">
            <Link
              to={`/vendors/${invoice.vendorId}`}
              className="inline-flex items-center gap-1.5 rounded text-accent transition-colors
                         duration-snap ease-out hover:text-accent-300 focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              {invoice.vendor}
            </Link>
            <span className="font-mono font-medium text-ink-primary">{formatINR(invoice.amount)}</span>
            <span className="text-ink-secondary">
              Due <span className="font-mono text-ink-primary">{formatDate(invoice.dueDate)}</span>
            </span>
          </div>
        </div>

        {/* Queue navigation, so a reviewer never has to go back to the list. */}
        <div className="flex shrink-0 items-center gap-2">
          {queue.position && (
            <span className="hidden font-mono text-[0.75rem] text-ink-muted sm:inline">
              {queue.position} of {queue.total} in queue
            </span>
          )}
          {queue.previousId ? (
            <Link to={`/invoices/${queue.previousId}`} className={navButton}>
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Previous
            </Link>
          ) : (
            <span className={navButton} aria-disabled="true">
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Previous
            </span>
          )}
          {queue.nextId ? (
            <Link to={`/invoices/${queue.nextId}`} className={navButton}>
              Next in queue
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <span className={navButton} aria-disabled="true">
              Next in queue
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          )}
        </div>
      </div>

      {/* --- Body --- */}
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="min-w-0 lg:sticky lg:top-[4.5rem]">
          <DocumentViewer
            invoice={invoice}
            highlighted={highlighted}
            onHighlight={setHighlighted}
          />
        </div>

        <div className="min-w-0 space-y-5">
          {/* a. Risk */}
          <Panel title="Risk">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="shrink-0 self-center">
                <RiskGauge
                  score={invoice.riskScore}
                  size={148}
                  stroke={9}
                  label="Invoice risk score"
                />
              </div>
              <div className="min-w-0 flex-1">
                <ScoreBreakdownBar
                  flags={invoice.flags}
                  score={invoice.riskScore}
                  play={play}
                />
              </div>
            </div>
          </Panel>

          {/* b. Flags */}
          {invoice.flags.length > 0 && (
            <section aria-labelledby="flags-title">
              <h3 id="flags-title" className="mb-3 text-[0.9rem] font-semibold text-ink-primary">
                Why it was flagged
              </h3>
              <ul className="space-y-2.5">
                {invoice.flags.map((flag, i) => (
                  <FlagCard
                    key={flag.id}
                    flag={flag}
                    score={invoice.riskScore}
                    index={i}
                    play={play}
                    active={highlighted === flag.field}
                    onActivate={setHighlighted}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* c. Evidence */}
          {invoice.flags.length > 0 && (
            <Panel title="Evidence">
              <div className="space-y-3">
                {invoice.flags.map((flag) => (
                  <Evidence key={flag.id} flag={flag} history={invoice.vendorHistory} />
                ))}
              </div>
            </Panel>
          )}

          {/* d. Recommendation */}
          <RecommendationCard
            recommendation={invoice.recommendation}
            play={play}
            title="AI recommendation"
          />

          {/* e. Extracted fields */}
          <Panel title="Extracted fields">
            <dl className="grid gap-x-8 sm:grid-cols-2">
              <Field label="Vendor" value={invoice.vendor} mono={false} />
              <Field label="Invoice number" value={invoice.invoiceNumber} />
              <Field label="Invoice date" value={formatDate(invoice.invoiceDate)} />
              <Field label="Due date" value={formatDate(invoice.dueDate)} />
              <Field label="Amount" value={formatINR(invoice.amount)} />
              <Field label="GST amount" value={formatINR(invoice.gstAmount)} />
              <Field label="GSTIN" value={invoice.gstin} />
              <Field label="Sender email" value={invoice.senderEmail} />
              <Field label="Bank account" value={<MaskedAccount value={invoice.bankAccount} size="sm" />} />
              <Field label="IFSC" value={invoice.ifsc} />
            </dl>
          </Panel>

          {/* f. Activity */}
          <Panel title="Activity">
            <ActivityTimeline events={events} />
          </Panel>
        </div>
      </div>

      <DecisionBar invoice={invoice} onDecide={handleDecide} decided={currentDecision} />
    </div>
  )
}
