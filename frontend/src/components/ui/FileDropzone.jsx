import { useRef, useState } from 'react'
import { UploadCloud, FileWarning } from 'lucide-react'
import { Button } from './Button'

const DEFAULT_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const DEFAULT_MAX_MB = 10

function describeTypes(types) {
  return types
    .map((t) => ({ 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG' })[t] ?? t)
    .join(', ')
}

/**
 * Drop zone with drag feedback and inline rejection messages.
 *
 * Validation lives here so every caller gets the same rules and the same
 * wording; the parent only ever receives a file that already passed.
 */
export function FileDropzone({
  onFile,
  accept = DEFAULT_TYPES,
  maxMb = DEFAULT_MAX_MB,
  disabled = false,
}) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  // Nested dragenter/dragleave events fire for child elements, so count depth
  // rather than toggling on every event.
  const depthRef = useRef(0)

  const validate = (file) => {
    if (!file) return 'No file was received. Try again.'
    if (!accept.includes(file.type)) {
      return `That file type is not supported. Upload a ${describeTypes(accept)} file.`
    }
    if (file.size > maxMb * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1)
      return `That file is ${mb}MB. The limit is ${maxMb}MB.`
    }
    return ''
  }

  const handleFile = (file) => {
    const message = validate(file)
    setError(message)
    if (!message) onFile(file)
  }

  const onDrop = (event) => {
    event.preventDefault()
    depthRef.current = 0
    setDragging(false)
    if (disabled) return
    handleFile(event.dataTransfer.files?.[0])
  }

  return (
    <div>
      <div
        onDragEnter={(e) => {
          e.preventDefault()
          depthRef.current += 1
          if (!disabled) setDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault()
          depthRef.current -= 1
          if (depthRef.current <= 0) {
            depthRef.current = 0
            setDragging(false)
          }
        }}
        onDrop={onDrop}
        className={[
          'rounded-panel border border-dashed px-6 py-12 text-center sm:py-16',
          'transition-[border-color,background-color] duration-snap ease-out',
          dragging
            ? 'border-accent bg-accent/[0.07]'
            : 'border-hairline-strong bg-base-900 hover:border-accent/40',
          disabled ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <span
          className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl border transition-colors
                      duration-snap ease-out
                      ${dragging ? 'border-accent/50 bg-accent/10' : 'border-hairline bg-base-800'}`}
        >
          <UploadCloud
            className={`h-6 w-6 ${dragging ? 'text-accent' : 'text-ink-secondary'}`}
            strokeWidth={1.6}
            aria-hidden="true"
          />
        </span>

        <p className="mt-5 text-[1rem] font-medium text-ink-primary">
          {dragging ? 'Drop the invoice to upload' : 'Drag an invoice here'}
        </p>
        <p className="mt-1.5 text-[0.85rem] text-ink-secondary">
          {describeTypes(accept)} up to {maxMb}MB
        </p>

        <div className="mt-6">
          <Button
            variant="outline"
            size="md"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            Browse files
          </Button>
        </div>

        <label htmlFor="invoice-file" className="sr-only">
          Choose an invoice file to upload
        </label>
        <input
          id="invoice-file"
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept.join(',')}
          disabled={disabled}
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            // Let the same file be chosen again after a rejection.
            e.target.value = ''
          }}
        />
      </div>

      {/* Kept mounted so the rejection is announced when it appears */}
      <div aria-live="polite" className="min-h-[1.6rem]">
        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-risk-suspicious-edge
                        bg-risk-suspicious-dim px-3 py-2.5 text-[0.82rem] text-risk-suspicious">
            <FileWarning className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
