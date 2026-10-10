import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, FileWarning } from 'lucide-react'

import { useReducedMotion } from '../../hooks/useReducedMotion'

/**
 * The uploaded document.
 *
 * Shows the real file: the signed URL the backend returns once it is stored,
 * or — while the upload is still in flight — a local object URL for the file
 * the user picked, so the preview is never a placeholder standing in for a
 * document the reviewer is being asked to check.
 */
export function DocumentPreview({ fileName, documentUrl = null, file = null, scanning = false, className = '' }) {
  const reduced = useReducedMotion()

  // A blob URL for the picked file, created during render and revoked when the
  // file changes, so the browser can release it.
  const [blob, setBlob] = useState({ file: null, url: null })
  if (blob.file !== file) {
    if (blob.url) URL.revokeObjectURL(blob.url)
    setBlob({ file, url: file ? URL.createObjectURL(file) : null })
  }
  useEffect(() => () => {
    if (blob.url) URL.revokeObjectURL(blob.url)
  }, [blob.url])

  const source = documentUrl || blob.url

  // Reset the error when the document being shown changes, adopted during
  // render rather than in an effect so there is no extra pass.
  const [lastSource, setLastSource] = useState(source)
  const [failed, setFailed] = useState(false)
  if (lastSource !== source) {
    setLastSource(source)
    setFailed(false)
  }
  const isPdf = (file?.type || '').includes('pdf') || /\.pdf(\?|$)/i.test(fileName || '')

  return (
    <section aria-label="Document preview" className={`surface overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-hairline bg-base-800/40 px-4 py-2.5">
        <FileText className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <p className="min-w-0 truncate text-[0.82rem] text-ink-secondary">{fileName}</p>
      </div>

      <div className="relative overflow-hidden bg-base-950/40">
        {scanning && !reduced && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24"
            initial={{ y: -96 }}
            animate={{ y: 520 }}
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

        {source && !failed ? (
          isPdf ? (
            <object
              data={`${source}#toolbar=0&navpanes=0&view=FitH`}
              type="application/pdf"
              className="h-[32rem] w-full bg-base-900"
              aria-label={`Preview of ${fileName}`}
              onError={() => setFailed(true)}
            >
              {/* Shown when the browser will not render a PDF inline. */}
              <div className="flex h-[32rem] flex-col items-center justify-center gap-3 p-6 text-center">
                <FileText className="h-6 w-6 text-ink-muted" aria-hidden="true" />
                <p className="text-[0.84rem] text-ink-secondary">
                  This browser cannot show the PDF inline.
                </p>
                <a
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-pill border border-hairline-strong px-3 py-1.5 text-[0.8rem]
                             text-accent transition-colors duration-snap ease-out
                             hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-accent"
                >
                  Open the document
                </a>
              </div>
            </object>
          ) : (
            <div className="flex max-h-[32rem] items-start justify-center overflow-auto p-4">
              <img
                src={source}
                alt={`Preview of ${fileName}`}
                className="max-w-full rounded-md border border-hairline"
                onError={() => setFailed(true)}
              />
            </div>
          )
        ) : (
          <div className="flex h-[32rem] flex-col items-center justify-center gap-3 p-6 text-center">
            <FileWarning className="h-6 w-6 text-ink-muted" aria-hidden="true" />
            <p className="text-[0.84rem] text-ink-secondary">
              {failed
                ? 'The document could not be displayed. The link may have expired.'
                : 'Preparing the document…'}
            </p>
            {failed && source && (
              <a
                href={source}
                target="_blank"
                rel="noreferrer"
                className="rounded-pill border border-hairline-strong px-3 py-1.5 text-[0.8rem]
                           text-accent transition-colors duration-snap ease-out hover:border-accent/50"
              >
                Try opening it directly
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
