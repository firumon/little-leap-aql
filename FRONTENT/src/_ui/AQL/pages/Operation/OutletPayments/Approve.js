const RESOURCE = 'OutletPayments'

export default {
  sections: ['PageHeader'],
  contents: ['HandoverApprove'],
  permissions: {
    HandoverApprove: ['OutletPayments:approve']
  },
  PropsPageHeader: {
    title: 'Approve Outlet Payment',
    reload: false
  },
  ready ({ pageState }) {
    pageState.resetForResource(RESOURCE)
  }
}
