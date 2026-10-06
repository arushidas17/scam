import { motion } from 'framer-motion'
import { Check, Landmark, ShieldAlert } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { MaskedAccount } from '../ui/MaskedValue'
import { formatDate } from '../../lib/time'
import { DUR, EASE_OUT } from '../../lib/motion'

/** Every time this vendor's payout details moved, newest first. */
export function BankChangeTimeline({ changes = [] }) {
  if (!changes.length) {
    return (
      <p className="py-6 text-center text-[0.84rem] text-ink-muted">
        This vendor&rsquo;s bank details have never changed.
      </p>
    )
  }

  return (
    <ol className="relative space-y-5">
      <span className="absolute bottom-4 left-[0.6875rem] top-4 w-px bg-hairline" aria-hidden="true" />

      {changes.map((change, i) => (
        <motion.li
          key={change.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.fast, ease: EASE_OUT, delay: Math.min(i, 6) * 0.07 }}
          className="relative flex gap-3"
        >
          <span
            className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
              change.verified
                ? 'border-risk-normal-edge bg-risk-normal-dim text-risk-normal'
                : 'border-risk-suspicious-edge bg-risk-suspicious-dim text-risk-suspicious'
            }`}
          >
            <Landmark className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="font-mono text-[0.78rem] text-ink-secondary">
                {formatDate(change.changedOn)}
              </p>
              <span
                className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[0.68rem] font-medium ${
                  change.verified
                    ? 'border-risk-normal-edge bg-risk-normal-dim text-risk-normal'
                    : 'border-risk-suspicious-edge bg-risk-suspicious-dim text-risk-suspicious'
                }`}
              >
                {change.verified ? (
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                ) : (
                  <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                )}
                {change.verified ? 'Verified' : 'Unverified'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <MaskedAccount value={change.from} label="previous account" size="sm" />
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
              <MaskedAccount value={change.to} label="new account" size="sm" />
            </div>

            <p className="mt-1.5 text-[0.76rem] text-ink-faint">{change.source}</p>
          </div>
        </motion.li>
      ))}
    </ol>
  )
}
