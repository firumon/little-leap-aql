export {
  RESOURCE_NAME,
  invoiceItemOf,
  invoiceItemRow,
  nodePayloadForParent
} from '../composables/useInvoiceItemPayload'

export const isActiveRow = (row) => {
  const status = String(row?.Status ?? 'Active').trim()
  return !status || status.toUpperCase() === 'ACTIVE'
}
