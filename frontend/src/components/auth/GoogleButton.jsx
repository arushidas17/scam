import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { DUR, EASE_OUT } from '../../lib/motion'

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="h-[1.05rem] w-[1.05rem]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.1l3.01-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.96l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

export function GoogleButton({ onClick, loading = false, disabled = false, label }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={disabled || loading ? undefined : { scale: 0.975 }}
      transition={{ duration: DUR.snap, ease: EASE_OUT }}
      className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-pill
                 border border-hairline-strong bg-base-800/70 text-[0.88rem] font-medium
                 text-ink-primary transition-[border-color,background-color] duration-base ease-out
                 hover:border-accent/40 hover:bg-base-700
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                 focus-visible:ring-offset-2 focus-visible:ring-offset-base-900
                 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Connecting…
        </>
      ) : (
        <>
          <GoogleGlyph />
          {label}
        </>
      )}
    </motion.button>
  )
}
