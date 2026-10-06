import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useCountUp } from '../../hooks/useCountUp'
import { formatCount, formatINR } from '../../lib/format'
import { DUR, EASE_OUT } from '../../lib/motion'

/**
 * One headline number. Shared by the dashboard and the landing-page preview so
 * there is a single tile treatment in the product.
 *
 * `tone` is a risk band (colour + icon + label) or null for a neutral figure.
 * When `to` is given the whole tile becomes a link.
 */
export function StatTile({
  label,
  value,
  tone = null,
  to = null,
  currency = false,
  hint = null,
  /** Hide the hint below sm, where two tiles share a row. */
  hintFromSm = false,
  active = true,
  emphasis = false,
  className = '',
}) {
  const shown = useCountUp(value, { active })
  const display = currency ? formatINR(shown) : formatCount(shown)
  const Icon = tone?.icon

  const body = (
    <>
      <div className="flex items-center gap-2">
        {Icon ? (
          <Icon className={`h-4 w-4 shrink-0 ${tone.text}`} aria-hidden="true" strokeWidth={1.8} />
        ) : null}
        <p className="truncate text-[0.7rem] uppercase tracking-wider text-ink-muted sm:text-[0.73rem]">
          {label}
        </p>
      </div>

      <p
        className={[
          'mt-2 font-mono font-semibold tabular-nums',
          emphasis ? 'text-[1.7rem] sm:text-[2.2rem]' : 'text-[1.35rem] sm:text-[1.6rem]',
          tone ? tone.text : 'text-ink-primary',
        ].join(' ')}
      >
        {display}
      </p>

      {hint && (
        <p
          className={`mt-1.5 text-[0.76rem] leading-relaxed text-ink-secondary ${
            hintFromSm ? 'hidden sm:block' : ''
          }`}
        >
          {hint}
        </p>
      )}
    </>
  )

  const shell = [
    'block h-full rounded-card border p-4 text-left',
    tone ? `${tone.bg} ${tone.border}` : 'border-hairline bg-base-800/60',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (!to) return <div className={shell}>{body}</div>

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: DUR.snap, ease: EASE_OUT }}
      className="h-full"
    >
      <Link
        to={to}
        className={`${shell} transition-colors duration-snap ease-out hover:border-hairline-strong
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                    focus-visible:ring-offset-2 focus-visible:ring-offset-base-950`}
      >
        {body}
      </Link>
    </motion.div>
  )
}
