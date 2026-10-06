import { useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/Button'
import { EXTRACTION_FIELDS, CONFIDENCE_THRESHOLD } from '../../lib/invoiceValidation'
import { useReducedMotion } from '../../hooks/useReducedMotion'

function Row({ field, value, onChange, onBlur, error, lowConfidence, disabled }) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  const describedBy = [error ? errorId : null, lowConfidence && !error ? hintId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.78rem] font-medium text-ink-secondary">
        {field.label}
      </label>

      <div className="relative">
        {field.prefix && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono
                       text-[0.84rem] text-ink-muted"
            aria-hidden="true"
          >
            {field.prefix}
          </span>
        )}

        <input
          id={id}
          type={field.type === 'date' ? 'date' : field.type}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(field.uppercase ? e.target.value.toUpperCase() : e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
          className={[
            'h-10 w-full rounded-lg border bg-base-800/70 px-3 text-[0.84rem] text-ink-primary',
            'placeholder:text-ink-faint transition-[border-color] duration-snap ease-out',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-base-900',
            'disabled:opacity-70',
            field.mono ? 'font-mono' : '',
            field.prefix ? 'pl-7' : '',
            error
              ? 'border-risk-suspicious-edge'
              : lowConfidence
                ? 'border-risk-review-edge'
                : 'border-hairline-strong focus:border-accent/60',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </div>

      <div aria-live="polite" className="min-h-[1.15rem]">
        {error ? (
          <p
            id={errorId}
            className="mt-1 flex items-start gap-1.5 text-[0.74rem] text-risk-suspicious"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : lowConfidence ? (
          <p
            id={hintId}
            className="mt-1 flex items-start gap-1.5 text-[0.74rem] text-risk-review"
          >
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Please check — read with low confidence
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Editable form for the extracted fields.
 *
 * Fields fill in one after another on mount, as if the system were typing
 * them. That is presentation only: the values are already present in state, so
 * submitting early can never lose data.
 */
export function ExtractionForm({ extraction, onSubmit, onDiscard, submitting }) {
  const reduced = useReducedMotion()

  const [values, setValues] = useState(() =>
    Object.fromEntries(
      EXTRACTION_FIELDS.map((f) => [f.key, extraction?.fields?.[f.key]?.value ?? '']),
    ),
  )
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // How many fields have been revealed so far.
  const [revealed, setRevealed] = useState(reduced ? EXTRACTION_FIELDS.length : 0)
  const timerRef = useRef()

  useEffect(() => {
    if (reduced || revealed >= EXTRACTION_FIELDS.length) return
    timerRef.current = setTimeout(() => setRevealed((n) => n + 1), 110)
    return () => clearTimeout(timerRef.current)
  }, [revealed, reduced])

  const setField = (key) => (value) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    if (touched[key]) {
      const field = EXTRACTION_FIELDS.find((f) => f.key === key)
      setErrors((prev) => ({ ...prev, [key]: field.validate(value) }))
    }
  }

  const handleBlur = (key) => () => {
    setTouched((prev) => ({ ...prev, [key]: true }))
    const field = EXTRACTION_FIELDS.find((f) => f.key === key)
    setErrors((prev) => ({ ...prev, [key]: field.validate(values[key]) }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const next = {}
    for (const field of EXTRACTION_FIELDS) next[field.key] = field.validate(values[field.key])
    setErrors(next)
    setTouched(Object.fromEntries(EXTRACTION_FIELDS.map((f) => [f.key, true])))

    if (Object.values(next).some(Boolean)) {
      // Move focus to the first problem so keyboard users are not hunting for
      // it. Deferred by a frame, because aria-invalid is only set on re-render.
      requestAnimationFrame(() => {
        document.querySelector('[aria-invalid="true"]')?.focus()
      })
      return
    }

    onSubmit(values)
  }

  const lowConfidenceCount = EXTRACTION_FIELDS.filter(
    (f) => (extraction?.fields?.[f.key]?.confidence ?? 1) < CONFIDENCE_THRESHOLD,
  ).length

  return (
    <form onSubmit={handleSubmit} noValidate>
      {lowConfidenceCount > 0 && (
        <p
          className="mb-4 flex items-start gap-2 rounded-lg border border-risk-review-edge
                     bg-risk-review-dim px-3 py-2.5 text-[0.8rem] text-risk-review"
        >
          <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
          {lowConfidenceCount} {lowConfidenceCount === 1 ? 'field was' : 'fields were'} read with
          low confidence. Check {lowConfidenceCount === 1 ? 'it' : 'them'} before saving.
        </p>
      )}

      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {EXTRACTION_FIELDS.map((field, i) => {
          const confidence = extraction?.fields?.[field.key]?.confidence ?? 1
          const isRevealed = i < revealed

          return (
            <div
              key={field.key}
              // Opacity only — the row keeps its space so nothing reflows.
              className="transition-opacity duration-snap ease-out"
              style={{ opacity: isRevealed ? 1 : 0.25 }}
            >
              <Row
                field={field}
                value={isRevealed ? values[field.key] : ''}
                onChange={setField(field.key)}
                onBlur={handleBlur(field.key)}
                error={touched[field.key] ? errors[field.key] : ''}
                lowConfidence={confidence < CONFIDENCE_THRESHOLD}
                disabled={!isRevealed || submitting}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex flex-col gap-2.5 border-t border-hairline pt-5 sm:flex-row">
        <Button
          type="submit"
          size="md"
          disabled={submitting || revealed < EXTRACTION_FIELDS.length}
          className="w-full sm:w-auto"
        >
          {submitting ? 'Analysing…' : 'Save and analyse'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onDiscard}
          disabled={submitting}
          className="w-full sm:w-auto"
        >
          Discard
        </Button>
      </div>
    </form>
  )
}
