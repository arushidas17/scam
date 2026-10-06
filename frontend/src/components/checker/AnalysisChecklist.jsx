import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { DUR, EASE_OUT } from '../../lib/motion'

const STEPS = ['Reading message', 'Identifying vendor', 'Comparing with records', 'Scoring risk']

/**
 * Ticks the four analysis steps off while the request is in flight. The last
 * step stays in progress until the real result lands, so the checklist can never
 * claim to have finished ahead of the data.
 */
export function AnalysisChecklist({ complete = false }) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const shown = complete ? STEPS.length : index

  useEffect(() => {
    if (complete || index >= STEPS.length - 1) return
    const timer = setTimeout(() => setIndex((i) => i + 1), 420)
    return () => clearTimeout(timer)
  }, [index, complete])

  return (
    <ul className="space-y-3.5" aria-label="Analysis steps">
      {STEPS.map((step, i) => {
        const done = i < shown
        const active = i === shown && !complete

        return (
          <motion.li
            key={step}
            initial={reduced ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: DUR.snap, ease: EASE_OUT, delay: reduced ? 0 : i * 0.06 }}
            className="flex items-center gap-3"
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border
                          transition-colors duration-snap ease-out ${
                            done
                              ? 'border-accent bg-accent text-base-950'
                              : active
                                ? 'border-accent/50 bg-accent/10 text-accent'
                                : 'border-hairline bg-base-800 text-ink-faint'
                          }`}
              aria-hidden="true"
            >
              {done ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : active ? (
                <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </span>

            <span
              className={`text-[0.86rem] transition-colors duration-snap ease-out ${
                done ? 'text-ink-secondary' : active ? 'text-ink-primary' : 'text-ink-faint'
              }`}
            >
              {step}
            </span>
            <span className="sr-only">{done ? 'complete' : active ? 'in progress' : 'waiting'}</span>
          </motion.li>
        )
      })}
    </ul>
  )
}
