import { useState } from 'react'
import { ArrowUpCircle, Check, Loader2, XCircle } from 'lucide-react'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { StatusPill } from '../ui/StatusPill'

const ACTIONS = {
  approve: {
    label: 'Approve',
    icon: Check,
    title: 'Approve this invoice for payment?',
    confirmLabel: 'Approve for payment',
    noteRequired: false,
    noteLabel: 'Note (optional)',
    tone: 'border-risk-normal-edge text-risk-normal hover:bg-risk-normal-dim',
  },
  reject: {
    label: 'Reject',
    icon: XCircle,
    title: 'Reject this invoice?',
    confirmLabel: 'Reject invoice',
    noteRequired: true,
    noteLabel: 'Why are you rejecting it?',
    tone: 'border-risk-suspicious-edge text-risk-suspicious hover:bg-risk-suspicious-dim',
  },
  escalate: {
    label: 'Escalate',
    icon: ArrowUpCircle,
    title: 'Escalate to the finance lead?',
    confirmLabel: 'Escalate',
    noteRequired: true,
    noteLabel: 'What should they look at?',
    tone: 'border-risk-review-edge text-risk-review hover:bg-risk-review-dim',
  },
}

/**
 * The three decisions, each behind a confirmation dialog. Approving something
 * already marked Suspicious additionally requires confirming the bank details
 * were checked by phone — the one control that actually stops the fraud.
 */
export function DecisionBar({ invoice, onDecide, decided }) {
  const [action, setAction] = useState(null)
  const [note, setNote] = useState('')
  const [verified, setVerified] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const config = action ? ACTIONS[action] : null
  const needsPhoneCheck = action === 'approve' && invoice.status === 'suspicious'

  /** Opening a dialog always starts from a blank form. */
  const open = (key) => {
    setNote('')
    setVerified(false)
    setError('')
    setAction(key)
  }

  const close = () => {
    if (submitting) return
    setAction(null)
  }

  const submit = async () => {
    if (config.noteRequired && !note.trim()) {
      setError('Add a note before confirming.')
      return
    }
    if (needsPhoneCheck && !verified) {
      setError('Confirm you have verified the bank details by phone.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      // `verified` is the confirmation the backend requires before it will
      // let a suspicious invoice be approved.
      await onDecide(action, note, verified)
      setAction(null)
    } catch (err) {
      setError(err.message || 'That decision could not be recorded. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Fixed to the bottom of the screen on mobile, sticky in flow above it. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-base-950/95 px-gutter py-3
                   backdrop-blur-xl sm:px-5 lg:sticky lg:bottom-4 lg:z-20 lg:mt-6 lg:rounded-panel
                   lg:border lg:px-5 lg:shadow-panel"
      >
        <div className="mx-auto flex max-w-[86rem] flex-wrap items-center gap-3">
          <div className="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
            {decided ? (
              <p className="text-[0.84rem] text-ink-secondary">
                <span className="font-medium text-ink-primary">{decided.label}</span>
                {' · '}
                {decided.by}
              </p>
            ) : (
              <>
                <StatusPill status={invoice.status} size="sm" />
                <p className="truncate text-[0.84rem] text-ink-secondary">
                  Decide whether this payment goes out.
                </p>
              </>
            )}
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            {Object.entries(ACTIONS).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => open(key)}
                  disabled={!!decided}
                  className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-pill border
                              bg-base-900 px-4 text-[0.85rem] font-medium transition-colors duration-snap
                              ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                              focus-visible:ring-offset-2 focus-visible:ring-offset-base-950
                              disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${cfg.tone}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <Dialog
        open={!!action}
        onClose={close}
        title={config?.title ?? ''}
        description={
          config
            ? `${invoice.invoiceNumber} · ${invoice.vendor}`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" size="md" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button size="md" onClick={submit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Recording…
                </>
              ) : (
                config?.confirmLabel
              )}
            </Button>
          </>
        }
      >
        {config && (
          <div className="space-y-4">
            {needsPhoneCheck && (
              <div className="rounded-lg border border-risk-suspicious-edge bg-risk-suspicious-dim p-3.5">
                <p className="text-[0.84rem] leading-relaxed text-ink-primary">
                  This invoice is marked <span className="font-medium text-risk-suspicious">Suspicious</span>.
                  Approving it releases money to an account that does not match the vendor record.
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[0.84rem] leading-relaxed text-ink-primary">
                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                    className="checkbox mt-0.5"
                  />
                  <span>I have verified the bank details with the vendor by phone</span>
                </label>
              </div>
            )}

            <div>
              <label
                htmlFor="decision-note"
                className="mb-1.5 block text-[0.82rem] font-medium text-ink-secondary"
              >
                {config.noteLabel}
              </label>
              <textarea
                id="decision-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  config.noteRequired
                    ? 'Spoken to A. Rao on the number on record; account change not authorised.'
                    : 'Anything worth recording alongside this decision.'
                }
                className="w-full rounded-lg border border-hairline-strong bg-base-800/70 px-3 py-2.5
                           text-[0.86rem] text-ink-primary placeholder:text-ink-faint
                           transition-colors duration-snap ease-out focus:border-accent/60
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                           focus-visible:ring-offset-2 focus-visible:ring-offset-base-900"
              />
            </div>

            <div aria-live="polite" className="min-h-[1.25rem]">
              {error && <p className="text-[0.8rem] text-risk-suspicious">{error}</p>}
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}
