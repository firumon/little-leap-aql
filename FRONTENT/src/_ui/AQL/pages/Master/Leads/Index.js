// Section order IS the urgency order. Each widget has its own name because a
// placeholder identity resolves once per page — three rows cannot all be `MetricCards`.
export default {
  sections: [
    'PageHeader',
    'LiveLeads',
    'NewLeads',
    'MonthlyOutcomes',
    'OnHoldLeads',
    'NotStartedLeads',
    'LocationCoverage',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List']
}
