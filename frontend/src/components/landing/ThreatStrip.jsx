import { Landmark, UserX, Files, TrendingUp } from 'lucide-react'
import { Section, Rise } from '../ui/Section'

const THREATS = [
  {
    icon: Landmark,
    title: 'Bank detail changes',
    body: 'A known vendor’s account number quietly swapped before payout.',
  },
  {
    icon: UserX,
    title: 'Vendor impersonation',
    body: 'Lookalike domains and spoofed reply-to addresses posing as suppliers.',
  },
  {
    icon: Files,
    title: 'Duplicate invoices',
    body: 'The same bill re-submitted under a new number or a new date.',
  },
  {
    icon: TrendingUp,
    title: 'Inflated amounts',
    body: 'Totals, quantities or tax lines well outside this vendor’s pattern.',
  },
]

export function ThreatStrip() {
  return (
    <Section className="relative border-y border-hairline bg-base-900/40 py-14" labelledBy="threats-title">
      <div className="shell">
        <Rise as="h2" id="threats-title" className="eyebrow mb-7">
          What it catches
        </Rise>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {THREATS.map((threat) => (
            <Rise as="li" key={threat.title}>
              <div className="surface card-interactive h-full p-5">
                <threat.icon
                  className="h-5 w-5 text-accent"
                  aria-hidden="true"
                  strokeWidth={1.6}
                />
                <h3 className="mt-4 text-[0.95rem] font-semibold text-ink-primary">
                  {threat.title}
                </h3>
                <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-secondary">
                  {threat.body}
                </p>
              </div>
            </Rise>
          ))}
        </ul>
      </div>
    </Section>
  )
}
