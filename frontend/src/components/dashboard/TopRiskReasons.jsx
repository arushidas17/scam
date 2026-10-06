import { motion } from 'framer-motion'
import { DUR, EASE_OUT } from '../../lib/motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/** Ranked flag types, each with a count and a thin proportional bar. */
export function TopRiskReasons({ reasons = [], limit = 6 }) {
  const reduced = useReducedMotion()
  const shown = reasons.slice(0, limit)
  const max = Math.max(1, ...shown.map((r) => r.count))

  if (!shown.length) {
    return (
      <p className="py-6 text-center text-[0.84rem] text-ink-muted">
        No flags raised in this period.
      </p>
    )
  }

  return (
    <ol className="space-y-3.5">
      {shown.map((reason, index) => (
        <li key={reason.flag}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="min-w-0 truncate text-[0.84rem] text-ink-secondary">
              {reason.flag}
            </span>
            <span className="shrink-0 font-mono text-[0.82rem] font-medium text-ink-primary">
              {reason.count}
            </span>
          </div>

          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-pill bg-base-700">
            {/* Neutral accent, not a risk colour: this ranks how often a
                reason fires, which is not itself a risk level. */}
            <motion.span
              className="block h-full origin-left rounded-pill bg-accent/70"
              initial={reduced ? false : { transform: 'scaleX(0)' }}
              animate={{ transform: `scaleX(${reason.count / max})` }}
              transition={{ duration: DUR.fast, ease: EASE_OUT, delay: reduced ? 0 : index * 0.04 }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
