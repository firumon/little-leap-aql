import { watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { buildDeliveryEditManifestNodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryPayload'
import { restockItemRows } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import { orsisForDelivery } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

const NODE = 'OutletDeliveries'
const CODES = 'OutletRestockItemCodes'

/**
 * OutletDeliveries › Edit — page contract.
 *
 *   single step   adjust the line-up   →   [ Cancel ] [ Save Delivery ]
 *
 * ── WHAT IS EDITABLE ──
 * The manifest's LINE-UP, and nothing else. `Date` and `UserName` record who built the run
 * and when; `Progress` and every stamp are workflow columns written by the action routes
 * that cause each transition and are never form fields in any state (§13.3). So there is no
 * `Update` content here at all — the whole page is the selection grid, which is also why
 * §13.0's test lands on a workflow form exactly as it does for Add.
 *
 * ── THE SAME TWO CARDS AS ADD ──
 * `WarehouseFilter` and `AllocationSelectionGrid` are resolved at the RESOURCE tier and
 * listed in both contracts (§13.4, §3.1). The single difference is the set they offer: Add
 * shows the free queue, Edit shows the free queue PLUS this manifest's current lines, which
 * `useDeliverySelection` decides from the record rather than from which page is open. The
 * grid seeds itself with the manifest's existing line-up, so an untouched save is a no-op
 * rather than an emptying.
 *
 * A line already DELIVERED renders locked rather than hidden: those units are on a shelf and
 * the payload builder refuses to drop them, so showing them greyed is the honest picture of
 * what the run now contains.
 *
 * ── THE LOCK ──
 * `EditLockBanner` leads the stack. The Edit URL is directly reachable, so a manifest
 * completed or cancelled since the link was opened says so above the grid rather than
 * failing at the sticky bar. It renders nothing on an editable record.
 *
 * The header's reload control is suppressed because the page's state is owned by `pageState`
 * (§5.5): reloading mid-edit would discard every change to the ticks.
 */
export default {
  sections: ['PageHeader', 'EditLockBanner'],
  contents: ['WarehouseFilter', 'AllocationSelectionGrid'],

  PropsPageHeader: {
    title: 'Edit Delivery',
    reload: false
  },

  // Seed the grid from the manifest, then keep the batch applied as the ticks change, so
  // `PageAction.submit` only validates (UI_PAGE_STATE.md §5B).
  ready ({ pageState, resourceRecord }) {
    const { user } = useAuth()
    const manifest = () => resourceRecord?.record?.value || {}

    watch(() => String(manifest().Code || '').trim(), (code) => {
      if (!code || pageState.hasNode(NODE)) return
      pageState.initResource(NODE, { isPrimaryKey: true, code })
      pageState.setRecord(CODES, orsisForDelivery(manifest()).join(','), NODE)
    }, { immediate: true })

    watch(() => String(pageState.getRecord(CODES, NODE) ?? ''), (csv) => {
      const record = manifest()
      if (!String(record.Code || '').trim()) return
      pageState.applyLive(buildDeliveryEditManifestNodes({
        record,
        newOrsiCodes: csv.split(',').map((c) => c.trim()).filter(Boolean),
        allOrsiRows: restockItemRows(),
        actorName: user.value?.name || user.value?.email || ''
      }))
    })
  }
}
