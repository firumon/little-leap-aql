// OutletConsumptions > View — local action. Found by useLocalResourceActions and
// added to the FAB cluster. It opens the invoice wizard with this consumption
// already ticked, which the sheet's own navigate config cannot do (no query).
export default {
  action: 'CreateInvoice',
  label: 'Create Invoice',
  icon: 'receipt_long',
  color: 'primary',
  kind: 'navigate',
  // The invoice is written on the OTHER resource, so the gate is that one's.
  permission: { OutletConsumptionInvoices: 'create' },
  navigate: {
    target: 'add',
    scope: 'operation',
    resourceSlug: 'outlet-consumption-invoices',
    query: (record) => ({
      outletCode: record?.OutletCode,
      consumptionCode: record?.Code
    })
  },
  visibleWhen: [
    { column: 'Progress', op: 'eq', value: 'PENDING_INVOICE_GENERATION' }
  ]
}
