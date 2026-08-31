// `/operation/purchase-requisitions/{code}/_action/review`.
// The reviewer reads the request, then decides. The sticky bar owns every verdict.
export default {
  sections: ['PageHeader'],
  contents: ['ReviewSummary', 'ReviewDecision'],

  PropsPageHeader: {
    title: 'Review Requisition',
    reload: false
  }
}
