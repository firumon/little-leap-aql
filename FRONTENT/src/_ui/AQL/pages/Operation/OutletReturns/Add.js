import { buildReturnInitNodes } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'

const RESOURCE = 'OutletReturns'

export default {
  sections: ['PageHeader'],
  contents: [
    'FormReturnedItem',
    'FormBilledOn',
    'FormQuantityValue',
    'FormCommercialCredit',
    'FormReason',
    'FormPhysicalStock'
  ],

  PropsPageHeader: {
    title: 'Log Outlet Return',
    reload: false
  },

  PropsContent: (pageProps) => ({ gutter: pageProps.gutter }),

  ready ({ pageState }) {
    // Page.vue keeps ONE pageState per Page mount and never clears it, so the nodes,
    // controls and DERIVES of the last page visited are still here. Flush them first.
    pageState.resetForResource(RESOURCE)
    pageState.applyNodes(buildReturnInitNodes())
  }
}
