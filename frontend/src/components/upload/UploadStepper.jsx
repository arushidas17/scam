import { Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { DUR, EASE_OUT } from '../../lib/motion'

const UPLOAD_STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'review', label: 'Review' },
  { key: 'result', label: 'Result' },
]

/** Three-step progress header. The connector fills as steps complete. */
export function UploadStepper({ current }) {
  const index = UPLOAD_STEPS.findIndex((s) => s.key === current)

  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Upload progress">
      {UPLOAD_STEPS.map((step, i) => {
        const done = i < index
        const active = i === index

        return (
          <li key={step.key} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 last:flex-none">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={[
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[0.72rem]',
                  'transition-colors duration-snap ease-out',
                  done
                    ? 'border-accent bg-accent text-base-950'
                    : active
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-hairline-strong bg-base-800 text-ink-muted',
                ].join(' ')}
                aria-hidden="true"
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>

              <span
                className={[
                  'truncate text-[0.84rem] transition-colors duration-snap ease-out',
                  active ? 'font-medium text-ink-primary' : done ? 'text-ink-secondary' : 'text-ink-muted',
                ].join(' ')}
              >
                {step.label}
                {active && <span className="sr-only"> (current step)</span>}
              </span>
            </div>

            {i < UPLOAD_STEPS.length - 1 && (
              <div className="h-px min-w-4 flex-1 bg-hairline" aria-hidden="true">
                <motion.div
                  className="h-full w-full origin-left bg-accent"
                  initial={false}
                  animate={{ transform: `scaleX(${done ? 1 : 0})` }}
                  transition={{ duration: DUR.fast, ease: EASE_OUT }}
                />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
