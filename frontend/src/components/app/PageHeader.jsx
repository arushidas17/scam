/** Title block at the top of a page body, with optional actions on the right. */
export function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-display-sm text-ink-primary">{title}</h2>
        {subtitle && (
          <p className="mt-1.5 text-[0.88rem] leading-relaxed text-ink-secondary">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
