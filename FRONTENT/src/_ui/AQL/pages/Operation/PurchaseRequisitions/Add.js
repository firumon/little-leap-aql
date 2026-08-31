// Generated form: the requisition's own columns plus its item lines, then the
// draft-or-submit choice. Stamps are written by the sticky bar, never as fields.
export default {
  sections: ['PageHeader'],
  contents: ['Create', 'SubmitOptions'],

  PropsPageHeader: {
    title: 'New Purchase Requisition',
    reload: false
  },
  PropsCreate: {
    hideFields: [
      'ProcurementCode',
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
