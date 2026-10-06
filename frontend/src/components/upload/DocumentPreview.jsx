import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/**
 * Stand-in for the uploaded document. There is no real renderer yet, so this
 * draws a page-shaped placeholder; `scanning` sweeps a line down it.
 */
export function DocumentPreview({ fileName, scanning = false, className = '' }) {
  const reduced = useReducedMotion()

  return (
    <div className={`surface overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-hairline bg-base-800/40 px-4 py-2.5">
        <FileText className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <p className="min-w-0 truncate text-[0.82rem] text-ink-secondary">{fileName}</p>
      </div>

      <div className="relative overflow-hidden bg-base-950/40 p-5">
        {scanning && !reduced && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24"
            initial={{ y: -96 }}
            animate={{ y: 420 }}
            transition={{ duration: 1.9, ease: 'linear', repeat: Infinity }}
          >
            <div
              className="h-full w-full"
              style={{
                background:
                  'linear-gradient(to bottom, transparent 0%, rgba(43,214,255,0.10) 72%, rgba(43,214,255,0.32) 97%, rgba(43,214,255,0) 100%)',
              }}
            />
            <div className="h-px w-full bg-accent shadow-[0_0_14px_2px_rgba(43,214,255,0.8)]" />
          </motion.div>
        )}

        {/* Page-shaped placeholder: a letterhead block, body lines, a total. */}
        <div className="mx-auto aspect-[1/1.3] w-full max-w-[21rem] rounded-md border border-hairline bg-base-900 p-5">
          <div className="h-5 w-24 rounded bg-base-700" />
          <div className="mt-1.5 h-2 w-32 rounded bg-base-700/70" />

          <div className="mt-6 space-y-2">
            {['w-full', 'w-11/12', 'w-10/12', 'w-full', 'w-9/12'].map((w, i) => (
              <div key={i} className={`h-2 rounded bg-base-700/60 ${w}`} />
            ))}
          </div>

          <div className="mt-6 space-y-2 border-t border-hairline pt-4">
            {['w-10/12', 'w-full', 'w-8/12'].map((w, i) => (
              <div key={i} className={`h-2 rounded bg-base-700/60 ${w}`} />
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <div className="h-4 w-24 rounded bg-base-700" />
          </div>
        </div>
      </div>
    </div>
  )
}
