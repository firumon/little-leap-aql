export default {
  sections: ['PageHeader', 'EditLockBanner'],
  contents: [
    'FormReturnedItem',
    'FormBilledOn',
    'FormQuantityValue',
    'FormCommercialCredit',
    'FormReason',
    'FormPhysicalStock'
  ],

  // Page.vue keeps ONE pageState per Page mount and never clears it, so a node left by the
  // page visited before this one survives — and an action route for the SAME record leaves
  // one with the SAME code, which would satisfy the hydration guard below and leave the
  // form empty. Flush first (UI_PAGE_STATE_NODES.md §5.7A).
  ready ({ pageState }) {
    pageState.resetForResource('OutletReturns')
  },

  PropsPageHeader: {
    title: 'Edit Return',
    reload: false
  },

  PropsFormReturnedItem: {
    mode: 'edit'
  }
}
