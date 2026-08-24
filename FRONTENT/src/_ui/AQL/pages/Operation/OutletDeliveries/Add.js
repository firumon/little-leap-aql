// Two steps: pick the allocated lines, then check the warehouse pick list.
// Reload is off because the ticks live in `pageState` and a reload would drop them.
export default {
  sections: ['PageHeader'],
  contents: ['SelectAllocations', 'PickSummary'],

  PropsPageHeader: {
    title: 'New Delivery Run',
    reload: false
  },

  PropsSelectAllocations: { step: 1 },
  PropsPickSummary: { step: 2 }
}
