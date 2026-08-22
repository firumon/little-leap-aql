export default {
  sections: ['PageHeader', 'EditLockBanner'],
  contents: [
    'FormReturnedItem',
    'FormBilledOn',
    'FormQuantityValue',
    'FormCommercialCredit',
    'FormReason',
    'FormPhysicalStock'
  ],

  PropsPageHeader: {
    title: 'Edit Return',
    reload: false
  },

  PropsFormReturnedItem: {
    mode: 'edit'
  },

  // Every card spaces itself on the PAGE's own gutter rather than its own fallback (§10.2).
  PropsContent: (pageProps) => ({ gutter: pageProps.gutter }),
  PropsSection: (pageProps) => ({ gutter: pageProps.gutter })
}
