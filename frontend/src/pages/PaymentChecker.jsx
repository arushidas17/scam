import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle, Building2, ClipboardCheck, FileInput, Loader2, Send, ShieldQuestion, Sparkles, Trash2,
} from 'lucide-react'
import { PageHeader } from '../components/app/PageHeader'
import { Button } from '../components/ui/Button'
import { RiskGauge } from '../components/ui/RiskGauge'
import { StatusPill } from '../components/ui/StatusPill'
import { useToast } from '../components/ui/useToast'
import { ScoreBreakdownBar } from '../components/risk/ScoreBreakdownBar'
import { FlagCard } from '../components/risk/FlagCard'
import { Evidence } from '../components/risk/Evidence'
import { RecommendationCard } from '../components/risk/RecommendationCard'
import { HighlightedEmail } from '../components/checker/HighlightedEmail'
import { AnalysisChecklist } from '../components/checker/AnalysisChecklist'
import { analysePaymentRequest, sampleRequest } from '../services/paymentChecker'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { DUR, EASE_OUT } from '../lib/motion'

const field =
  'w-full rounded-lg border border-hairline-strong bg-base-800/70 px-3 text-[0.86rem] text-ink-primary ' +
  'placeholder:text-ink-faint transition-colors duration-snap ease-out focus:border-accent/60 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-base-900'

function Panel({ title, children, action, className = '' }) {
  return (
    <section className={`surface p-5 ${className}`} aria-label={title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[0.9rem] font-semibold text-ink-primary">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function PaymentChecker() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const reduced = useReducedMotion()

  const [form, setForm] = useState({ from: '', subject: '', body: '' })
  const [result, setResult] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState('')
  const resultRef = useRef(null)

  // The report subtree mounts fresh on each analysis, and Framer applies `initial`
  // only on mount, so the entrance plays once per result without a timer.
  const play = !reduced

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const analyse = async (event) => {
    event.preventDefault()
    setError('')
    setResult(null)
    setAnalysing(true)

    try {
      const report = await analysePaymentRequest(form)
      setResult(report)
      // On mobile the report sits below the form, so take the user to it.
      requestAnimationFrame(() => {
        if (window.matchMedia('(max-width: 1023px)').matches) {
          resultRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
        }
      })
    } catch (err) {
      setError(err.message || 'That message could not be analysed. Try again.')
    } finally {
      setAnalysing(false)
    }
  }

  const clear = () => {
    setForm({ from: '', subject: '', body: '' })
    setResult(null)
    setError('')
  }

  const loadSample = () => {
    setForm(sampleRequest())
    setResult(null)
    setError('')
  }

  const sendToQueue = () => {
    toast({
      title: 'Sent to the review queue',
      body: 'A reviewer will see this alongside the flagged invoices.',
      tone: 'warning',
      action: { label: 'Open review queue →', onClick: () => navigate('/invoices?status=needs_review') },
    })
  }

  return (
    <div className="mx-auto w-full max-w-[86rem] space-y-5">
      <PageHeader
        title="Payment request checker"
        subtitle="Paste an email that asks to change bank details or make a payment, and see what it is really asking for."
      />

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        {/* --- Left: the message --- */}
        <form onSubmit={analyse} className="surface p-5" noValidate>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[0.9rem] font-semibold text-ink-primary">The message</h3>
            <button
              type="button"
              onClick={loadSample}
              className="inline-flex items-center gap-1.5 rounded-pill border border-hairline
                         bg-base-900 px-3 py-1.5 text-[0.78rem] text-ink-secondary transition-colors
                         duration-snap ease-out hover:border-hairline-strong hover:text-ink-primary
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                         focus-visible:ring-offset-2 focus-visible:ring-offset-base-900"
            >
              <FileInput className="h-3.5 w-3.5" aria-hidden="true" />
              Load sample
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="checker-from" className="mb-1.5 block text-[0.82rem] font-medium text-ink-secondary">
                Sender email address
              </label>
              <input
                id="checker-from"
                type="email"
                inputMode="email"
                value={form.from}
                onChange={set('from')}
                placeholder="rajesh.kumar@vendor.in"
                className={`h-10 font-mono ${field}`}
              />
            </div>

            <div>
              <label htmlFor="checker-subject" className="mb-1.5 block text-[0.82rem] font-medium text-ink-secondary">
                Subject
              </label>
              <input
                id="checker-subject"
                type="text"
                value={form.subject}
                onChange={set('subject')}
                placeholder="Updated bank details for invoice…"
                className={`h-10 ${field}`}
              />
            </div>

            <div>
              <label htmlFor="checker-body" className="mb-1.5 block text-[0.82rem] font-medium text-ink-secondary">
                Message body
              </label>
              <textarea
                id="checker-body"
                rows={14}
                value={form.body}
                onChange={set('body')}
                placeholder="Paste the full email here, including any account numbers it contains."
                className={`py-2.5 leading-relaxed ${field}`}
              />
            </div>
          </div>

          <div aria-live="polite" className="min-h-[1.5rem]">
            {error && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-risk-suspicious-edge
                            bg-risk-suspicious-dim px-3 py-2.5 text-[0.82rem] text-risk-suspicious">
                <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2.5 border-t border-hairline pt-4 sm:flex-row">
            <Button type="submit" size="md" disabled={analysing} className="w-full sm:w-auto">
              {analysing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Analysing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Analyse
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={clear}
              disabled={analysing}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear
            </Button>
          </div>
        </form>

        {/* --- Right: the report --- */}
        <div ref={resultRef} className="space-y-5 scroll-mt-20">
          <AnimatePresence mode="wait">
            {analysing ? (
              <motion.div
                key="analysing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.fast, ease: EASE_OUT }}
              >
                <Panel title="Analysing the message">
                  <AnalysisChecklist complete={false} />
                </Panel>
              </motion.div>
            ) : !result ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.fast, ease: EASE_OUT }}
                className="surface flex flex-col items-center px-6 py-16 text-center"
              >
                <span className="grid h-14 w-14 place-items-center rounded-2xl border border-hairline bg-base-800">
                  <ShieldQuestion className="h-6 w-6 text-accent" strokeWidth={1.6} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-[1.05rem] font-semibold text-ink-primary">
                  Paste a message to check it
                </h3>
                <p className="mt-2 max-w-sm text-[0.86rem] leading-relaxed text-ink-secondary">
                  Fraud Guardian compares the sender against your vendor records, looks for pressure and
                  secrecy, and tells you what to verify before any money moves.
                </p>
                <div className="mt-6">
                  <Button type="button" variant="outline" size="md" onClick={loadSample}>
                    <FileInput className="h-4 w-4" aria-hidden="true" />
                    Load a sample request
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DUR.fast, ease: EASE_OUT }}
                className="space-y-5"
              >
                {/* 1. Score */}
                <Panel title="Risk report">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                    <div className="shrink-0 self-center">
                      <RiskGauge
                        score={result.riskScore}
                        size={140}
                        stroke={9}
                        label="Request risk score"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <dl className="space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-[0.78rem] text-ink-muted">Request type</dt>
                          <dd className="text-[0.84rem] font-medium text-ink-primary">
                            {result.requestType}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-[0.78rem] text-ink-muted">Matched vendor</dt>
                          <dd className="min-w-0 truncate text-right text-[0.84rem]">
                            {result.matchedVendor ? (
                              <Link
                                to={`/vendors/${result.matchedVendor.id}`}
                                className="inline-flex items-center gap-1.5 text-accent transition-colors
                                           duration-snap ease-out hover:text-accent-300
                                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                              >
                                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                                {result.matchedVendor.name}
                              </Link>
                            ) : (
                              <span className="text-ink-secondary">No match on record</span>
                            )}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-[0.78rem] text-ink-muted">Sender domain</dt>
                          <dd className="min-w-0 truncate text-right font-mono text-[0.8rem] text-ink-primary">
                            {result.senderDomain || '—'}
                          </dd>
                        </div>
                      </dl>

                      {result.flags.length > 0 && (
                        <ScoreBreakdownBar
                          flags={result.flags}
                          score={result.riskScore}
                          play={play}
                          baseDelay={0.2}
                        />
                      )}
                    </div>
                  </div>
                </Panel>

                {/* 2. Flags */}
                {result.flags.length > 0 ? (
                  <section aria-labelledby="checker-flags">
                    <h3 id="checker-flags" className="mb-3 text-[0.9rem] font-semibold text-ink-primary">
                      What was found
                    </h3>
                    <ul className="space-y-2.5">
                      {result.flags.map((flag, i) => (
                        <FlagCard
                          key={flag.id}
                          flag={flag}
                          score={result.riskScore}
                          index={i}
                          play={play}
                          baseDelay={0.45}
                        />
                      ))}
                    </ul>
                  </section>
                ) : (
                  <Panel title="What was found">
                    <div className="flex items-center gap-3">
                      <StatusPill status={result.status} />
                      <p className="text-[0.84rem] text-ink-secondary">
                        No fraud pattern matched this message.
                      </p>
                    </div>
                  </Panel>
                )}

                {/* 3. The message, marked up */}
                <Panel
                  title="The message"
                  action={
                    <span className="font-mono text-[0.72rem] text-ink-muted">
                      {result.highlights.length}{' '}
                      {result.highlights.length === 1 ? 'phrase marked' : 'phrases marked'}
                    </span>
                  }
                >
                  <HighlightedEmail text={result.text} highlights={result.highlights} play={play} />
                </Panel>

                {/* 4. Comparisons */}
                {result.flags.some((f) => ['domain', 'bank', 'pair'].includes(f.evidence?.kind)) && (
                  <Panel title="Compared with your records">
                    <div className="space-y-3">
                      {result.flags
                        .filter((f) => ['domain', 'bank', 'pair'].includes(f.evidence?.kind))
                        .map((flag) => (
                          <Evidence key={flag.id} flag={flag} incomingLabel="In this message" />
                        ))}
                    </div>
                  </Panel>
                )}

                {/* 5. Recommendation */}
                <RecommendationCard
                  recommendation={result.recommendation}
                  play={play}
                  delay={1.0}
                  title="Recommendation"
                />

                {/* 6. Actions */}
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Button type="button" size="md" onClick={sendToQueue} className="w-full sm:w-auto">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Send to review queue
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={clear}
                    className="w-full sm:w-auto"
                  >
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                    Clear
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
