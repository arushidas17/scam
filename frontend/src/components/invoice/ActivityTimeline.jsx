import { motion } from 'framer-motion'
import { Check, FileInput, ScanSearch, ShieldAlert, XCircle, ArrowUpCircle } from 'lucide-react'
import { relativeTime } from '../../lib/time'
import { DUR, EASE_OUT } from '../../lib/motion'

const ICONS = {
  uploaded: FileInput,
  analysed: ScanSearch,
  approve: Check,
  reject: XCircle,
  escalate: ArrowUpCircle,
}

const TONES = {
  approve: 'border-risk-normal-edge bg-risk-normal-dim text-risk-normal',
  reject: 'border-risk-suspicious-edge bg-risk-suspicious-dim text-risk-suspicious',
  escalate: 'border-risk-review-edge bg-risk-review-dim text-risk-review',
}

/** Vertical timeline of what happened to this invoice, oldest first. */
export function ActivityTimeline({ events = [] }) {
  return (
    <ol className="relative space-y-4">
      {/* Connector behind the markers */}
      <span
        className="absolute bottom-3 left-[0.6875rem] top-3 w-px bg-hairline"
        aria-hidden="true"
      />

      {events.map((event, i) => {
        const key = event.action ?? event.id
        const Icon = ICONS[key] ?? ShieldAlert
        const tone = TONES[event.action] ?? 'border-hairline bg-base-800 text-ink-secondary'

        return (
          <motion.li
            key={event.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.fast, ease: EASE_OUT, delay: Math.min(i, 6) * 0.05 }}
            className="relative flex gap-3"
          >
            <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${tone}`}>
              <Icon className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-[0.84rem] font-medium text-ink-primary">{event.label}</p>
                <p className="shrink-0 font-mono text-[0.7rem] text-ink-faint">
                  {relativeTime(event.at)}
                </p>
              </div>
              {event.detail && (
                <p className="mt-0.5 text-[0.78rem] leading-relaxed text-ink-secondary">{event.detail}</p>
              )}
              <p className="mt-0.5 text-[0.72rem] text-ink-faint">{event.by}</p>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
