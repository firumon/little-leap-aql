export default {
  sections: ['PageHeader', 'EditLockBanner'],
  contents: [
    'InvoiceTerms',
    'InvoiceItems',
    'BillingSummary'
  ],

  PropsPageHeader: {
    title: 'Edit Invoice',
    // pageState owns the typed prices; a reload would throw them away.
    reload: false
  }
}
