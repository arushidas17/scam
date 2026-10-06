import { useState } from 'react'
import { motion } from 'framer-motion'
import { DUR, EASE_OUT } from '../../lib/motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const TONES = {
  urgency: 'bg-risk-review-dim text-risk-review ring-risk-review-edge',
  secrecy: 'bg-risk-suspicious-dim text-risk-suspicious ring-risk-suspicious-edge',
  account: 'bg-risk-suspicious-dim text-risk-suspicious ring-risk-suspicious-edge',
  ifsc: 'bg-risk-suspicious-dim text-risk-suspicious ring-risk-suspicious-edge',
}

const LABELS = {
  urgency: 'Urgency',
  secrecy: 'Secrecy',
  account: 'New account details',
  ifsc: 'Branch code',
}

/** One marked phrase, with its reason on hover, focus and tap. */
function Mark({ hit, index, play }) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const tone = TONES[hit.kind] ?? TONES.urgency

  return (
    <span className="relative inline-block">
      <motion.mark
        tabIndex={0}
        role="button"
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        initial={play && !reduced ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: DUR.fast, ease: EASE_OUT, delay: play && !reduced ? 0.2 + index * 0.1 : 0 }}
        className={`cursor-help rounded-[3px] bg-transparent px-[3px] py-[1px] font-medium ring-1
                    ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${tone}`}
      >
        {hit.text}
      </motion.mark>

      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-20 mb-1.5 w-60 rounded-card border
                     border-hairline-strong bg-base-800 px-3 py-2 text-left shadow-panel"
        >
          <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-ink-muted">
            {LABELS[hit.kind] ?? 'Finding'}
          </span>
          <span className="mt-1 block text-[0.76rem] font-normal leading-relaxed text-ink-secondary">
            {hit.reason}
          </span>
        </span>
      )}
    </span>
  )
}

/**
 * The message as submitted, with every finding marked in place. Highlights
 * appear in sequence once the result loads, then stay put.
 */
export function HighlightedEmail({ text = '', highlights = [], play = false }) {
  const parts = []
  let cursor = 0

  highlights.forEach((hit, i) => {
    if (hit.start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, hit.start)}</span>)
    parts.push(<Mark key={`m${i}`} hit={hit} index={i} play={play} />)
    cursor = hit.end
  })
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>)

  return (
    <div className="rounded-card border border-hairline bg-base-800/40 p-4">
      <p className="whitespace-pre-wrap break-words text-[0.82rem] leading-relaxed text-ink-secondary">
        {parts}
      </p>
      {highlights.length === 0 && (
        <p className="mt-3 border-t border-hairline pt-3 text-[0.78rem] text-ink-muted">
          Nothing in this message matched a known pressure, secrecy or payout-change pattern.
        </p>
      )}
    </div>
  )
}
