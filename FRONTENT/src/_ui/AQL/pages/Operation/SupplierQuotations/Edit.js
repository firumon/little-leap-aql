// The same cards as Add, all on one view: the RFQ and supplier are already settled.
export default {
  sections: ['PageHeader', 'EditLockBanner'],
  contents: ['QuoteLines', 'QuotationTerms'],

  PropsPageHeader: {
    title: 'Revise Quotation',
    reload: false
  }
}
