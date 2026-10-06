import { motion } from 'framer-motion'
import { STATUS_TABS } from '../../services/invoices'
import { DUR, EASE_OUT } from '../../lib/motion'

/** Status tabs with live counts and an underline that slides between them. */
export function FilterTabs({ value, counts, onChange }) {
  return (
    <div role="tablist" aria-label="Filter by status" className="flex gap-1 overflow-x-auto">
      {STATUS_TABS.map((tab) => {
        const active = value === tab.key
        const count = counts?.[tab.key] ?? 0
        const Icon = tab.band?.icon

        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={[
              'relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 pb-2.5 pt-2',
              'text-[0.86rem] transition-colors duration-snap ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-base-950 rounded-t-lg',
              active ? 'font-medium text-ink-primary' : 'text-ink-secondary hover:text-ink-primary',
            ].join(' ')}
          >
            {Icon && (
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${active ? tab.band.text : 'text-ink-muted'}`}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            )}
            {tab.label}
            <span
              className={`rounded-pill px-1.5 py-0.5 font-mono text-[0.68rem] ${
                active ? 'bg-base-700 text-ink-primary' : 'bg-base-800 text-ink-muted'
              }`}
            >
              {count}
            </span>

            {active && (
              <motion.span
                layoutId="invoice-tab-underline"
                className="absolute inset-x-0 -bottom-px h-[2px] rounded-pill bg-accent"
                transition={{ duration: DUR.fast, ease: EASE_OUT }}
                aria-hidden="true"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
