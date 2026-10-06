import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { DUR, EASE_OUT } from '../../lib/motion'

/**
 * Labelled text input with an inline error region.
 *
 * The error is wired through aria-describedby and the region is a live region,
 * so it is announced when it appears on blur.
 */
export function Field({
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
  placeholder,
  hint,
  children,
  ...props
}) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.82rem] font-medium text-ink-secondary">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
          className={[
            'h-11 w-full rounded-lg border bg-base-800/70 px-3.5 text-[0.9rem] text-ink-primary',
            'placeholder:text-ink-faint',
            'transition-[border-color,background-color] duration-base ease-out',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-base-900',
            isPassword ? 'pr-11' : '',
            error ? 'border-risk-suspicious-edge' : 'border-hairline-strong focus:border-accent/60',
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-md
                       text-ink-muted transition-colors duration-base ease-out
                       hover:bg-base-700 hover:text-ink-primary"
          >
            {revealed ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {children}

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[0.76rem] text-ink-muted">
          {hint}
        </p>
      )}

      {/* Live region stays mounted so the error is announced when it arrives */}
      <div aria-live="polite" className="min-h-[1.15rem]">
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key={error}
              id={errorId}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR.snap, ease: EASE_OUT }}
              className="mt-1.5 flex items-start gap-1.5 text-[0.76rem] text-risk-suspicious"
            >
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
