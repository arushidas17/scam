import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '../ui/Logo'
import { AuthBrandPanel } from './AuthBrandPanel'
import { DUR, EASE_OUT } from '../../lib/motion'

/**
 * Split auth shell: brand panel on the left from lg up, form on the right.
 * Below lg the brand panel is not rendered at all and only the form shows.
 */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh bg-base-950 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <AuthBrandPanel />

      <main className="flex min-h-dvh flex-col px-gutter py-8 sm:px-6 lg:px-10 xl:px-16">
        {/* my-auto rather than justify-center: a card taller than the viewport then
              scrolls instead of having its top clipped out of reach. */}
          <div className="mx-auto w-full max-w-[26rem] lg:my-auto lg:py-10">
          {/* Mobile-only header: brand + a way back to the landing page */}
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo />
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-[0.8rem]
                         text-ink-secondary transition-colors duration-base ease-out
                         hover:text-ink-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Home
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.base, ease: EASE_OUT }}
            className="surface-panel p-6 sm:p-8"
          >
            <h1 className="text-display-sm text-ink-primary">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-secondary">{subtitle}</p>
            )}

            <div className="mt-7">{children}</div>
          </motion.div>

          {footer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DUR.base, ease: EASE_OUT, delay: 0.1 }}
              className="mt-6 text-center text-[0.85rem] text-ink-secondary"
            >
              {footer}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}

/** Shared "or" rule between the Google button and the email form. */
export function AuthDivider({ label = 'or' }) {
  return (
    <div className="my-6 flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-hairline" />
      <span className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  )
}
