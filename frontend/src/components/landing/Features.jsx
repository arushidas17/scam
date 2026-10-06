import {
  Landmark,
  AtSign,
  Copy,
  Sigma,
  FileSearch,
  Users,
  CalendarClock,
  Receipt,
} from 'lucide-react'
import { Section, Rise, SectionHeading } from '../ui/Section'

const CHECKS = [
  {
    icon: Landmark,
    title: 'Bank account change',
    body: 'Flags any payout detail that differs from the account this vendor was last paid on.',
  },
  {
    icon: AtSign,
    title: 'Lookalike email domain',
    body: 'Catches character swaps and near-miss domains impersonating a real supplier.',
  },
  {
    icon: Copy,
    title: 'Duplicate invoice',
    body: 'Matches line items, totals and dates against invoices already in your history.',
  },
  {
    icon: Sigma,
    title: 'Abnormal amount',
    body: 'Compares the total to this vendor’s own range instead of a blanket threshold.',
  },
  {
    icon: FileSearch,
    title: 'GSTIN and PAN validation',
    body: 'Checks tax identifiers for format, consistency and a match to the named entity.',
  },
  {
    icon: Users,
    title: 'Unknown vendor',
    body: 'Separates a genuine first-time supplier from a name that simply appeared today.',
  },
  {
    icon: CalendarClock,
    title: 'Urgency pressure',
    body: 'Notices same-day deadlines and out-of-band requests that rush an approval.',
  },
  {
    icon: Receipt,
    title: 'Tax and total mismatch',
    body: 'Recomputes GST and line totals so an altered figure does not pass through.',
  },
]

export function Features() {
  return (
    <Section
      id="features"
      className="scroll-mt-20 border-t border-hairline py-section lg:py-section-lg"
      labelledBy="features-title"
    >
      <div className="shell">
        <SectionHeading
          id="features-title"
          eyebrow="Detection checks"
          title="Every invoice runs the full set of checks."
          lede="Each check that fires becomes a reason on the score, so a reviewer sees why a payment was held — not just that it was."
        />

        <ul className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CHECKS.map((check) => (
            <Rise as="li" key={check.title}>
              <div className="surface card-interactive group h-full p-5">
                <span
                  className="grid h-10 w-10 place-items-center rounded-lg border border-hairline
                             bg-base-800 transition-colors duration-base ease-out
                             group-hover:border-accent/40"
                >
                  <check.icon
                    className="h-[1.1rem] w-[1.1rem] text-accent"
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                </span>
                <h3 className="mt-4 text-[0.95rem] font-semibold text-ink-primary">
                  {check.title}
                </h3>
                <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-secondary">
                  {check.body}
                </p>
              </div>
            </Rise>
          ))}
        </ul>
      </div>
    </Section>
  )
}
