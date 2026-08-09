export default {
  sections: ['PageHeader'],
  contents: [
    'OutletSelection',
    'AdjustItems',
    'NewItems',
    'Review',
    'SubmitOptions'
  ],
  PropsPageHeader: {
    reload: false
  },
  // `AdjustItems`/`NewItems` are shared with the Edit page, which has no wizard —
  // so the step they belong to is declared here rather than hardcoded in them.
  PropsAdjustItems: { step: 2 },
  PropsNewItems: { step: 2 }
}
