/**
 * Translating backend responses into the shapes the pages already consume.
 *
 * The API speaks snake_case and sends every amount as a string; the components
 * were written against camelCase objects with numeric amounts. Rather than
 * rewrite a dozen components, the translation lives here — one file to read
 * when the two ever drift apart.
 */
import { toNumber } from './api'
import { bandForScore } from '../lib/risk'

/** Which document field each flag points at, for the highlight on invoice detail. */
const FLAG_FIELD = {
  bank_account_changed: 'bankAccount',
  lookalike_domain: 'senderEmail',
  amount_above_average: 'amount',
  duplicate_invoice: 'invoiceNumber',
  new_vendor: 'vendor',
  gstin_invalid_or_mismatched: 'gstin',
  gstin_mismatch: 'gstin',
  urgency_pressure: 'dueDate',
  urgency_language: 'dueDate',
  tax_mismatch: 'gstAmount',
  totals_mismatch: 'gstAmount',
  ifsc_changed: 'ifsc',
  new_bank_account: 'bankAccount',
}

/**
 * Give the evidence a `kind` the Evidence component can switch on.
 *
 * The backend returns the raw comparison values; which *sort* of comparison it
 * is follows from the rule that produced them, so it is derived here rather
 * than duplicated into every rule on the server.
 */
function adaptEvidence(code, evidence) {
  const e = evidence ?? {}

  switch (code) {
    case 'bank_account_changed':
    case 'new_bank_account':
      return {
        kind: 'bank',
        onRecord: e.on_record ?? null,
        onInvoice: e.on_invoice ?? null,
        ifscOnRecord: e.ifsc_on_record ?? null,
        ifscOnInvoice: e.ifsc_on_invoice ?? null,
        changedOn: e.record_last_confirmed_on ?? null,
      }

    case 'lookalike_domain':
      return { kind: 'domain', onRecord: e.on_record ?? '', onInvoice: e.on_invoice ?? '' }

    case 'amount_above_average':
      return {
        kind: 'amount',
        amount: toNumber(e.amount),
        average: toNumber(e.vendor_average),
        percentAbove: toNumber(e.percent_above_average),
        date: e.date ?? null,
      }

    case 'duplicate_invoice':
      return {
        kind: 'duplicate',
        match: e.other_invoice_id
          ? {
              id: e.other_invoice_id,
              invoiceNumber: e.other_invoice_number,
              invoiceDate: e.other_invoice_date,
              amount: toNumber(e.other_amount),
            }
          : null,
      }

    case 'gstin_invalid_or_mismatched':
    case 'gstin_mismatch':
    case 'ifsc_changed':
      return {
        kind: 'pair',
        label: code.startsWith('ifsc') ? 'IFSC' : 'GSTIN',
        onRecord: e.on_record ?? '—',
        onInvoice: e.on_invoice ?? '—',
      }

    default: {
      // Anything else renders as a sentence. The backend's evidence keys vary
      // by rule, so fall back to whatever reads best.
      const detail =
        e.detail ??
        (Array.isArray(e.matches)
          ? e.matches.map((m) => `"${m.phrase}"`).join(', ')
          : null) ??
        e.reason ??
        null
      return { kind: 'generic', detail }
    }
  }
}

export function adaptFlag(flag) {
  return {
    id: flag.code,
    code: flag.code,
    title: flag.title,
    points: flag.points,
    explanation: flag.message,
    field: FLAG_FIELD[flag.code] ?? null,
    evidence: adaptEvidence(flag.code, flag.evidence),
  }
}

/** A row in the invoice table or the dashboard alert list. */
export function adaptInvoiceRow(row) {
  return {
    id: row.id,
    vendorId: row.vendor_id ?? null,
    vendor: row.vendor_name ?? '—',
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    receivedAt: row.created_at,
    amount: toNumber(row.amount),
    currency: row.currency ?? 'INR',
    riskScore: row.risk_score ?? 0,
    status: row.status,
    decision: row.decision,
    mainFlag: row.top_flag_title ?? null,
    bankAccount: row.bank_account_masked ?? null,
  }
}

const DECISION_LABELS = {
  invoice_approved: 'Approved for payment',
  invoice_rejected: 'Rejected',
  invoice_escalated: 'Escalated to finance lead',
  vendor_bank_account_updated: 'Vendor bank account updated',
}

const DECISION_ACTIONS = {
  invoice_approved: 'approve',
  invoice_rejected: 'reject',
  invoice_escalated: 'escalate',
}

/**
 * The activity timeline.
 *
 * The backend's audit log records decisions only, so the two events that are
 * implicit in the row itself — it arrived, it was scored — are reconstructed
 * here. A timeline that starts at "rejected" would leave out how it got there.
 */
export function adaptTimeline(detail) {
  const events = [
    {
      id: 'received',
      label: 'Invoice received',
      detail: detail.sender_email ? `Arrived by email from ${detail.sender_email}` : null,
      at: detail.created_at,
      by: 'System',
    },
  ]

  if (detail.risk_score !== null && detail.risk_score !== undefined) {
    const count = detail.flags?.length ?? 0
    events.push({
      id: 'analysed',
      label: 'Analysed',
      detail: count
        ? `${count} ${count === 1 ? 'check' : 'checks'} raised a flag · scored ${detail.risk_score}`
        : `No checks raised a flag · scored ${detail.risk_score}`,
      at: detail.created_at,
      by: 'Fraud Guardian',
    })
  }

  for (const entry of detail.timeline ?? []) {
    events.push({
      id: entry.id,
      label: DECISION_LABELS[entry.action] ?? entry.action,
      detail: entry.note || null,
      at: entry.created_at,
      by: entry.user_name || entry.user_email || 'Unknown',
      action: DECISION_ACTIONS[entry.action] ?? null,
    })
  }

  return events.sort((a, b) => new Date(a.at) - new Date(b.at))
}

/** The full invoice the detail page renders. */
export function adaptInvoiceDetail(detail) {
  const flags = (detail.flags ?? []).map(adaptFlag)
  const vendor = detail.vendor ?? {}
  const decisionEntry = (detail.timeline ?? []).find((e) => DECISION_ACTIONS[e.action])

  return {
    id: detail.id,
    vendorId: detail.vendor_id ?? null,
    vendor: detail.vendor_name ?? vendor.name ?? '—',
    vendorDomain: vendor.email_domain ?? null,
    invoiceNumber: detail.invoice_number,
    invoiceDate: detail.invoice_date,
    dueDate: detail.due_date,
    receivedAt: detail.created_at,
    amount: toNumber(detail.amount),
    gstAmount: toNumber(detail.gst_amount, null),
    gstin: detail.gstin,
    bankAccount: detail.bank_account,
    ifsc: detail.ifsc,
    senderEmail: detail.sender_email,
    currency: detail.currency ?? 'INR',
    riskScore: detail.risk_score ?? 0,
    status: detail.status,
    flags,
    mainFlag: flags[0]?.title ?? null,
    documentUrl: detail.document_url ?? null,

    decision: decisionEntry
      ? {
          action: DECISION_ACTIONS[decisionEntry.action],
          label: DECISION_LABELS[decisionEntry.action] ?? decisionEntry.action,
          note: decisionEntry.note ?? '',
          at: decisionEntry.created_at,
          by: decisionEntry.user_name || decisionEntry.user_email || 'Unknown',
        }
      : null,

    vendorRecord: {
      id: vendor.id ?? null,
      name: vendor.name ?? detail.vendor_name ?? '—',
      domain: vendor.email_domain ?? null,
      gstin: vendor.gstin ?? null,
      bankAccount: detail.vendor_bank_account ?? null,
      ifsc: detail.vendor_ifsc ?? null,
      // Not exposed by the API; the recommendation text carries the number.
      phoneOnRecord: null,
      trusted: vendor.is_trusted ?? false,
      matchMethod: vendor.match_method ?? null,
    },

    recommendation: detail.recommendation
      ? { verdict: detail.recommendation.verdict, steps: detail.recommendation.steps ?? [] }
      : null,

    activity: adaptTimeline(detail),

    // The amount-evidence chart reads its history from the flag's own evidence.
    vendorHistory: [],

    queue: {
      position: detail.queue_position ?? null,
      total: detail.queue_total ?? 0,
      previousId: detail.previous_invoice_id ?? null,
      nextId: detail.next_invoice_id ?? null,
    },
  }
}

/** A row in the vendor table. */
export function adaptVendorRow(row) {
  return {
    id: row.id,
    name: row.name,
    gstin: row.gstin,
    domain: row.email_domain,
    invoiceCount: row.invoice_count,
    averageAmount: toNumber(row.average_amount),
    totalValue: toNumber(row.average_amount) * row.invoice_count,
    lastInvoiceDate: row.last_invoice_date,
    flaggedCount: row.flagged_count,
    trusted: row.is_trusted,
    bankChangedRecently: row.bank_changed_recently,
    lastBankChangeOn: row.last_bank_change_on,
    isNew: row.invoice_count <= 1,
    firstSeen: null,
  }
}

/** The vendor profile. */
export function adaptVendorDetail(detail) {
  return {
    id: detail.id,
    name: detail.name,
    gstin: detail.gstin,
    domain: detail.email_domain,
    trusted: detail.is_trusted,
    firstSeen: detail.first_seen,
    invoiceCount: detail.stats.total_invoices,
    totalValue: toNumber(detail.stats.total_value),
    averageAmount: toNumber(detail.stats.average_amount),
    flaggedCount: detail.stats.flagged_count,
    lastInvoiceDate: detail.trend?.length ? detail.trend[detail.trend.length - 1].date : null,
    bankChangedRecently: (detail.bank_history ?? []).some((h) => {
      const days = (Date.now() - new Date(h.changed_on)) / 86400000
      return days <= 30
    }),
    // Masked by the API; there is no comparison to make on this page.
    bankAccount: detail.bank.account_masked,
    ifsc: detail.bank.ifsc,
    phoneOnRecord: null,
    bankChanges: (detail.bank_history ?? []).map((h) => ({
      id: h.id,
      from: h.old_account_masked,
      to: h.new_account_masked,
      ifscFrom: h.old_ifsc,
      ifscTo: h.new_ifsc,
      changedOn: h.changed_on,
      verified: h.verified,
      source: h.verified ? 'Confirmed' : 'Not yet confirmed',
    })),
    trend: (detail.trend ?? []).map((point) => ({
      id: point.invoice_id,
      invoiceNumber: point.invoice_number,
      date: point.date,
      amount: toNumber(point.amount),
      riskScore: point.risk_score ?? 0,
      status: point.status,
    })),
    invoices: (detail.trend ?? [])
      .map((point) => ({
        id: point.invoice_id,
        invoiceNumber: point.invoice_number,
        invoiceDate: point.date,
        dueDate: null,
        amount: toNumber(point.amount),
        riskScore: point.risk_score ?? 0,
        status: point.status,
        vendor: detail.name,
        mainFlag: null,
      }))
      .reverse(),
  }
}

/** The dashboard alert list, which has no status of its own. */
export function adaptAlert(alert) {
  const score = alert.risk_score ?? 0
  return {
    id: alert.id,
    vendor: alert.vendor_name ?? '—',
    invoiceNumber: alert.invoice_number,
    amount: toNumber(alert.amount),
    riskScore: score,
    // The API sends the score, not the band; they are the same thing.
    status: bandForScore(score).status,
    mainFlag: alert.top_flag_title ?? null,
    receivedAt: alert.created_at,
  }
}
