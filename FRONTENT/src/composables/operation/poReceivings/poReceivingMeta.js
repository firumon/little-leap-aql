export const PO_RECEIVING_PROGRESS_ORDER = ['DRAFT', 'CONFIRMED', 'GRN_GENERATED', 'CANCELLED', 'OTHER']

export const PO_RECEIVING_PROGRESS_META = {
  DRAFT: { label: 'Draft', color: 'blue-grey', icon: 'edit_note' },
  CONFIRMED: { label: 'Confirmed', color: 'positive', icon: 'task_alt' },
  GRN_GENERATED: { label: 'GRN Generated', color: 'primary', icon: 'receipt_long' },
  CANCELLED: { label: 'Cancelled', color: 'negative', icon: 'cancel' },
  OTHER: { label: 'Other', color: 'grey', icon: 'help_outline' }
}

export const PO_RECEIVING_REPORT_PLACEHOLDERS = [
  { key: 'damage-list', label: 'Damage List', icon: 'broken_image', disabled: true, caption: 'Report template not implemented in this phase.' },
  { key: 'reject-list', label: 'Reject List', icon: 'block', disabled: true, caption: 'Report template not implemented in this phase.' },
  { key: 'short-list', label: 'Short List', icon: 'remove_circle_outline', disabled: true, caption: 'Report template not implemented in this phase.' },
  { key: 'excess-list', label: 'Excess List', icon: 'add_circle_outline', disabled: true, caption: 'Report template not implemented in this phase.' }
]

export const SYSTEM_REPLACEMENT_REASON = 'System replacement: new receiving started for same PO'

export function progressMeta(progress) {
  return PO_RECEIVING_PROGRESS_META[progress] || PO_RECEIVING_PROGRESS_META.OTHER
}

export function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

export function todayInputValue() {
  return new Date().toISOString().split('T')[0]
}
