import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileSearch, SearchX } from 'lucide-react'
import { PageHeader } from '../components/app/PageHeader'
import { DataTable } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { EmptyState } from '../components/ui/EmptyState'
import { RiskBadge } from '../components/ui/RiskBadge'
import { StatusPill } from '../components/ui/StatusPill'
import { Skeleton } from '../components/ui/Skeleton'
import { FilterTabs } from '../components/invoices/FilterTabs'
import { InvoiceToolbar } from '../components/invoices/InvoiceToolbar'
import { InvoiceCards } from '../components/invoices/InvoiceCards'
import { listInvoices } from '../services/invoices'
import { useAsync } from '../hooks/useAsync'
import { formatINR } from '../lib/format'
import { formatDate } from '../lib/time'

const PAGE_SIZE = 15
const VALID_STATUS = new Set(['all', 'normal', 'needs_review', 'suspicious'])

/** The review queue leads with the riskiest invoice; everything else is newest first. */
function defaultSortFor(status) {
  return status === 'needs_review'
    ? { sort: 'riskScore', direction: 'desc' }
    : { sort: 'receivedAt', direction: 'desc' }
}

export default function Invoices() {
  const [params, setParams] = useSearchParams()

  const statusParam = params.get('status') ?? 'all'
  const status = VALID_STATUS.has(statusParam) ? statusParam : 'all'
  const search = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const fallback = defaultSortFor(status)
  const sort = params.get('sort') ?? fallback.sort
  const direction = params.get('dir') ?? fallback.direction

  // Debounce the search so typing does not fire a request per keystroke.
  // When the URL's own q changes (the top-bar search, the back button), adopt
  // it during render instead of in an effect, so there is no extra pass.
  const [searchDraft, setSearchDraft] = useState(search)
  const [lastUrlSearch, setLastUrlSearch] = useState(search)
  if (lastUrlSearch !== search) {
    setLastUrlSearch(search)
    setSearchDraft(search)
  }

  const update = useCallback(
    (changes, { resetPage = true } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(changes)) {
            if (value === '' || value == null) next.delete(key)
            else next.set(key, String(value))
          }
          if (resetPage) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  useEffect(() => {
    if (searchDraft === search) return
    const timer = setTimeout(() => update({ q: searchDraft }), 280)
    return () => clearTimeout(timer)
  }, [searchDraft, search, update])

  const loader = useCallback(
    () => listInvoices({ status, search, from, to, sort, direction, page, pageSize: PAGE_SIZE }),
    [status, search, from, to, sort, direction, page],
  )

  const { data, loading } = useAsync(loader, [status, search, from, to, sort, direction, page])

  const rows = data?.rows ?? []
  const counts = data?.counts
  const hasFilters = !!(search || from || to)
  const isReviewQueue = status === 'needs_review'

  const columns = useMemo(
    () => [
      {
        key: 'invoiceNumber',
        header: 'Invoice No.',
        sortable: true,
        render: (row) => (
          <Link
            to={`/invoices/${row.id}`}
            className="font-mono text-[0.78rem] text-ink-secondary transition-colors
                       duration-snap ease-out hover:text-accent focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                       focus-visible:ring-offset-base-900"
          >
            {row.invoiceNumber}
          </Link>
        ),
      },
      {
        key: 'vendor',
        header: 'Vendor',
        sortable: true,
        render: (row) => (
          <span className="block max-w-[12rem] truncate text-[0.84rem] text-ink-primary">
            {row.vendor}
          </span>
        ),
      },
      {
        key: 'invoiceDate',
        header: 'Invoice Date',
        sortable: true,
        defaultDirection: 'desc',
        render: (row) => (
          <span className="whitespace-nowrap font-mono text-[0.78rem] text-ink-secondary">
            {formatDate(row.invoiceDate)}
          </span>
        ),
      },
      {
        key: 'dueDate',
        header: 'Due Date',
        sortable: true,
        defaultDirection: 'desc',
        render: (row) => (
          <span className="whitespace-nowrap font-mono text-[0.78rem] text-ink-secondary">
            {formatDate(row.dueDate)}
          </span>
        ),
      },
      {
        key: 'amount',
        header: 'Amount',
        sortable: true,
        align: 'right',
        defaultDirection: 'desc',
        render: (row) => (
          <span className="whitespace-nowrap font-mono text-[0.82rem] font-medium text-ink-primary">
            {formatINR(row.amount)}
          </span>
        ),
      },
      {
        key: 'riskScore',
        header: 'Risk Score',
        sortable: true,
        defaultDirection: 'desc',
        render: (row) => <RiskBadge score={row.riskScore} />,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        defaultDirection: 'desc',
        render: (row) => <StatusPill status={row.status} size="sm" />,
      },
      {
        key: 'mainFlag',
        header: 'Main flag',
        sortable: true,
        render: (row) => (
          <span className="block max-w-[10rem] truncate text-[0.8rem] text-ink-secondary">
            {row.mainFlag ?? <span className="text-ink-faint">—</span>}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <div className="mx-auto w-full max-w-[86rem] space-y-5">
      <PageHeader
        title="Invoices"
        subtitle="Every invoice received, with the score and the reason it was given."
      />

      <InvoiceToolbar
        search={searchDraft}
        onSearchChange={setSearchDraft}
        from={from}
        to={to}
        onDateChange={(key, value) => update({ [key]: value })}
        onClear={() => {
          setSearchDraft('')
          update({ q: '', from: '', to: '' })
        }}
      />

      <div className="surface overflow-hidden">
        <div className="border-b border-hairline px-2 pt-1">
          <FilterTabs
            value={status}
            counts={counts}
            onChange={(next) => {
              // Changing tab also drops a sort that belonged to the old tab.
              update({ status: next === 'all' ? '' : next, sort: '', dir: '' })
            }}
          />
        </div>

        {/* Review queue summary line */}
        {isReviewQueue && (
          <div className="border-b border-hairline bg-risk-review-dim px-4 py-2.5">
            {loading ? (
              <Skeleton className="h-3 w-72" />
            ) : (
              <p className="text-[0.82rem] text-ink-secondary">
                <span className="font-mono font-medium text-risk-review">{data.total}</span>{' '}
                {data.total === 1 ? 'invoice awaits' : 'invoices await'} review, worth{' '}
                <span className="font-mono font-medium text-ink-primary">
                  {formatINR(data.totalValue)}
                </span>{' '}
                in total.
              </p>
            )}
          </div>
        )}

        {!loading && rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No invoices match those filters"
              body="Try a different vendor or invoice number, or widen the date range."
              action={{
                label: 'Clear filters',
                onClick: () => {
                  setSearchDraft('')
                  update({ q: '', from: '', to: '' })
                },
              }}
            />
          ) : (
            <EmptyState
              icon={FileSearch}
              title="Nothing in this view yet"
              body="Invoices appear here as soon as they are uploaded and scored."
              action={{ label: 'Upload invoice', to: '/upload' }}
            />
          )
        ) : (
          <>
            {/* Table on desktop, stacked cards below lg */}
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
                caption="Invoices with risk scores and status"
                renderRowActions={
                  isReviewQueue
                    ? (row) => (
                        <Link
                          to={`/invoices/${row.id}`}
                          className="inline-flex h-8 items-center rounded-pill border
                                     border-hairline-strong px-3 text-[0.76rem] font-medium
                                     text-ink-primary opacity-0 transition-opacity duration-snap
                                     ease-out hover:border-accent/50 group-hover:opacity-100
                                     focus-visible:opacity-100 focus-visible:outline-none
                                     focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          Review
                        </Link>
                      )
                    : undefined
                }
              />
            </div>

            <div className="lg:hidden">
              <InvoiceCards rows={rows} loading={loading} />
            </div>

            {!loading && (
              <Pagination
                page={data.page}
                pageCount={data.pageCount}
                pageSize={data.pageSize}
                total={data.total}
                onChange={(next) => update({ page: next }, { resetPage: false })}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
