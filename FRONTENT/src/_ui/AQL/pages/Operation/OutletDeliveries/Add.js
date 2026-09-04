import { useAuth } from 'src/composables/core/useAuth'
import { toDateOnly } from 'src/utils/dateHelpers'
import { DRAFT } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

const RESOURCE = 'OutletDeliveries'

/**
 * OutletDeliveries › Add — two steps: pick the allocated lines, then check the warehouse
 * pick list. The button table per step lives in `Add/PageAction.js`.
 *
 * Reload is off because the run is being built in `pageState` and a reload would drop it.
 *
 * ── THE NODE IS LIVE FROM THE FIRST RENDER ──
 * `ready` runs once per page and is the only hook with page lifetime, so this is where the
 * manifest node is seeded (UI_PAGE_STATE.md §14). It is a real `OutletDeliveries` row from
 * the moment step 1 draws: `Date`, `UserName`, `Progress` and `Status` are already on it,
 * and ticking a line writes straight into `OutletRestockItemCodes`. Nothing is assembled at
 * submit time.
 *
 * `reset: true` drops whatever the previous page left behind — `Page.vue` keeps ONE
 * pageState for every resource page in the session, so the node sitting here may be the
 * manifest the View page just hydrated. Without the wipe, submit would issue an UPDATE
 * against a record the user never opened.
 */
export default {
  sections: ['PageHeader'],
  contents: ['SelectAllocations', 'PickSummary'],

  PropsPageHeader: {
    title: 'New Delivery Run',
    reload: false
  },

  PropsSelectAllocations: { step: 1 },
  PropsPickSummary: { step: 2 },

  ready ({ pageState }) {
    // Safe outside setup: `useAuth` only reaches Pinia stores and calls no `inject()`.
    const { user } = useAuth()

    pageState.initResource(RESOURCE, {
      isPrimaryKey: true,
      reset: true,
      fields: {
        Date: toDateOnly(new Date()),
        UserName: String(user.value?.name || user.value?.email || '').trim(),
        Progress: DRAFT,
        OutletRestockItemCodes: '',
        Status: 'Active'
      }
    })
  }
}
