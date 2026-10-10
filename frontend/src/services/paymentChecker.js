/**
 * The payment-request checker.
 *
 * Analysis happens on the server; the two sample messages below stay here
 * because they are demo copy, not data.
 */
import { api } from './api'
import { adaptFlag } from './adapters'

const REQUEST_TYPE_LABELS = {
  bank_change: 'Bank detail change',
  payment_request: 'Payment request',
  other: 'General enquiry',
}

// A known vendor's domain, and the one-character lookalike of it, so the two
// sample messages exercise opposite paths.
const ABC_DOMAIN = 'abctechnologies.com'
const ABC_LOOKALIKE = 'abctechnolgies.com'

export async function analysePaymentRequest({ from = '', subject = '', body = '' } = {}) {
  const data = await api.post('/payment-checker/analyse', {
    from_email: from,
    subject: subject || null,
    body,
  })

  const vendor = data.vendor ?? null

  return {
    riskScore: data.risk_score,
    status: data.status,
    requestType: REQUEST_TYPE_LABELS[data.request_type] ?? 'General enquiry',
    senderDomain: data.sender_domain ?? '',
    matchedVendor: vendor
      ? {
          id: vendor.id,
          name: vendor.name,
          domain: vendor.email_domain,
          bankAccount: null,
          ifsc: data.extracted_ifsc ?? null,
          phoneOnRecord: null,
          exactMatch: vendor.match_method === 'email_domain' || vendor.match_method === 'gstin',
        }
      : null,
    flags: (data.flags ?? []).map(adaptFlag),
    highlights: (data.highlights ?? []).map((hit) => ({
      start: hit.start,
      end: hit.end,
      kind: hit.kind,
      // The component renders `text`; the API calls the same thing `phrase`.
      text: hit.phrase,
      reason: hit.reason,
    })),
    text: data.text ?? '',
    recommendation: {
      verdict: data.recommendation?.verdict ?? '',
      steps: data.recommendation?.steps ?? [],
    },
  }
}


/** A realistic bank-change request from the ABC Technologies lookalike domain. */
export function sampleRequest() {
  return {
    from: `rajesh.kumar@${ABC_LOOKALIKE}`,
    subject: 'URGENT: Updated bank details for invoice ABC/2026/0914',
    body: `Dear Accounts Team,

I hope this message finds you well. Please note that we have changed our bank on account of an internal restructuring, and all future remittances must go to the new account below.

Account name: ABC Technologies
New account number: 9184 7263 5100 94
IFSC: KKBK0007781

Kindly update our records and process invoice ABC/2026/0914 for Rs. 4,86,500 today itself, as our quarter closes before end of day and the old account has already been shut.

I would request you to keep this strictly confidential until our announcement next week, and there is no need to inform the wider procurement team at this stage.

Please confirm once the transfer is done.

Best regards,
Rajesh Kumar
Finance Manager, ABC Technologies`,
  }
}

/** A harmless message, for comparison. */
export function benignRequest() {
  return {
    from: `accounts@${ABC_DOMAIN}`,
    subject: 'Invoice ABC/2026/0820 — payment confirmation',
    body: `Hello,

Thank you for settling invoice ABC/2026/0820 last week. Our accounts team has matched the receipt against our ledger and everything reconciles.

The next invoice for this quarter's support retainer will reach you in the usual cycle. No change to any of our details.

Do let us know if you need a copy of the GST summary for your records.

Kind regards,
Anita Rao
Accounts Receivable, ABC Technologies`,
  }
}
