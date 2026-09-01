// `/operation/outlet-payments/{code}/_action/cancel`. CancelConfirm is the hydration point.
export default {
  sections: ['PageHeader'],
  contents: ['CancelConfirm'],

  PropsPageHeader: {
    title: 'Cancel Payment Receipt',
    reload: false
  }
}
