import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Building2, Loader2 } from 'lucide-react'
import { StatTile } from '../components/ui/StatTile'
import { DataTable } from '../components/ui/DataTable'
import { RiskBadge } from '../components/ui/RiskBadge'
import { StatusPill } from '../components/ui/StatusPill'
import { MaskedAccount } from '../components/ui/MaskedValue'
import { Skeleton, SkeletonLines, LoadingRegion } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { useToast } from '../components/ui/useToast'
import { AmountTrendChart } from '../components/vendors/AmountTrendChart'
import { BankChangeTimeline } from '../components/vendors/BankChangeTimeline'
import { getVendor, setVendorTrusted } from '../services/vendors'
import { useAsync } from '../hooks/useAsync'
import { formatINR } from '../lib/format'
import { formatDate } from '../lib/time'
import { RISK_BANDS } from '../lib/risk'
import { Building } from 'lucide-react'

function Panel({ title, children, action, className = '' }) {
  return (
    <section className={`surface p-5 ${className}`} aria-label={title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[0.9rem] font-semibold text-ink-primary">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function VendorProfile() {
  const { id } = useParams()
  const { toast } = useToast()

  const loader = useCallback(() => getVendor(id), [id])
  const { data: vendor, loading, error, reload } = useAsync(loader, [id])

  const [trustedOverride, setTrustedOverride] = useState(null)
  const [savingTrust, setSavingTrust] = useState(false)
  const [sort, setSort] = useState('invoiceDate')
  const [direction, setDirection] = useState('desc')

  const trusted = trustedOverride ?? vendor?.trusted ?? false

  const toggleTrusted = async () => {
    const next = !trusted
    setSavingTrust(true)
    try {
      await setVendorTrusted(id, next)
      setTrustedOverride(next)
      toast({
        title: next ? 'Marked as trusted' : 'Trusted badge removed',
        body: vendor.name,
        tone: next ? 'success' : 'warning',
      })
    } finally {
      setSavingTrust(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'invoiceNumber',
        header: 'Invoice No.',
        sortable: true,
        render: (row) => (
          <Link
            to={`/invoices/${row.id}`}
            className="font-mono text-[0.78rem] text-ink-secondary transition-colors duration-snap
                       ease-out hover:text-accent focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base-900"
          >
            {row.invoiceNumber}
          </Link>
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
          <span className="block max-w-[11rem] truncate text-[0.8rem] text-ink-secondary">
            {row.mainFlag ?? <span className="text-ink-faint">—</span>}
          </span>
        ),
      },
    ],
    [],
  )

  const sortedInvoices = useMemo(() => {
    if (!vendor) return []
    const get = {
      invoiceNumber: (r) => r.invoiceNumber,
      invoiceDate: (r) => new Date(r.invoiceDate).getTime(),
      dueDate: (r) => new Date(r.dueDate).getTime(),
      amount: (r) => r.amount,
      riskScore: (r) => r.riskScore,
      status: (r) => r.riskScore,
      mainFlag: (r) => r.mainFlag ?? '',
    }[sort]

    return [...vendor.invoices].sort((a, b) => {
      const av = get(a)
      const bv = get(b)
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return direction === 'asc' ? cmp : -cmp
    })
  }, [vendor, sort, direction])

  if (loading) {
    return (
      <LoadingRegion label="Loading vendor">
        <div className="mx-auto w-full max-w-[86rem] space-y-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-72" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="surface p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-7 w-16" />
              </div>
            ))}
          </div>
          <SkeletonLines count={6} />
        </div>
      </LoadingRegion>
    )
  }

  // A 404 is a missing record; anything else is a failure worth retrying, and
  // the two deserve different screens.
  if (error && error.status !== 404) {
    return (
      <div className="mx-auto w-full max-w-[86rem]">
        <div className="surface">
          <ErrorState error={error} onRetry={reload} title="This vendor did not load" />
        </div>
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="mx-auto w-full max-w-[86rem]">
        <div className="surface">
          <EmptyState
            icon={Building}
            title="That vendor could not be found"
            body="It may have been removed, or the link may be wrong."
            action={{ label: 'Back to vendors', to: '/vendors' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[86rem] space-y-5">
      <Link
        to="/vendors"
        className="inline-flex items-center gap-1.5 rounded text-[0.82rem] text-ink-secondary
                   transition-colors duration-snap ease-out hover:text-ink-primary
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        All vendors
      </Link>

      {/* --- Header --- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-display-sm text-ink-primary">{vendor.name}</h2>
            {trusted && (
              <span className="inline-flex items-center gap-1 rounded-pill border border-risk-normal-edge
                               bg-risk-normal-dim px-2.5 py-1 text-[0.72rem] font-medium text-risk-normal">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Trusted
              </span>
            )}
          </div>

          <dl className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.82rem]">
            <div className="flex items-center gap-1.5">
              <dt className="text-ink-muted">GSTIN</dt>
              <dd className="font-mono text-ink-primary">{vendor.gstin}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-ink-muted">Domain</dt>
              <dd className="font-mono text-ink-primary">{vendor.domain}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-ink-muted">First seen</dt>
              <dd className="font-mono text-ink-primary">{formatDate(vendor.firstSeen)}</dd>
            </div>
          </dl>
        </div>

        {/* Trusted toggle — a switch, because it changes a stored judgement. */}
        <button
          type="button"
          role="switch"
          aria-checked={trusted}
          onClick={toggleTrusted}
          disabled={savingTrust}
          className="inline-flex shrink-0 items-center gap-3 rounded-pill border border-hairline
                     bg-base-900 py-2 pl-4 pr-2 transition-colors duration-snap ease-out
                     hover:border-hairline-strong focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base-950
                     disabled:opacity-60"
        >
          <span className="text-[0.84rem] text-ink-secondary">Trusted vendor</span>
          {savingTrust ? (
            <Loader2 className="h-4 w-4 animate-spin text-ink-muted" aria-hidden="true" />
          ) : (
            <span
              className={`relative h-5 w-9 shrink-0 rounded-pill transition-colors duration-snap ease-out ${
                trusted ? 'bg-accent' : 'bg-base-700'
              }`}
              aria-hidden="true"
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-base-950 transition-transform
                            duration-snap ease-out ${trusted ? 'translate-x-[1.125rem]' : 'translate-x-0.5'}`}
              />
            </span>
          )}
        </button>
      </div>

      {/* --- Stat tiles --- */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Total invoices" value={vendor.invoiceCount} />
        <StatTile label="Total value" value={vendor.totalValue} currency />
        <StatTile label="Average amount" value={vendor.averageAmount} currency />
        <StatTile
          label="Flagged invoices"
          value={vendor.flaggedCount}
          tone={vendor.flaggedCount > 0 ? RISK_BANDS.review : RISK_BANDS.normal}
          to={`/invoices?q=${encodeURIComponent(vendor.name)}&status=needs_review`}
          hintFromSm
          hint={vendor.flaggedCount > 0 ? 'Open the review queue for this vendor' : 'Nothing outstanding'}
        />
      </div>

      {/* --- Trend --- */}
      <Panel
        title="Amount trend"
        action={<span className="font-mono text-[0.72rem] text-ink-muted">All invoices</span>}
      >
        <AmountTrendChart trend={vendor.trend} average={vendor.averageAmount} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        {/* --- Current bank details --- */}
        <Panel title="Current bank details">
          <dl className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[0.8rem] text-ink-muted">Account number</dt>
              <dd>
                <MaskedAccount value={vendor.bankAccount} label="vendor account number" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-hairline pt-3">
              <dt className="text-[0.8rem] text-ink-muted">IFSC</dt>
              <dd className="font-mono text-[0.86rem] text-ink-primary">{vendor.ifsc}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-hairline pt-3">
              <dt className="text-[0.8rem] text-ink-muted">Phone on record</dt>
              <dd className="font-mono text-[0.86rem] text-ink-primary">{vendor.phoneOnRecord}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[0.76rem] leading-relaxed text-ink-faint">
            Account numbers are masked by default. Use the phone number held here — never one from an
            email — when confirming a change.
          </p>
        </Panel>

        {/* --- Bank-change history --- */}
        <Panel
          title="Bank-change history"
          action={
            <span className="font-mono text-[0.72rem] text-ink-muted">
              {vendor.bankChanges.length} {vendor.bankChanges.length === 1 ? 'change' : 'changes'}
            </span>
          }
        >
          <BankChangeTimeline changes={vendor.bankChanges} />
        </Panel>
      </div>

      {/* --- Invoice history --- */}
      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
          <h3 className="text-[0.9rem] font-semibold text-ink-primary">Invoice history</h3>
          <Link
            to={`/invoices?q=${encodeURIComponent(vendor.name)}`}
            className="inline-flex items-center gap-1.5 rounded text-[0.8rem] text-accent
                       transition-colors duration-snap ease-out hover:text-accent-300
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            Open in invoices
          </Link>
        </div>

        {sortedInvoices.length === 0 ? (
          <EmptyState
            icon={Building}
            title="No invoices yet"
            body="Invoices from this vendor will appear here once they are received and scored."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <DataTable
                columns={columns}
                rows={sortedInvoices}
                getRowKey={(row) => row.id}
                sort={sort}
                direction={direction}
                onSortChange={(key, dir) => {
                  setSort(key)
                  setDirection(dir)
                }}
                caption={`Invoices from ${vendor.name}`}
                maxHeight="32rem"
              />
            </div>

            <ul className="space-y-2.5 p-4 lg:hidden">
              {sortedInvoices.map((row) => (
                <li key={row.id}>
                  <Link
                    to={`/invoices/${row.id}`}
                    className="block rounded-card border border-hairline bg-base-900 p-4
                               transition-colors duration-snap ease-out hover:border-hairline-strong
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                               focus-visible:ring-offset-2 focus-visible:ring-offset-base-950"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-[0.8rem] text-ink-secondary">
                        {row.invoiceNumber}
                      </span>
                      <StatusPill status={row.status} size="sm" />
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <span className="font-mono text-[1rem] font-semibold text-ink-primary">
                        {formatINR(row.amount)}
                      </span>
                      <RiskBadge score={row.riskScore} />
                    </div>
                    <p className="mt-3 border-t border-hairline pt-2.5 font-mono text-[0.74rem] text-ink-muted">
                      {formatDate(row.invoiceDate)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
