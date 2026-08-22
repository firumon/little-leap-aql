export default {
  sections: ['PageHeader'],
  contents: [
    'FormReturnedItem',
    'FormBilledOn',
    'FormQuantityValue',
    'FormCommercialCredit',
    'FormReason',
    'FormPhysicalStock'
  ],

  PropsPageHeader: {
    title: 'Log Outlet Return',
    reload: false
  },

  PropsContent: (pageProps) => ({ gutter: pageProps.gutter })
}
