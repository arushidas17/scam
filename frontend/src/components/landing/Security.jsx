import { Lock, KeyRound, ScrollText, ServerCog } from 'lucide-react'
import { Section, Rise, SectionHeading } from '../ui/Section'

const COMMITMENTS = [
  {
    icon: Lock,
    title: 'Encrypted in transit and at rest',
    body: 'Invoices and vendor records are encrypted on the wire and in storage.',
  },
  {
    icon: KeyRound,
    title: 'Role-based access',
    body: 'Separate permissions for AP clerks, approvers and finance leadership.',
  },
  {
    icon: ScrollText,
    title: 'Full audit trail',
    body: 'Every upload, score and approval is recorded with who acted and when.',
  },
  {
    icon: ServerCog,
    title: 'Your data stays yours',
    body: 'Your documents are not used to train shared models, and exports are available on request.',
  },
]

export function Security() {
  return (
    <Section
      id="security"
      className="scroll-mt-20 border-t border-hairline bg-base-900/40 py-section"
      labelledBy="security-title"
    >
      <div className="shell grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <SectionHeading
          id="security-title"
          eyebrow="Security"
          title="Handling payment data means earning the access."
          lede="Fraud Guardian sits beside your approval process and holds the least it needs to do the job."
        />

        <ul className="grid gap-3 sm:grid-cols-2">
          {COMMITMENTS.map((item) => (
            <Rise as="li" key={item.title}>
              <div className="surface card-interactive h-full p-5">
                <item.icon
                  className="h-5 w-5 text-accent"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-[0.92rem] font-semibold text-ink-primary">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-secondary">
                  {item.body}
                </p>
              </div>
            </Rise>
          ))}
        </ul>
      </div>
    </Section>
  )
}
