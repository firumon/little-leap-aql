const RESOURCE = 'OutletPayments'

export default {
  sections: [
    'PageHeader',
    'CollectorPendingList',
  ],
  contents: [
    'PendingMetrics',
    'OutletWisePending',
    'DayWiseCollection',
    'OutletPendingList',
    'OutletPaymentsList',
    'InvoiceAllocationList'
  ],
  permissions: {
    CollectorPendingList: ['OutletPayments:approve'],
    OutletPendingList: ['OutletPayments:approve'],
    OutletPaymentsList: ['OutletPayments:approve'],
    InvoiceAllocationList: ['OutletPayments:approve']
  },
  PropsPageHeader: {
    title: 'Approve Outlet Payments',
    subtitle: 'Review collections and settle outstanding invoices',
    reload: false
  },
  ready ({ pageState, routeInfo }) {
    pageState.resetForResource(RESOURCE)
    const q = routeInfo?.value?.query || routeInfo?.query || {}
    const hasTarget = Boolean(q.userCode || q.user || q.outletCode || q.outlet || q.paymentCode || q.code)
    if (pageState?.meta) {
      pageState.meta.currentStep = hasTarget ? 2 : 1
    }
  }
}
