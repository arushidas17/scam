import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Page controls with a plain-language range summary. */
export function Pagination({ page, pageCount, pageSize, total, onChange }) {
  if (total === 0) return null

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  const button =
    'grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-base-900 ' +
    'text-ink-secondary transition-colors duration-snap ease-out hover:border-hairline-strong ' +
    'hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-base-950 ' +
    'disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <nav
      aria-label="Invoice list pages"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3"
    >
      <p className="font-mono text-[0.76rem] text-ink-muted">
        {first}–{last} of {total}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={button}
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <span className="px-1 font-mono text-[0.78rem] text-ink-secondary" aria-current="page">
          {page} / {pageCount}
        </span>

        <button
          type="button"
          className={button}
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
