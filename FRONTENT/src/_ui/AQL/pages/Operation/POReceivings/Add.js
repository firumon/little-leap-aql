// Two steps: which order arrived, then the counts. Both cards are shared with Edit.
export default {
  sections: ['PageHeader'],
  contents: ['ReceivingHeaderForm', 'InspectionGrid'],

  PropsPageHeader: {
    title: 'New PO Receiving',
    reload: false
  },

  PropsReceivingHeaderForm: { step: 1 },
  PropsInspectionGrid: { step: 2 }
}
