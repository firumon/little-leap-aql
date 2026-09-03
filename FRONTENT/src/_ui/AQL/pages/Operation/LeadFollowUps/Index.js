// Section order IS the urgency order. Each widget has its own name because a
// placeholder identity resolves once per page — two counter rows cannot both be
// `MetricCards`, and this page carries a Gauge and a bar besides.
export default {
  sections: [
    'PageHeader',
    'RecentlyDone',
    'OverdueWork',
    'ActivityAge',
    'TeamActivity',
    'ScheduledCoverage',
    'FollowUpCompletion',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List']
}
