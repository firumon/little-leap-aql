// Same cards as Add, minus the fields a raised requisition may not re-point.
// The lock banner explains a record that has moved on before the user types.
export default {
  sections: ['PageHeader', 'EditLockBanner'],
  contents: ['Update', 'SubmitOptions'],

  PropsPageHeader: {
    title: 'Edit Purchase Requisition',
    reload: false
  },
  PropsUpdate: {
    hideFields: [
      'ProcurementCode',
      'PRDate',
      'Progress',
      'ProgressRevisionRequiredAt',
      'ProgressRevisionRequiredBy',
      'ProgressRevisionRequiredComment',
      'ProgressApprovedAt',
      'ProgressApprovedBy',
      'ProgressApprovedComment',
      'ProgressRejectedAt',
      'ProgressRejectedBy',
      'ProgressRejectedComment'
    ]
  }
}
