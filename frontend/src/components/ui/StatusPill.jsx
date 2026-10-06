import { bandForStatus } from '../../lib/risk'

/**
 * Status as colour + icon + text, always all three — colour alone must never
 * be the only thing carrying the meaning.
 */
export function StatusPill({ status, size = 'md', className = '' }) {
  const band = bandForStatus(status)
  const Icon = band.icon

  const sizes = {
    sm: 'px-2 py-0.5 text-[0.68rem] gap-1',
    md: 'px-2.5 py-1 text-[0.72rem] gap-1.5',
  }

  return (
    <span
      className={`inline-flex items-center rounded-pill border font-medium whitespace-nowrap
                  ${band.bg} ${band.border} ${band.text} ${sizes[size]} ${className}`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {band.label}
    </span>
  )
}
