/**
 * Invoices, against the real backend.
 *
 * The function names and return shapes are unchanged from the mock version, so
 * the pages did not have to be rewritten; everything snake_case-to-camelCase
 * happens in adapters.js. Nothing here falls back to sample data — when the
 * backend is unreachable the call throws and the page says so.
 */
import { api, toNumber } from './api'
import {
  adaptAlert,
  adaptFlag,
  adaptInvoiceDetail,
  adaptInvoiceRow,
} from './adapters'
import { BAND_ORDER } from '../lib/risk'

/** The backend sorts on four columns; the table offers more. */
const SORT_MAP = {
  invoiceDate: 'invoice_date',
  receivedAt: 'invoice_date',
  amount: 'amount',
  riskScore: 'risk_score',
  status: 'risk_score',
  vendor: 'vendor',
  invoiceNumber: 'vendor',
  dueDate: 'invoice_date',
  mainFlag: 'risk_score',
}

export async function getDashboardStats() {
  const data = await api.get('/dashboard/stats')

  return {
    today: data.today.total,
    normal: data.today.normal,
    needsReview: data.today.needs_review,
    suspicious: data.today.suspicious,
    moneyAtRisk: toNumber(data.money_at_risk),
    perDay: (data.per_day ?? []).map((row) => ({
      // The chart keys its axis on `date`.
      date: row.day,
      normal: row.normal,
      needs_review: row.needs_review,
      suspicious: row.suspicious,
      total: row.total,
    })),
    topReasons: (data.top_reasons ?? []).map((row) => ({
      flag: row.title,
      code: row.code,
      count: row.count,
    })),
  }
}

export async function getRecentAlerts(limit = 8) {
  // The dashboard endpoint already carries these, so this costs no extra call
  // beyond the one the page makes anyway.
  const data = await api.get('/dashboard/stats')
  return (data.recent_alerts ?? []).slice(0, limit).map(adaptAlert)
}

export async function listInvoices({
  status = 'all',
  search = '',
  from = null,
  to = null,
  sort = 'receivedAt',
  direction = 'desc',
  page = 1,
  pageSize = 15,
} = {}) {
  const data = await api.get('/invoices', {
    status: status === 'all' ? undefined : status,
    search: search?.trim() || undefined,
    date_from: from || undefined,
    date_to: to || undefined,
    sort: SORT_MAP[sort] ?? 'invoice_date',
    order: direction,
    page,
    page_size: pageSize,
  })

  return {
    rows: (data.rows ?? []).map(adaptInvoiceRow),
    total: data.total,
    totalValue: toNumber(data.total_value),
    counts: data.counts,
    page: data.page,
    pageCount: data.pages,
    pageSize: data.page_size,
  }
}

export async function getInvoice(id) {
  return adaptInvoiceDetail(await api.get(`/invoices/${id}`))
}

/**
 * Record a decision.
 *
 * `verified` is the confirmation that the bank details were checked by phone,
 * which the backend requires before it will let a suspicious invoice be
 * approved. The invoice is re-read afterwards so the caller gets the real
 * timeline and the next id rather than a locally assembled guess.
 */
export async function decideInvoice(id, action, note = '', verified = false) {
  await api.post(`/invoices/${id}/decision`, { action, note: note || null, verified })

  const detail = adaptInvoiceDetail(await api.get(`/invoices/${id}`))
  return {
    decision: detail.decision,
    activity: detail.activity,
    nextId: detail.queue.nextId,
  }
}

/** Backend field name -> the name the review form uses. */
const FIELD_NAMES = {
  vendor_name: 'vendor',
  invoice_number: 'invoiceNumber',
  invoice_date: 'invoiceDate',
  due_date: 'dueDate',
  amount: 'amount',
  gst_amount: 'gstAmount',
  gstin: 'gstin',
  bank_account: 'bankAccount',
  ifsc: 'ifsc',
  sender_email: 'senderEmail',
}

/**
 * Upload a document and read its fields.
 *
 * Returns the extracted fields plus the invoice id and a signed document URL,
 * so the review step can show the real page and save corrections against the
 * row the backend already created.
 */
export async function extractInvoice(file) {
  const form = new FormData()
  form.append('file', file)

  const data = await api.post('/invoices/upload', form)

  const fields = {}
  for (const field of data.fields ?? []) {
    const name = FIELD_NAMES[field.name]
    if (!name) continue
    fields[name] = { value: field.value ?? '', confidence: field.confidence ?? 0 }
  }

  return {
    sourceName: file?.name ?? 'invoice.pdf',
    fields,
    invoiceId: data.invoice_id,
    documentUrl: data.document_url ?? null,
    warnings: data.warnings ?? [],
  }
}

/**
 * Save the reviewer's corrections, then re-score.
 *
 * Re-analysing is the point: a corrected amount or account should produce the
 * score the corrected values earn, not the one the original read did.
 */
export async function saveInvoice(data) {
  const invoiceId = data.invoiceId
  if (!invoiceId) {
    throw new Error('No invoice to save against. Upload the document again.')
  }

  // Empty strings are sent as null, which the backend reads as "clear this
  // field" rather than "store an empty string".
  const orNull = (v) => {
    const t = typeof v === 'string' ? v.trim() : v
    return t === '' || t === undefined ? null : t
  }

  await api.patch(`/invoices/${invoiceId}/fields`, {
    vendor_name: orNull(data.vendor),
    invoice_number: orNull(data.invoiceNumber),
    invoice_date: orNull(data.invoiceDate),
    due_date: orNull(data.dueDate),
    amount: orNull(data.amount),
    gst_amount: orNull(data.gstAmount),
    gstin: orNull(data.gstin),
    bank_account: orNull(data.bankAccount),
    ifsc: orNull(data.ifsc),
    sender_email: orNull(data.senderEmail),
  })

  const analysis = await api.post(`/invoices/${invoiceId}/analyse`)
  const detail = await api.get(`/invoices/${invoiceId}`)

  return {
    ...adaptInvoiceDetail(detail),
    riskScore: analysis.risk_score,
    status: analysis.status,
    flags: (analysis.flags ?? []).map(adaptFlag),
    recommendation: analysis.recommendation
      ? { verdict: analysis.recommendation.verdict, steps: analysis.recommendation.steps ?? [] }
      : null,
  }
}

/** Tab metadata, so pages do not re-declare the band list. */
export const STATUS_TABS = [
  { key: 'all', label: 'All', band: null },
  ...BAND_ORDER.map((band) => ({ key: band.status, label: band.label, band })),
]
