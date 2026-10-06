import { Link } from 'react-router-dom'

function Mark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" className="fill-base-800" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="6.5"
        fill="none"
        stroke="rgba(148,174,214,0.22)"
      />
      <path
        d="M16 6.5 24 9.4v6.1c0 4.6-3.2 8.4-8 10-4.8-1.6-8-5.4-8-10V9.4L16 6.5Z"
        fill="none"
        className="stroke-accent"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m12.4 15.8 2.7 2.7 4.6-5"
        fill="none"
        className="stroke-accent"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Wordmark + mark. `as="div"` when it should not be a link (e.g. in a footer heading). */
export function Logo({ className = '', markClassName, withWordmark = true, to = '/' }) {
  const inner = (
    <>
      <Mark className={markClassName} />
      {withWordmark && (
        <span className="text-[0.95rem] font-semibold tracking-[-0.01em] text-ink-primary">
          Fraud&nbsp;Guardian
        </span>
      )}
    </>
  )

  if (!to) {
    return <div className={`inline-flex items-center gap-2.5 ${className}`}>{inner}</div>
  }

  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2.5 rounded-lg transition-opacity duration-base ease-out hover:opacity-80 ${className}`}
    >
      {inner}
      {!withWordmark && <span className="sr-only">Fraud Guardian home</span>}
    </Link>
  )
}

export { Mark as LogoMark }
