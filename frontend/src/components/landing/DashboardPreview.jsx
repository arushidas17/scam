import { useRef } from 'react'
import { useInView } from 'framer-motion'
import { LayoutDashboard, Info } from 'lucide-react'
import { Section, Rise, SectionHeading } from '../ui/Section'
import { StatTile } from '../ui/StatTile'
import { RISK_BANDS, bandForScore } from '../../lib/risk'

// The band is derived, never hand-set, so these rows can never disagree with
// the scoring thresholds in lib/risk.js.
const ROWS = [
  { id: 'MS/2026/0481', vendor: 'Meridian Supplies', amount: '₹4,86,500', score: 87 },
  { id: 'AK/26/1190', vendor: 'Ashok Krishnan & Co', amount: '₹1,12,400', score: 54 },
  { id: 'NVT-2026-338', vendor: 'Navtech Infra', amount: '₹68,900', score: 12 },
  { id: 'SPL/0042', vendor: 'Saptul Logistics', amount: '₹2,04,750', score: 22 },
].map((row) => ({ ...row, band: bandForScore(row.score) }))

export function DashboardPreview() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })

  return (
    <Section className="border-t border-hairline py-section lg:py-section-lg" labelledBy="preview-title">
      <div className="shell">
        <SectionHeading
          id="preview-title"
          eyebrow="Inside the product"
          title="One queue, sorted by what actually needs a human."
          lede="Your team opens a single view each morning: what cleared, what needs a second look, and how much money is sitting at risk right now."
          align="center"
        />

        <Rise className="mt-14">
          <div ref={ref} className="surface-panel overflow-hidden">
            {/* Panel chrome */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-base-800/40 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="h-4 w-4 text-accent" aria-hidden="true" />
                <span className="text-sm font-medium text-ink-primary">Today’s queue</span>
              </div>
              {/* Sample-data label, kept visible rather than tucked away */}
              <span
                className="inline-flex items-center gap-1.5 rounded-pill border border-hairline-strong
                           bg-base-900 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-wider
                           text-ink-secondary"
              >
                <Info className="h-3 w-3" aria-hidden="true" />
                Sample data
              </span>
            </div>

            <div className="p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatTile label="Invoices today" value={142} active={inView} />
                <StatTile label="Normal" value={121} tone={RISK_BANDS.normal} active={inView} />
                <StatTile label="Needs review" value={14} tone={RISK_BANDS.review} active={inView} />
                <StatTile label="Suspicious" value={7} tone={RISK_BANDS.suspicious} active={inView} />
                <StatTile
                  label="Money at risk"
                  value={842000}
                  currency
                  tone={RISK_BANDS.suspicious}
                  active={inView}
                />
              </div>

              {/* Queue table — scrolls horizontally on narrow screens */}
              <div className="mt-4 overflow-x-auto rounded-card border border-hairline">
                <table className="w-full min-w-[34rem] border-collapse text-left">
                  <caption className="sr-only">
                    Sample invoice queue with risk scores
                  </caption>
                  <thead>
                    <tr className="border-b border-hairline bg-base-800/40">
                      {['Invoice', 'Vendor', 'Amount', 'Score', 'Status'].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-4 py-2.5 text-[0.7rem] font-medium uppercase tracking-wider text-ink-muted"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-hairline last:border-0 transition-colors
                                   duration-base ease-out hover:bg-base-800/50"
                      >
                        <td className="px-4 py-3 font-mono text-[0.78rem] text-ink-secondary">
                          {row.id}
                        </td>
                        <td className="px-4 py-3 text-[0.85rem] text-ink-primary">{row.vendor}</td>
                        <td className="px-4 py-3 font-mono text-[0.82rem] text-ink-primary">
                          {row.amount}
                        </td>
                        <td className={`px-4 py-3 font-mono text-[0.85rem] font-semibold ${row.band.text}`}>
                          {row.score}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1
                                        text-[0.7rem] font-medium ${row.band.bg} ${row.band.border} ${row.band.text}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${row.band.dot}`} aria-hidden="true" />
                            {row.band.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Rise>

        <Rise as="p" className="mt-4 text-center font-mono text-[0.7rem] text-ink-faint">
          Figures shown are sample data, not customer results.
        </Rise>
      </div>
    </Section>
  )
}
