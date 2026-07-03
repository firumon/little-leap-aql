const DEFAULTS = {
  leadTimeTypes: ['FLEXIBLE', 'STRICT', 'RANGE_10', 'RANGE_25'],
  shippingTermModes: ['ANY', 'FIXED'],
  shippingTerms: ['EXW', 'FOB', 'CIF', 'DDP'],
  paymentTermModes: ['ANY', 'FIXED'],
  paymentTerms: ['ADVANCE', 'PARTIAL', 'CAD', 'LC', 'CREDIT'],
  quotationValidityModes: ['MIN_REQUIRED', 'MAX_ALLOWED', 'FLEXIBLE'],
  deliveryModes: ['ANY', 'FIXED']
}

export const RFQ_DESCRIPTIONS = {
  leadTimeTypes: {
    FLEXIBLE: 'Supplier can propose a practical delivery lead time.',
    STRICT: 'Supplier must match the requested lead time.',
    RANGE_10: 'Supplier may vary within about 10 percent.',
    RANGE_25: 'Supplier may vary within about 25 percent.'
  },
  shippingTerms: {
    EXW: 'Ex Works: supplier makes goods available at factory; buyer handles pickup, shipping, customs, and delivery.',
    FOB: 'Free On Board: supplier handles local transport and export clearance to origin port; buyer handles freight and import.',
    CIF: 'Cost, Insurance, Freight: supplier handles freight and insurance to destination port; buyer handles import and local delivery.',
    DDP: 'Delivered Duty Paid: supplier handles delivery, duty, and clearance to the buyer destination.'
  },
  paymentTerms: {
    ADVANCE: 'Prepaid before production or shipment.',
    PARTIAL: 'Split payment, commonly advance plus balance before shipment.',
    CAD: 'Cash against documents: pay after receiving shipping document copy.',
    LC: 'Letter of credit: bank-backed supplier payment.',
    CREDIT: 'Postpaid supplier credit such as 30, 60, or 90 days.'
  },
  quotationValidityModes: {
    MIN_REQUIRED: 'Quotation must stay valid for at least the entered days.',
    MAX_ALLOWED: 'Quotation validity should not exceed the entered days.',
    FLEXIBLE: 'Supplier may propose a validity period.'
  },
  deliveryModes: {
    ANY: 'Supplier may propose suitable delivery handling.',
    FIXED: 'Supplier must follow the requested delivery handling.'
  }
}

const LABELS = {
  FLEXIBLE: 'Flexible',
  STRICT: 'Strict',
  RANGE_10: 'Range 10%',
  RANGE_25: 'Range 25%',
  ANY: 'Any',
  FIXED: 'Fixed',
  EXW: 'EXW',
  FOB: 'FOB',
  CIF: 'CIF',
  DDP: 'DDP',
  ADVANCE: 'Advance',
  PARTIAL: 'Partial Advance',
  CAD: 'Against Documents',
  LC: 'Letter of Credit',
  CREDIT: 'Credit Terms',
  MIN_REQUIRED: 'Minimum Required',
  MAX_ALLOWED: 'Maximum Allowed'
}

function labelFor(value) {
  return LABELS[value] || (value || '').toString().replace(/_/g, ' ')
}

export function mapRFQOptions(values = [], descriptionGroup = '') {
  const source = Array.isArray(values) && values.length ? values : DEFAULTS[descriptionGroup] || []
  const descriptions = RFQ_DESCRIPTIONS[descriptionGroup] || {}
  return source.map((value) => ({
    label: labelFor(value),
    value,
    description: descriptions[value] || ''
  }))
}

export function rfqFallbackValues(key) {
  return DEFAULTS[key] || []
}

export function buildPrimaryMeta(rfqHeader, prHeader) {
    if (!rfqHeader) return []

    const formatDate = (val) => {
        if (!val) return '-'
        const d = new Date(val)
        return isNaN(d.getTime()) ? val : d.toLocaleDateString()
    }

    return [
        { label: 'RFQ Date', value: formatDate(rfqHeader.RFQDate) },
        { label: 'Submission Deadline', value: formatDate(rfqHeader.SubmissionDeadline) },
        { label: 'PR Code', value: rfqHeader.PurchaseRequisitionCode },
        { label: 'Procurement Code', value: rfqHeader.ProcurementCode },
        { label: 'Lead Time', value: `${rfqHeader.LeadTimeDays || 0} days - ${rfqHeader.LeadTimeType || '-'}` },
        { label: 'Validity', value: `${rfqHeader.QuotationValidityDays || 0} days - ${rfqHeader.QuotationValidityMode || '-'}` },
        { label: 'Shipping', value: `${rfqHeader.ShippingTermMode || 'ANY'} ${rfqHeader.ShippingTerm || ''}` },
        { label: 'Payment', value: `${rfqHeader.PaymentTermMode || 'ANY'} ${rfqHeader.PaymentTerm || ''}` },
        { label: 'Delivery', value: rfqHeader.DeliveryMode || '-' }
    ]
}
