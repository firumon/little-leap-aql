export const EXTRA_CHARGE_KEYS = ['tax', 'freight', 'commission', 'handling', 'other']

export const RESPONSE_TYPES = ['QUOTED', 'PARTIAL', 'DECLINED']
export const PROGRESS_ORDER = ['RECEIVED', 'ACCEPTED', 'REJECTED']

const DEFAULTS = {
  responseTypes: RESPONSE_TYPES,
  progress: PROGRESS_ORDER,
  extraChargeTypes: EXTRA_CHARGE_KEYS,
  currencies: ['AED'],
  leadTimeTypes: ['FLEXIBLE', 'STRICT', 'RANGE_10', 'RANGE_25'],
  deliveryModes: ['ANY', 'FIXED'],
  shippingTerms: ['EXW', 'FOB', 'CIF', 'DDP'],
  paymentTerms: ['ADVANCE', 'PARTIAL', 'CAD', 'LC', 'CREDIT']
}

const LABELS = {
  QUOTED: 'Quoted',
  PARTIAL: 'Partial',
  DECLINED: 'Declined',
  RECEIVED: 'Received',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  tax: 'Tax',
  freight: 'Freight',
  commission: 'Commission',
  handling: 'Handling',
  other: 'Other',
  AED: 'AED'
}

const PROGRESS_META = {
  RECEIVED: { key: 'received', label: 'Received', color: '#0f766e', icon: 'mark_email_read', actionHint: 'Review' },
  ACCEPTED: { key: 'accepted', label: 'Accepted', color: '#15803d', icon: 'verified', actionHint: 'View' },
  REJECTED: { key: 'rejected', label: 'Rejected', color: '#b91c1c', icon: 'block', actionHint: 'View' },
  OTHER: { key: 'other', label: 'Other', color: '#475569', icon: 'folder_open', actionHint: 'Open' }
}

export function labelFor(value) {
  return LABELS[value] || (value || '').toString().replace(/_/g, ' ')
}

export function mapOptions(values = [], fallbackKey = '') {
  const source = Array.isArray(values) && values.length ? values : (DEFAULTS[fallbackKey] || [])
  return source.map((value) => ({ label: labelFor(value), value }))
}

export function progressMeta(progress) {
  const key = (progress || '').toString().trim().toUpperCase()
  return PROGRESS_META[key] || PROGRESS_META.OTHER
}

export function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatCurrency(amount, currency = 'AED') {
  const value = Number(amount) || 0
  return `${currency || 'AED'} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
