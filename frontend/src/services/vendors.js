/** Vendors, against the real backend. */
import { api } from './api'
import { adaptVendorDetail, adaptVendorRow } from './adapters'

export const VENDOR_TABS = [
  { key: 'all', label: 'All' },
  { key: 'trusted', label: 'Trusted' },
  { key: 'new', label: 'New' },
  { key: 'flagged', label: 'Flagged' },
]

const SORT_MAP = {
  name: 'name',
  gstin: 'name',
  domain: 'name',
  invoiceCount: 'invoice_count',
  averageAmount: 'average_amount',
  lastInvoiceDate: 'last_invoice_date',
  flaggedCount: 'flagged_count',
}

export async function listVendors({ tab = 'all', search = '', sort = 'name', direction = 'asc' } = {}) {
  const data = await api.get('/vendors', {
    filter: tab,
    search: search?.trim() || undefined,
    sort: SORT_MAP[sort] ?? 'name',
    order: direction,
    // The vendor list is short; one page keeps the client-side tabs honest.
    page_size: 100,
  })

  return {
    rows: (data.rows ?? []).map(adaptVendorRow),
    counts: data.counts,
    total: data.total,
  }
}

export async function getVendor(id) {
  return adaptVendorDetail(await api.get(`/vendors/${id}`))
}

export async function setVendorTrusted(id, trusted) {
  const data = await api.patch(`/vendors/${id}/trust`, { is_trusted: trusted })
  return { id: data.id, trusted: data.is_trusted }
}
