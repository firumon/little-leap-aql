export default {
  sections: [
    'PageHeader',
    'OutletDetails',
    'SubOutlets',
    'OperatingRules',
    'SummaryStats',
    'Visits',
    'Restocks',
    'Consumptions',
    'Returns',
    'Invoices',
    'Payments',
    'CurrentStock'
  ],
  contents: [],

  PropsPageHeader: {
    title: (record) => (record?.Name || record?.name || 'Outlet'),
    subtitle: 'Visits, restocks, consumptions, returns, invoices, payments and stock in one place',
    reload: true
  }
}

