// `/operation/purchase-orders/{code}/cancel-order`. CancelReview is the hydration point.
export default {
  sections: ['PageHeader'],
  contents: ['CancelReview'],

  PropsPageHeader: {
    title: 'Cancel Purchase Order',
    reload: false
  }
}
