// Three steps: which RFQ and supplier replied, what they quoted, then terms and charges.
export default {
  sections: ['PageHeader'],
  contents: ['SelectRfqSupplier', 'QuoteLines', 'QuotationTerms'],

  PropsPageHeader: {
    title: 'Capture Quotation',
    reload: false
  },

  PropsSelectRfqSupplier: { step: 1 },
  PropsQuoteLines: { step: 2 },
  PropsQuotationTerms: { step: 3 }
}
