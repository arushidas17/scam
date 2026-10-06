import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { groupDigits, maskAccount } from '../../lib/mask'

/**
 * A bank account number, masked by default with an explicit reveal toggle.
 * Everywhere an account appears it goes through here, so nothing leaks a full
 * number onto the screen by accident.
 */
export function MaskedAccount({ value, label = 'account number', className = '', size = 'md' }) {
  const [revealed, setRevealed] = useState(false)
  const id = useId()

  const text = size === 'sm' ? 'text-[0.78rem]' : 'text-[0.86rem]'

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span id={id} className={`font-mono ${text} text-ink-primary`}>
        {revealed ? groupDigits(value) : maskAccount(value)}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-pressed={revealed}
        aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-muted
                   transition-colors duration-snap ease-out hover:bg-base-700 hover:text-ink-primary
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                   focus-visible:ring-offset-2 focus-visible:ring-offset-base-900"
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
    </span>
  )
}
