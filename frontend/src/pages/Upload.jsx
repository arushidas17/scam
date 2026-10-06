import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '../components/app/PageHeader'
import { FileDropzone } from '../components/ui/FileDropzone'
import { UploadStepper } from '../components/upload/UploadStepper'
import { DocumentPreview } from '../components/upload/DocumentPreview'
import { ProcessingChecklist } from '../components/upload/ProcessingChecklist'
import { ExtractionForm } from '../components/upload/ExtractionForm'
import { ResultCard } from '../components/upload/ResultCard'
import { extractInvoice, saveInvoice } from '../services/invoices'
import { DUR, EASE_OUT } from '../lib/motion'

const stepTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: DUR.fast, ease: EASE_OUT },
}

export default function UploadPage() {
  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [extraction, setExtraction] = useState(null)
  const [saved, setSaved] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Ignore a resolved extraction if the user discarded in the meantime.
  const runRef = useRef(0)

  const reset = useCallback(() => {
    runRef.current += 1
    setStep('upload')
    setFile(null)
    setExtraction(null)
    setSaved(null)
    setSaving(false)
    setError('')
  }, [])

  const handleFile = useCallback((picked) => {
    const runId = runRef.current + 1
    runRef.current = runId

    setFile(picked)
    setExtraction(null)
    setError('')
    setStep('review')

    extractInvoice(picked)
      .then((result) => {
        if (runRef.current === runId) setExtraction(result)
      })
      .catch(() => {
        if (runRef.current !== runId) return
        setError('That document could not be read. Try uploading it again.')
        setStep('upload')
      })
  }, [])

  const handleSave = useCallback(async (values) => {
    setSaving(true)
    setError('')
    try {
      const result = await saveInvoice(values)
      setSaved(result)
      setStep('result')
    } catch {
      setError('That invoice could not be saved. Try again.')
    } finally {
      setSaving(false)
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-6">
      <PageHeader
        title="Upload invoice"
        subtitle="Upload a document, check what we read from it, then see the risk score."
      />

      <div className="surface px-5 py-4">
        <UploadStepper current={step} />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-risk-suspicious-edge bg-risk-suspicious-dim
                     px-4 py-3 text-[0.85rem] text-risk-suspicious"
        >
          {error}
        </p>
      )}

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div key="upload" {...stepTransition}>
            <FileDropzone onFile={handleFile} />
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div key="review" {...stepTransition}>
            {!extraction ? (
              // Processing: preview with a sweep, and the checklist ticking off.
              <div className="grid items-start gap-4 lg:grid-cols-[1fr_1fr]">
                <DocumentPreview fileName={file?.name} scanning />
                <div className="surface p-6">
                  <h3 className="text-[0.95rem] font-semibold text-ink-primary">
                    Reading your invoice
                  </h3>
                  <p className="mt-1.5 text-[0.85rem] text-ink-secondary">
                    This usually takes a few seconds.
                  </p>
                  <div className="mt-6">
                    <ProcessingChecklist complete={!!extraction} />
                  </div>
                </div>
              </div>
            ) : (
              // Extracted: preview on the left, editable fields on the right.
              <div className="grid items-start gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <DocumentPreview fileName={file?.name} />
                <div className="surface p-5 sm:p-6">
                  <h3 className="text-[0.95rem] font-semibold text-ink-primary">
                    Check the extracted fields
                  </h3>
                  <p className="mt-1.5 text-[0.85rem] text-ink-secondary">
                    Correct anything that was read wrong before analysing.
                  </p>
                  <div className="mt-5">
                    <ExtractionForm
                      extraction={extraction}
                      onSubmit={handleSave}
                      onDiscard={reset}
                      submitting={saving}
                    />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {step === 'result' && saved && (
          <motion.div key="result" {...stepTransition}>
            <ResultCard invoice={saved} onUploadAnother={reset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
