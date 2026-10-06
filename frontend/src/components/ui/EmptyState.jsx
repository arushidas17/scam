import { Button } from './Button'

/**
 * Designed empty state: says what happened, and offers the one action most
 * likely to fix it.
 */
export function EmptyState({ icon: Icon, title, body, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center px-6 py-14 text-center ${className}`}>
      {Icon && (
        <span className="grid h-12 w-12 place-items-center rounded-xl border border-hairline bg-base-800">
          <Icon className="h-5 w-5 text-ink-muted" strokeWidth={1.6} aria-hidden="true" />
        </span>
      )}
      <h3 className="mt-5 text-[1rem] font-semibold text-ink-primary">{title}</h3>
      {body && (
        <p className="mt-2 max-w-sm text-[0.86rem] leading-relaxed text-ink-secondary">{body}</p>
      )}
      {action && (
        <div className="mt-6">
          <Button variant="outline" size="md" onClick={action.onClick} to={action.to}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}
