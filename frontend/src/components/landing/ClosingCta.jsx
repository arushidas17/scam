import { ArrowRight } from 'lucide-react'
import { Section, Rise } from '../ui/Section'
import { Button } from '../ui/Button'

export function ClosingCta() {
  return (
    <Section className="py-section" labelledBy="cta-title">
      <div className="shell">
        <div className="surface-panel relative overflow-hidden px-6 py-14 text-center sm:px-10 lg:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-dot-faint bg-dot opacity-60 mask-fade-radial"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -bottom-24 h-56
                       bg-[radial-gradient(ellipse_60%_100%_at_50%_100%,rgba(43,214,255,0.16),transparent_70%)]"
          />

          <div className="relative mx-auto max-w-prose">
            <Rise as="h2" id="cta-title" className="text-display-lg text-ink-primary">
              Check the next invoice before you pay it.
            </Rise>
            <Rise as="p" className="mt-5 text-[1.02rem] leading-relaxed text-ink-secondary">
              Create a workspace, upload an invoice, and see the score and the reasons for
              yourself.
            </Rise>
            <Rise className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button to="/signup" size="lg">
                Get started
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button to="/login" variant="outline" size="lg">
                Log in
              </Button>
            </Rise>
          </div>
        </div>
      </div>
    </Section>
  )
}
