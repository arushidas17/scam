import { motion } from 'framer-motion'
import {
  Landmark, AtSign, Sigma, Copy, Users, FileSearch,
  CalendarClock, Receipt, Building2, ShieldQuestion, EyeOff,
} from 'lucide-react'
import { bandForScore } from '../../lib/risk'
import { DUR, EASE_OUT } from '../../lib/motion'

const ICONS = {
  bank_account_changed: Landmark,
  new_bank_account: Landmark,
  lookalike_domain: AtSign,
  unknown_domain: ShieldQuestion,
  amount_above_average: Sigma,
  duplicate_invoice: Copy,
  new_vendor: Users,
  gstin_mismatch: FileSearch,
  urgency_pressure: CalendarClock,
  tax_mismatch: Receipt,
  ifsc_changed: Building2,
  secrecy: EyeOff,
}

/**
 * One finding. Hovering or focusing it tells the parent which document field to
 * highlight, so the card and the document stay tied together.
 */
export function FlagCard({ flag, score, index = 0, play = true, baseDelay = 0.6, onActivate, active = false }) {
  const band = bandForScore(score)
  const Icon = ICONS[flag.id] ?? ShieldQuestion

  const notify = (value) => onActivate?.(value ? flag.field : null)

  return (
    <motion.li
      initial={play ? { opacity: 0, x: 14 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: DUR.fast, ease: EASE_OUT, delay: play ? baseDelay + index * 0.12 : 0 }}
    >
      <div
        tabIndex={onActivate ? 0 : undefined}
        role={onActivate ? 'button' : undefined}
        aria-pressed={onActivate ? active : undefined}
        onMouseEnter={() => notify(true)}
        onMouseLeave={() => notify(false)}
        onFocus={() => notify(true)}
        onBlur={() => notify(false)}
        className={[
          'rounded-card border p-4 transition-colors duration-snap ease-out',
          band.bg,
          active ? band.border.replace('/35', '/70') : band.border,
          onActivate
            ? 'cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base-900'
            : '',
        ].join(' ')}
      >
        <div className="flex items-start gap-3">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${band.border} bg-base-900/50`}
          >
            <Icon className={`h-4 w-4 ${band.text}`} strokeWidth={1.8} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-[0.9rem] font-semibold text-ink-primary">{flag.title}</h4>
              <span
                className={`shrink-0 rounded-pill border px-2 py-0.5 font-mono text-[0.72rem] font-semibold ${band.border} ${band.text}`}
              >
                +{flag.points}
                <span className="sr-only"> points</span>
              </span>
            </div>
            <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-secondary">
              {flag.explanation}
            </p>
          </div>
        </div>
      </div>
    </motion.li>
  )
}
