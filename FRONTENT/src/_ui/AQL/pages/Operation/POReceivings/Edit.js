// Resuming a draft: the order is already fixed, so both cards render on one view.
export default {
  sections: ['PageHeader'],
  contents: ['ReceivingHeaderForm', 'InspectionGrid'],

  PropsPageHeader: {
    title: 'Resume PO Receiving',
    reload: false
  }
}
