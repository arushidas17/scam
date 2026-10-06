import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Banknote, FileText, MailWarning, Copy } from 'lucide-react'
import { RiskGauge } from '../ui/RiskGauge'
import { useScanSequence } from '../../hooks/useScanSequence'
import { DUR, EASE_OUT } from '../../lib/motion'

const FIELDS = [
  { label: 'Vendor', value: 'Meridian Supplies Pvt Ltd', mono: false },
  { label: 'Invoice No.', value: 'MS/2026/0481', mono: true },
  { label: 'Amount', value: '₹4,86,500', mono: true },
  { label: 'GST', value: '27AADCM4821K1ZP', mono: true },
  { label: 'Bank Account', value: 'XXXX XXXX 7731', mono: true, flagged: true },
]

const FLAGS = [
  { icon: Banknote, text: 'Bank account changed 2 days ago' },
  { icon: MailWarning, text: 'Reply-to domain is a lookalike' },
  { icon: Copy, text: 'Amount 3.1× vendor average' },
]

export function HeroVisual() {
  const { phase, cycle, reached, reduced } = useScanSequence()

  const scanning = phase === 'scan'
  const showFields = reached('extract')
  const showScore = reached('score')
  const showFlags = reached('flags')

  return (
    <div className="relative mx-auto w-full max-w-[26rem] lg:max-w-[30rem]">
      {/* Soft accent glow behind the visual — the one glow on the page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 -z-10 rounded-full
                   bg-[radial-gradient(circle_at_50%_40%,rgba(43,214,255,0.22),transparent_68%)]
                   blur-2xl"
      />

      <div className="surface-panel relative overflow-hidden p-5 sm:p-6">
        {/* Card header */}
        <div className="flex items-center justify-between gap-3 border-b border-hairline pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline bg-base-800">
              <FileText className="h-4 w-4 text-accent" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-primary">invoice-0481.pdf</p>
              <p className="font-mono text-[0.7rem] text-ink-muted">Received 09:42 IST</p>
            </div>
          </div>
          <span
            className="shrink-0 rounded-pill border border-hairline bg-base-800 px-2.5 py-1
                       font-mono text-[0.65rem] uppercase tracking-wider text-ink-secondary"
          >
            {scanning ? 'Scanning' : showScore ? 'Scored' : 'Queued'}
          </span>
        </div>

        {/* Scan area */}
        <div className="relative mt-4">
          {/* The sweep line. translateY only. */}
          <AnimatePresence>
            {scanning && !reduced && (
              <motion.div
                key={`sweep-${cycle}`}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24"
                initial={{ y: -96, opacity: 0 }}
                animate={{ y: 236, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, ease: [0.4, 0, 0.6, 1] }}
              >
                <div
                  className="h-full w-full"
                  style={{
                    background:
                      'linear-gradient(to bottom, transparent 0%, rgba(43,214,255,0.10) 72%, rgba(43,214,255,0.35) 97%, rgba(43,214,255,0) 100%)',
                  }}
                />
                <div className="h-px w-full bg-accent shadow-[0_0_14px_2px_rgba(43,214,255,0.8)]" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Extracted fields */}
          <dl className="space-y-px">
            {FIELDS.map((field, i) => (
              <div
                key={field.label}
                className="flex items-center justify-between gap-4 rounded-md px-1 py-[0.6rem]"
              >
                <dt className="shrink-0 text-[0.78rem] text-ink-muted">{field.label}</dt>
                <dd className="flex min-h-[1.25rem] min-w-0 items-center justify-end">
                  <AnimatePresence mode="wait">
                    {showFields ? (
                      <motion.span
                        key={`v-${cycle}`}
                        initial={reduced ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: DUR.fast,
                          ease: EASE_OUT,
                          delay: reduced ? 0 : i * 0.14,
                        }}
                        className={[
                          'block truncate text-[0.82rem]',
                          field.mono ? 'font-mono' : '',
                          field.flagged && showScore
                            ? 'text-risk-suspicious'
                            : 'text-ink-primary',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {field.value}
                      </motion.span>
                    ) : (
                      // Placeholder bar while the field is still unread
                      <motion.span
                        key={`s-${cycle}`}
                        aria-hidden="true"
                        className="block h-2.5 rounded-full bg-base-700"
                        style={{ width: `${[9, 6.5, 5, 8, 7][i]}rem` }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </AnimatePresence>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Score + flags */}
        <div className="mt-5 border-t border-hairline pt-5">
          <div className="flex min-h-[7.75rem] flex-col items-center gap-5 sm:flex-row sm:items-center">
            <motion.div
              className="shrink-0"
              initial={false}
              animate={{ opacity: showScore ? 1 : 0.25 }}
              transition={{ duration: DUR.fast, ease: EASE_OUT }}
            >
              <RiskGauge
                score={87}
                size={124}
                stroke={8}
                active={showScore}
                cycleKey={cycle}
                showLabel={false}
                label="Invoice risk score"
              />
            </motion.div>

            <ul className="w-full space-y-2 min-h-[7.5rem]">
              {FLAGS.map((flag, i) => (
                <li key={flag.text}>
                  <AnimatePresence>
                    {showFlags && (
                      <motion.div
                        key={`f-${cycle}`}
                        initial={reduced ? false : { opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: DUR.fast,
                          ease: EASE_OUT,
                          delay: reduced ? 0 : i * 0.11,
                        }}
                        className="flex items-start gap-2.5 rounded-md border border-risk-suspicious-edge
                                   bg-risk-suspicious-dim px-2.5 py-2"
                      >
                        <flag.icon
                          className="mt-px h-3.5 w-3.5 shrink-0 text-risk-suspicious"
                          aria-hidden="true"
                        />
                        <span className="text-[0.76rem] leading-snug text-ink-primary">
                          {flag.text}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              ))}
            </ul>
          </div>

          {/* Verdict line */}
          <motion.div
            className="mt-4 flex items-center gap-2 rounded-md border border-risk-suspicious-edge
                       bg-risk-suspicious-dim px-3 py-2"
            initial={false}
            animate={{ opacity: showFlags ? 1 : 0 }}
            transition={{ duration: DUR.fast, ease: EASE_OUT, delay: showFlags ? 0.33 : 0 }}
          >
            <AlertTriangle
              className="h-4 w-4 shrink-0 text-risk-suspicious"
              aria-hidden="true"
            />
            <p className="text-[0.8rem] font-medium text-risk-suspicious">
              Suspicious — hold payment and verify with the vendor
            </p>
          </motion.div>
        </div>
      </div>

      <p className="mt-3 text-center font-mono text-[0.68rem] text-ink-faint">
        Sample invoice · illustration of the review flow
      </p>
    </div>
  )
}
