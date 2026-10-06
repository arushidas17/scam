import { useState } from 'react'
import { FileText, Minus, Plus, RotateCcw } from 'lucide-react'
import { formatINR } from '../../lib/format'
import { formatDate } from '../../lib/time'
import { maskAccount } from '../../lib/mask'

const ZOOMS = [0.8, 1, 1.25, 1.5, 2]

/**
 * Stand-in for a rendered document. There is no PDF renderer yet, so this draws
 * the invoice as a page; `highlighted` names the field a flag is pointing at and
 * outlines it, which is how the flag cards and the document stay tied together.
 */
/**
 * One field on the page. Outlined when a flag points at it, so a flag card and
 * the document always agree about what is being questioned.
 */
function DocRow({ field, label, value, mono = true, active, onHighlight }) {
  return (
    <div
      onMouseEnter={() => onHighlight?.(field)}
      onMouseLeave={() => onHighlight?.(null)}
      className={[
        'flex items-baseline justify-between gap-4 rounded-md px-2 py-1.5',
        'transition-colors duration-base ease-out',
        active
          ? 'bg-risk-suspicious-dim ring-1 ring-inset ring-risk-suspicious-edge'
          : 'ring-1 ring-inset ring-transparent',
      ].join(' ')}
    >
      <span className="shrink-0 text-[0.62rem] uppercase tracking-wide text-ink-faint">{label}</span>
      <span
        className={`min-w-0 truncate text-right text-[0.7rem] ${mono ? 'font-mono' : ''} ${
          active ? 'text-risk-suspicious' : 'text-ink-primary'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

export function DocumentViewer({ invoice, highlighted = null, onHighlight }) {
  const [zoomIndex, setZoomIndex] = useState(1)
  const zoom = ZOOMS[zoomIndex]

  const row = (field, label, value, mono = true) => (
    <DocRow
      field={field}
      label={label}
      value={value}
      mono={mono}
      active={highlighted === field}
      onHighlight={onHighlight}
    />
  )

  const control =
    'grid h-8 w-8 place-items-center rounded-lg border border-hairline bg-base-900 text-ink-secondary ' +
    'transition-colors duration-snap ease-out hover:border-hairline-strong hover:text-ink-primary ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ' +
    'focus-visible:ring-offset-base-900 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <section aria-label="Document preview" className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hairline bg-base-800/40 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileText className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <p className="truncate font-mono text-[0.78rem] text-ink-secondary">
            {invoice.invoiceNumber}.pdf
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className={control}
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="w-12 text-center font-mono text-[0.72rem] text-ink-muted" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className={control}
            onClick={() => setZoomIndex((i) => Math.min(ZOOMS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOMS.length - 1}
            aria-label="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={control}
            onClick={() => setZoomIndex(1)}
            disabled={zoomIndex === 1}
            aria-label="Reset zoom to 100%"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Zooming scales the page; the frame scrolls rather than reflowing. */}
      <div className="max-h-[34rem] overflow-auto bg-base-950/40 p-5">
        <div
          className="mx-auto origin-top transition-transform duration-base ease-out"
          style={{ width: '20rem', transform: `scale(${zoom})`, marginBottom: `${(zoom - 1) * 28}rem` }}
        >
          <div className="rounded-md border border-hairline bg-base-900 p-5 shadow-raised">
            <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3">
              <div className="min-w-0">
                <p className="truncate text-[0.82rem] font-semibold text-ink-primary">{invoice.vendor}</p>
                <p className="mt-0.5 font-mono text-[0.62rem] text-ink-muted">TAX INVOICE</p>
              </div>
              <p className="shrink-0 font-mono text-[0.62rem] text-ink-faint">
                {formatDate(invoice.invoiceDate)}
              </p>
            </div>

            <div className="mt-3 space-y-0.5">
              {row('vendor', 'Vendor', invoice.vendor, false)}
              {row('invoiceNumber', 'Invoice no.', invoice.invoiceNumber)}
              {row('gstin', 'GSTIN', invoice.gstin)}
              {row('senderEmail', 'From', invoice.senderEmail)}
            </div>

            <div className="mt-4 space-y-1.5 border-t border-hairline pt-3">
              {['Professional services — Q3 retainer', 'Implementation support', 'On-site visits'].map(
                (line, i) => (
                  <div key={line} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[0.66rem] text-ink-secondary">{line}</span>
                    <span className="shrink-0 font-mono text-[0.66rem] text-ink-muted">
                      {formatINR(Math.round(invoice.amount * [0.55, 0.3, 0.15][i]))}
                    </span>
                  </div>
                ),
              )}
            </div>

            <div className="mt-3 space-y-0.5 border-t border-hairline pt-3">
              {row('gstAmount', 'GST', formatINR(invoice.gstAmount))}
              {row('amount', 'Total due', formatINR(invoice.amount))}
              {row('dueDate', 'Due date', formatDate(invoice.dueDate))}
            </div>

            <div className="mt-4 space-y-0.5 rounded-md border border-hairline bg-base-800/50 p-2.5">
              <p className="mb-1 text-[0.6rem] uppercase tracking-wide text-ink-faint">Remit to</p>
              {row('bankAccount', 'Account', maskAccount(invoice.bankAccount))}
              {row('ifsc', 'IFSC', invoice.ifsc)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
