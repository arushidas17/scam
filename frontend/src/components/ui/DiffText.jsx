import { motion } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { DUR, EASE_OUT } from '../../lib/motion'

/**
 * One side of a comparison, with the characters that differ from the other side
 * marked. `tone` is a risk band or null — the mark only goes red when the
 * difference is the finding, never as decoration.
 */
export function DiffText({ segments, tone = null, className = '' }) {
  const reduced = useReducedMotion()
  const { head, middle, tail } = segments

  const mark = tone
    ? `${tone.bg} ${tone.text} ring-1 ring-inset ${tone.border}`
    : 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/40'

  return (
    <span className={`font-mono text-[0.84rem] ${className}`}>
      <span className="text-ink-secondary">{head}</span>
      {middle && (
        <motion.mark
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.fast, ease: EASE_OUT, delay: reduced ? 0 : 0.15 }}
          className={`rounded-[3px] bg-transparent px-[2px] font-semibold ${mark}`}
        >
          {middle}
        </motion.mark>
      )}
      <span className="text-ink-secondary">{tail}</span>
      {!middle && <span className="sr-only"> (identical)</span>}
    </span>
  )
}
