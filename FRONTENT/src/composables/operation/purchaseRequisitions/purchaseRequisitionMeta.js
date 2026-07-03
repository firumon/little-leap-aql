const TYPE_META = {
  STOCK: { icon: 'inventory_2', color: '#0F2B4A', bg: '#EEF3F9', ring: '#D0DEF0' },
  PROJECT: { icon: 'architecture', color: '#1A6FAD', bg: '#E8F2FB', ring: '#BDD9F0' },
  SALES: { icon: 'storefront', color: '#1A7A4A', bg: '#E8F6EE', ring: '#B8E4CB' },
  ASSET: { icon: 'build_circle', color: '#C97B1A', bg: '#FDF3E3', ring: '#F5D9A0' }
}

const PRIORITY_META = {
  Low: { icon: 'arrow_downward', color: '#1A7A4A', bg: '#E8F6EE' },
  Medium: { icon: 'remove', color: '#C97B1A', bg: '#FDF3E3' },
  High: { icon: 'arrow_upward', color: '#C0362C', bg: '#FBE9E8' },
  Urgent: { icon: 'priority_high', color: '#7B1FA2', bg: '#F5E5FB' }
}

function humanizeType(value) {
  const text = (value || '').toString()
  return text ? text.charAt(0) + text.slice(1).toLowerCase() : ''
}

export function mapPurchaseRequisitionTypeOptions(values = []) {
  return values.map((value) => ({
    value,
    label: humanizeType(value),
    ...TYPE_META[value]
  }))
}

export function mapPurchaseRequisitionPriorityOptions(values = []) {
  return values.map((value) => ({
    value,
    label: value,
    ...PRIORITY_META[value]
  }))
}

export function purchaseRequisitionNeedsRefCode(type) {
  return ['PROJECT', 'SALES'].includes((type || '').toString())
}

