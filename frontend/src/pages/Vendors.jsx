import { useCallback, useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BadgeCheck, Building2, Landmark, Search, SearchX } from 'lucide-react'
import { PageHeader } from '../components/app/PageHeader'
import { DataTable } from '../components/ui/DataTable'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { listVendors, VENDOR_TABS } from '../services/vendors'
import { useAsync } from '../hooks/useAsync'
import { formatCount, formatINR } from '../lib/format'
import { formatDate } from '../lib/time'
import { DUR, EASE_OUT } from '../lib/motion'

const VALID_TABS = new Set(VENDOR_TABS.map((t) => t.key))

/** Vendors whose details moved recently are the ones worth a second look. */
function BankChangedBadge({ on }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill border border-risk-review-edge
                 bg-risk-review-dim px-2 py-0.5 text-[0.68rem] font-medium text-risk-review"
      title={`Bank details changed on ${formatDate(on)}`}
    >
      <Landmark className="h-3 w-3" aria-hidden="true" />
      Bank changed
    </span>
  )
}

function TrustedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-risk-normal-edge
                     bg-risk-normal-dim px-2 py-0.5 text-[0.68rem] font-medium text-risk-normal">
      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
      Trusted
    </span>
  )
}

export default function Vendors() {
  const [params, setParams] = useSearchParams()

  const tabParam = params.get('tab') ?? 'all'
  const tab = VALID_TABS.has(tabParam) ? tabParam : 'all'
  const search = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'name'
  const direction = params.get('dir') ?? 'asc'

  const [draft, setDraft] = useState(search)
  const [lastUrlSearch, setLastUrlSearch] = useState(search)
  if (lastUrlSearch !== search) {
    setLastUrlSearch(search)
    setDraft(search)
  }

  const update = useCallback(
    (changes) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(changes)) {
            if (!value) next.delete(key)
            else next.set(key, String(value))
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  useEffect(() => {
    if (draft === search) return
    const timer = setTimeout(() => update({ q: draft }), 280)
    return () => clearTimeout(timer)
  }, [draft, search, update])

  const loader = useCallback(
    () => listVendors({ tab, search, sort, direction }),
    [tab, search, sort, direction],
  )
  const { data, loading, error, reload } = useAsync(loader, [tab, search, sort, direction])

  const rows = data?.rows ?? []

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Vendor',
        sortable: true,
        render: (row) => (
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to={`/vendors/${row.id}`}
              className="truncate text-[0.85rem] font-medium text-ink-primary transition-colors
                         duration-snap ease-out hover:text-accent focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                         focus-visible:ring-offset-base-900"
            >
              {row.name}
            </Link>
            {row.trusted && <TrustedBadge />}
            {row.bankChangedRecently && <BankChangedBadge on={row.lastBankChangeOn} />}
          </div>
        ),
      },
      {
        key: 'gstin',
        header: 'GSTIN',
        sortable: true,
        render: (row) => (
          <span className="whitespace-nowrap font-mono text-[0.76rem] text-ink-secondary">
            {row.gstin}
          </span>
        ),
      },
      {
        key: 'domain',
        header: 'Email domain',
        sortable: true,
        render: (row) => (
          <span className="block max-w-[11rem] truncate font-mono text-[0.76rem] text-ink-secondary">
            {row.domain}
          </span>
        ),
      },
      {
        key: 'invoiceCount',
        header: 'Invoices',
        sortable: true,
        align: 'right',
        defaultDirection: 'desc',
        render: (row) => (
          <span className="font-mono text-[0.8rem] text-ink-primary">{formatCount(row.invoiceCount)}</span>
        ),
      },
      {
        key: 'averageAmount',
        header: 'Avg amount',
        sortable: true,
        align: 'right',
        defaultDirection: 'desc',
        render: (row) => (
          <span className="whitespace-nowrap font-mono text-[0.8rem] text-ink-primary">
            {formatINR(row.averageAmount)}
          </span>
        ),
      },
      {
        key: 'lastInvoiceDate',
        header: 'Last invoice',
        sortable: true,
        defaultDirection: 'desc',
        render: (row) => (
          <span className="whitespace-nowrap font-mono text-[0.78rem] text-ink-secondary">
            {row.lastInvoiceDate ? formatDate(row.lastInvoiceDate) : '—'}
          </span>
        ),
      },
      {
        key: 'flaggedCount',
        header: 'Flagged',
        sortable: true,
        align: 'right',
        defaultDirection: 'desc',
        render: (row) =>
          row.flaggedCount > 0 ? (
            <span className="font-mono text-[0.8rem] font-medium text-risk-review">
              {row.flaggedCount}
            </span>
          ) : (
            <span className="font-mono text-[0.8rem] text-ink-faint">0</span>
          ),
      },
    ],
    [],
  )

  return (
    <div className="mx-auto w-full max-w-[86rem] space-y-5">
      <PageHeader
        title="Vendors"
        subtitle="Who you pay, what you normally pay them, and whose details have moved."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 basis-full sm:max-w-xs sm:flex-1 sm:basis-auto">
          <label htmlFor="vendor-search" className="mb-1.5 block text-[0.76rem] text-ink-muted">
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              id="vendor-search"
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Name, domain or GSTIN"
              className="h-9 w-full rounded-lg border border-hairline bg-base-900 pl-9 pr-3
                         text-[0.84rem] text-ink-primary placeholder:text-ink-faint
                         transition-colors duration-snap ease-out focus:border-accent/60
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                         focus-visible:ring-offset-2 focus-visible:ring-offset-base-950"
            />
          </div>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="border-b border-hairline px-2 pt-1">
          <div role="tablist" aria-label="Filter vendors" className="flex gap-1 overflow-x-auto">
            {VENDOR_TABS.map((t) => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => update({ tab: t.key === 'all' ? '' : t.key })}
                  className={[
                    'relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-3 pb-2.5 pt-2',
                    'text-[0.86rem] transition-colors duration-snap ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    'focus-visible:ring-offset-2 focus-visible:ring-offset-base-950',
                    active ? 'font-medium text-ink-primary' : 'text-ink-secondary hover:text-ink-primary',
                  ].join(' ')}
                >
                  {t.label}
                  <span
                    className={`rounded-pill px-1.5 py-0.5 font-mono text-[0.68rem] ${
                      active ? 'bg-base-700 text-ink-primary' : 'bg-base-800 text-ink-muted'
                    }`}
                  >
                    {loading ? '·' : (data?.counts?.[t.key] ?? 0)}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="vendor-tab-underline"
                      className="absolute inset-x-0 -bottom-px h-[2px] rounded-pill bg-accent"
                      transition={{ duration: DUR.fast, ease: EASE_OUT }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {error ? (
          <ErrorState error={error} onRetry={reload} title="The vendor list did not load" />
        ) : !loading && rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No vendors match"
            body="Try a different name, domain or GSTIN, or switch to another tab."
            action={{ label: 'Clear search', onClick: () => { setDraft(''); update({ q: '', tab: '' }) } }}
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <DataTable
                columns={columns}
                rows={rows}
                getRowKey={(row) => row.id}
                sort={sort}
                direction={direction}
                onSortChange={(key, dir) => update({ sort: key, dir })}
                loading={loading}
                skeletonRows={8}
                caption="Vendors with invoice counts and flagged totals"
                maxHeight="calc(100dvh - 18rem)"
              />
            </div>

            {/* Stacked cards below lg */}
            <ul className="space-y-2.5 p-4 lg:hidden">
              {loading
                ? Array.from({ length: 6 }, (_, i) => (
                    <li key={i} className="surface p-4">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="mt-2.5 h-3 w-28" />
                      <Skeleton className="mt-4 h-3 w-full" />
                    </li>
                  ))
                : rows.map((row, i) => (
                    <motion.li
                      key={row.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: DUR.fast, ease: EASE_OUT, delay: Math.min(i, 10) * 0.02 }}
                    >
                      <Link
                        to={`/vendors/${row.id}`}
                        className="block rounded-card border border-hairline bg-base-900 p-4
                                   transition-colors duration-snap ease-out hover:border-hairline-strong
                                   hover:bg-base-800 focus-visible:outline-none focus-visible:ring-2
                                   focus-visible:ring-accent focus-visible:ring-offset-2
                                   focus-visible:ring-offset-base-950"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 truncate text-[0.88rem] font-medium text-ink-primary">
                            {row.name}
                          </p>
                          {row.trusted && <TrustedBadge />}
                        </div>
                        <p className="mt-0.5 font-mono text-[0.74rem] text-ink-muted">{row.domain}</p>

                        <div className="mt-3.5 flex flex-wrap items-end justify-between gap-3 border-t border-hairline pt-3">
                          <div>
                            <p className="text-[0.7rem] uppercase tracking-wider text-ink-muted">
                              Avg amount
                            </p>
                            <p className="mt-0.5 font-mono text-[0.95rem] font-semibold text-ink-primary">
                              {formatINR(row.averageAmount)}
                            </p>
                          </div>
                          <p className="font-mono text-[0.76rem] text-ink-secondary">
                            {row.invoiceCount} invoices
                            {row.flaggedCount > 0 && (
                              <span className="text-risk-review"> · {row.flaggedCount} flagged</span>
                            )}
                          </p>
                        </div>

                        {row.bankChangedRecently && (
                          <div className="mt-3">
                            <BankChangedBadge on={row.lastBankChangeOn} />
                          </div>
                        )}
                      </Link>
                    </motion.li>
                  ))}
            </ul>
          </>
        )}
      </div>

      {!loading && rows.length > 0 && (
        <p className="flex items-center gap-2 text-[0.78rem] text-ink-muted">
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          {rows.length} {rows.length === 1 ? 'vendor' : 'vendors'} shown
        </p>
      )}
    </div>
  )
}
