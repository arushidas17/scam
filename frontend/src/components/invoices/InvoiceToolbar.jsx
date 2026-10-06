import { Search, Upload, X } from 'lucide-react'
import { Button } from '../ui/Button'

/** Search, date range and the upload action. All changes lift into the URL. */
export function InvoiceToolbar({ search, onSearchChange, from, to, onDateChange, onClear }) {
  const hasFilters = search || from || to

  const dateInput =
    'h-9 w-full rounded-lg border border-hairline bg-base-900 px-2.5 font-mono text-[0.78rem] ' +
    'text-ink-primary transition-colors duration-snap ease-out focus:border-accent/60 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-base-950 ' +
    '[color-scheme:dark]'

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Search takes its own row below sm, where the date fields would
          otherwise squeeze it down to the icon. */}
      <div className="min-w-0 basis-full sm:max-w-xs sm:flex-1 sm:basis-auto">
        <label htmlFor="invoice-search" className="mb-1.5 block text-[0.76rem] text-ink-muted">
          Search
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            id="invoice-search"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Vendor or invoice number"
            className="h-9 w-full rounded-lg border border-hairline bg-base-900 pl-9 pr-3
                       text-[0.84rem] text-ink-primary placeholder:text-ink-faint
                       transition-colors duration-snap ease-out focus:border-accent/60
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                       focus-visible:ring-offset-2 focus-visible:ring-offset-base-950"
          />
        </div>
      </div>

      <div className="min-w-0 flex-1 sm:flex-none">
        <label htmlFor="invoice-from" className="mb-1.5 block text-[0.76rem] text-ink-muted">
          From
        </label>
        <input
          id="invoice-from"
          type="date"
          value={from ?? ''}
          max={to || undefined}
          onChange={(e) => onDateChange('from', e.target.value)}
          className={dateInput}
        />
      </div>

      <div className="min-w-0 flex-1 sm:flex-none">
        <label htmlFor="invoice-to" className="mb-1.5 block text-[0.76rem] text-ink-muted">
          To
        </label>
        <input
          id="invoice-to"
          type="date"
          value={to ?? ''}
          min={from || undefined}
          onChange={(e) => onDateChange('to', e.target.value)}
          className={dateInput}
        />
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[0.8rem] text-ink-muted
                     transition-colors duration-snap ease-out hover:bg-base-800 hover:text-ink-primary
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                     focus-visible:ring-offset-2 focus-visible:ring-offset-base-950"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear
        </button>
      )}

      <div className="basis-full sm:ml-auto sm:basis-auto">
        <Button
          to="/upload"
          size="sm"
          className="w-full"
          wrapperClassName="w-full sm:w-auto"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Upload invoice
        </Button>
      </div>
    </div>
  )
}
