import { passwordStrength } from '../../lib/validation'

/**
 * Live strength meter. Uses the accent ramp and neutral greys on purpose —
 * red/amber/green are reserved for invoice risk, so reusing them here would
 * make "weak password" look like "suspicious invoice".
 */
export function PasswordStrength({ value }) {
  const { score, label, hint } = passwordStrength(value)
  const pct = (score / 4) * 100

  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-3">
        <div
          className="h-1 flex-1 overflow-hidden rounded-pill bg-base-700"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-label="Password strength"
          aria-valuetext={label}
        >
          {/* scaleX only, so the bar animates on the compositor */}
          <div
            className={[
              'h-full w-full origin-left rounded-pill transition-transform duration-base ease-out',
              score <= 1 ? 'bg-ink-faint' : score === 2 ? 'bg-accent-700' : score === 3 ? 'bg-accent-500' : 'bg-accent',
            ].join(' ')}
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </div>
        <span className="w-[4.5rem] shrink-0 text-right font-mono text-[0.7rem] text-ink-muted">
          {value ? label : ''}
        </span>
      </div>
      {value && hint && <p className="mt-1.5 text-[0.76rem] text-ink-muted">{hint}</p>}
    </div>
  )
}
