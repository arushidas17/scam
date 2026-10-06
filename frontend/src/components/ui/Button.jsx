import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { DUR, EASE_OUT } from '../../lib/motion'

const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-medium ' +
  'transition-[background-color,border-color,color,box-shadow] duration-base ease-out ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-base-950 ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

const variants = {
  primary:
    'bg-accent text-base-950 hover:bg-accent-300 shadow-[0_8px_28px_-12px_rgba(43,214,255,0.65)]',
  secondary:
    'border border-hairline-strong bg-base-800/70 text-ink-primary hover:border-accent/50 hover:bg-base-700',
  ghost: 'text-ink-secondary hover:bg-base-800 hover:text-ink-primary',
  outline:
    'border border-hairline-strong bg-transparent text-ink-primary hover:border-accent/50 hover:bg-base-800/60',
}

const sizes = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-[0.95rem]',
}

/**
 * One button for the whole product. Renders as <button>, <a> or <Link>
 * depending on which of `to` / `href` is passed, so semantics stay correct.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  to,
  href,
  className = '',
  // Classes for the motion wrapper around link variants — needed when the
  // button's width is responsive (e.g. "w-full sm:w-auto").
  wrapperClassName = '',
  children,
  fullWidth = false,
  ...props
}) {
  const classes = [
    base,
    variants[variant],
    sizes[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const press = {
    whileTap: props.disabled ? undefined : { scale: 0.975 },
    transition: { duration: DUR.snap, ease: EASE_OUT },
  }

  const wrapper = [fullWidth ? 'w-full' : 'inline-flex', wrapperClassName]
    .filter(Boolean)
    .join(' ')

  if (to) {
    return (
      <motion.div {...press} className={wrapper}>
        <Link to={to} className={classes} {...props}>
          {children}
        </Link>
      </motion.div>
    )
  }

  if (href) {
    return (
      <motion.div {...press} className={wrapper}>
        <a href={href} className={classes} {...props}>
          {children}
        </a>
      </motion.div>
    )
  }

  return (
    <motion.button {...press} className={classes} {...props}>
      {children}
    </motion.button>
  )
}
