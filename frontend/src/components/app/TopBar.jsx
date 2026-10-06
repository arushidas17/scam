import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Menu, Search } from 'lucide-react'
import { UserMenu } from './UserMenu'

/**
 * Top bar: page title, global search, notifications and the account menu.
 * Search submits to the invoices list, which owns the query in its URL.
 */
export function TopBar({ title, onOpenDrawer, alertCount = 0 }) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const inputRef = useRef(null)

  // "/" focuses search, the way every dense tool does it.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      event.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const onSubmit = (event) => {
    event.preventDefault()
    const query = term.trim()
    navigate(query ? `/invoices?q=${encodeURIComponent(query)}` : '/invoices')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-base-950/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-gutter sm:px-5 lg:px-7">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Open menu"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline
                     bg-base-900 text-ink-secondary transition-colors duration-snap ease-out
                     hover:text-ink-primary lg:hidden"
        >
          <Menu className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
        </button>

        <h1 className="shrink-0 truncate text-[0.98rem] font-semibold tracking-[-0.01em] text-ink-primary">
          {title}
        </h1>

        <form onSubmit={onSubmit} role="search" className="ml-auto hidden min-w-0 flex-1 sm:block sm:max-w-xs">
          <label htmlFor="global-search" className="sr-only">
            Search invoices by vendor or invoice number
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              id="global-search"
              ref={inputRef}
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search invoices…"
              className="h-9 w-full rounded-lg border border-hairline bg-base-900 pl-9 pr-3
                         text-[0.84rem] text-ink-primary placeholder:text-ink-faint
                         transition-colors duration-snap ease-out focus:border-accent/60
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                         focus-visible:ring-offset-2 focus-visible:ring-offset-base-950"
            />
          </div>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          <button
            type="button"
            onClick={() => navigate('/invoices?status=suspicious')}
            className="relative grid h-9 w-9 place-items-center rounded-lg border border-hairline
                       bg-base-900 text-ink-secondary transition-colors duration-snap ease-out
                       hover:border-hairline-strong hover:text-ink-primary focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                       focus-visible:ring-offset-base-950"
          >
            <Bell className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
            {alertCount > 0 && (
              <span
                className="absolute -right-1 -top-1 grid h-[1.1rem] min-w-[1.1rem] place-items-center
                           rounded-pill border border-base-950 bg-risk-suspicious px-1
                           font-mono text-[0.6rem] font-semibold text-base-950"
                aria-hidden="true"
              >
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
            <span className="sr-only">
              {alertCount > 0
                ? `Notifications: ${alertCount} invoices flagged suspicious`
                : 'Notifications'}
            </span>
          </button>

          <UserMenu />
        </div>
      </div>
    </header>
  )
}
