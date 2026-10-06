import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Upload, ScanSearch, ShieldCheck } from 'lucide-react'
import { Section, Rise, SectionHeading } from '../ui/Section'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const STEPS = [
  {
    icon: Upload,
    step: '01',
    title: 'Upload',
    body: 'Drop in a PDF, an image or a forwarded email. Single invoice or a whole batch.',
  },
  {
    icon: ScanSearch,
    step: '02',
    title: 'AI extracts and checks',
    body: 'Fields are read, then matched against vendor history, past invoices and bank records.',
  },
  {
    icon: ShieldCheck,
    step: '03',
    title: 'Review the risk score',
    body: 'A 0–100 score with plain-language reasons tells your team what to release and what to hold.',
  },
]

export function HowItWorks() {
  const ref = useRef(null)
  const reduced = useReducedMotion()

  // Line draws itself as the section travels through the viewport.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'center 0.45'],
  })
  const scale = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <Section id="how-it-works" className="scroll-mt-20 py-section lg:py-section-lg" labelledBy="how-title">
      <div className="shell">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="Three steps between an invoice arriving and a decision you can defend."
          lede="No change to how your vendors bill you, and no rip-and-replace of your accounting stack."
        />

        <div ref={ref} className="relative mt-14">
          {/* Connector — horizontal on desktop, vertical on mobile. scaleX/scaleY only. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[1.45rem] top-6 bottom-6 w-px
                       bg-hairline md:hidden"
          >
            <motion.div
              className="h-full w-full origin-top bg-gradient-to-b from-accent/70 to-accent/10"
              style={{ scaleY: reduced ? 1 : scale }}
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-[1.6rem] hidden h-px
                       bg-hairline md:block"
          >
            <motion.div
              className="h-full w-full origin-left bg-gradient-to-r from-accent/10 via-accent/70 to-accent/10"
              style={{ scaleX: reduced ? 1 : scale }}
            />
          </div>

          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((item) => (
              <Rise as="li" key={item.step} className="relative pl-16 md:pl-0">
                <span
                  className="absolute left-0 top-0 grid h-[3.2rem] w-[3.2rem] place-items-center
                             rounded-xl border border-hairline-strong bg-base-900 shadow-raised
                             md:static md:mb-6"
                >
                  <item.icon className="h-5 w-5 text-accent" strokeWidth={1.6} aria-hidden="true" />
                </span>
                <p className="font-mono text-[0.7rem] tracking-widest text-ink-faint">
                  STEP {item.step}
                </p>
                <h3 className="mt-2 text-display-sm text-ink-primary">{item.title}</h3>
                <p className="mt-2.5 text-[0.92rem] leading-relaxed text-ink-secondary">
                  {item.body}
                </p>
              </Rise>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  )
}
