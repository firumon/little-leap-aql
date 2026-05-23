export default {
  metadata: {
    id: 'purchase_order_summary',
    scope: 'operations',
    resource: 'purchaseOrders',
    permission: {
      purchaseOrders: 'read'
    },
    config: {
      type: 'BarChartWidget',
      title: 'PO Amounts by Vendor',
      icon: 'storefront',
      color: 'purple',
      weight: 80,
      layout: {
        xs: 12,
        sm: 12,
        md: 8,
        lg: 8
      }
    },
    dataSource: {
      resource: 'purchaseOrders',
      evaluate: (records) => {
        const groups = {}
        records.forEach((rec) => {
          const supplier = rec.SupplierCode || 'Other Vendor'
          const amount = Number(rec.TotalAmount || 0)
          groups[supplier] = (groups[supplier] || 0) + amount
        })

        return Object.entries(groups)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
      }
    }
  }
}
