import { motion } from 'framer-motion'
import { bandForScore } from '../../lib/risk'
import { DUR, EASE_OUT } from '../../lib/motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/**
 * One horizontal bar split into a segment per flag, sized by the points that
 * flag contributed. The segments add up to the score because the data does —
 * see the invariant in lib/mockInvoices.
 */
export function ScoreBreakdownBar({ flags = [], score, play = true, baseDelay = 0.25 }) {
  const reduced = useReducedMotion()
  const band = bandForScore(score)
  const total = Math.max(score, 1)

  if (!flags.length) {
    return (
      <div className="h-2 w-full overflow-hidden rounded-pill bg-base-700" aria-hidden="true" />
    )
  }

  return (
    <div>
      <div
        className="flex h-2 w-full gap-[2px] overflow-hidden rounded-pill bg-base-700"
        role="img"
        aria-label={`Score ${score} of 100, made up of ${flags
          .map((f) => `${f.title} ${f.points} points`)
          .join(', ')}`}
      >
        {flags.map((flag, i) => (
          <motion.span
            key={flag.id}
            className={`block h-full origin-left rounded-pill ${band.bar}`}
            style={{ width: `${(flag.points / total) * 100}%`, opacity: 1 - i * 0.22 }}
            initial={reduced || !play ? false : { transform: 'scaleX(0)' }}
            animate={{ transform: 'scaleX(1)' }}
            transition={{
              duration: DUR.fast,
              ease: EASE_OUT,
              delay: reduced || !play ? 0 : baseDelay + i * 0.14,
            }}
          />
        ))}
      </div>

      {/* Legend: points are named, not just coloured. */}
      <ul className="mt-3 space-y-1.5">
        {flags.map((flag) => (
          <li key={flag.id} className="flex items-baseline justify-between gap-3 text-[0.78rem]">
            <span className="min-w-0 truncate text-ink-secondary">{flag.title}</span>
            <span className={`shrink-0 font-mono font-medium ${band.text}`}>+{flag.points}</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 border-t border-hairline pt-1.5 text-[0.78rem]">
          <span className="text-ink-muted">Total</span>
          <span className={`shrink-0 font-mono font-semibold ${band.text}`}>{score}</span>
        </li>
      </ul>
    </div>
  )
}
