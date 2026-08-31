import { inject, computed, watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import {
  CANCEL_REASON,
  activeItemsOf,
  buildRestockCancellationNodes,
  restockCancellationPreview
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockCancellation'

/**
 * OutletRestocks › CancelRestock — the injection relay for the cancellation route
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `CancelRestock/`, the page tier (§6.2). Only `CancelRestock.js` provides this
 * context and only its single card reads it.
 *
 * The ONLY `inject()` caller on this page. Unlike the consumption cancellation route, this
 * one loads NOTHING itself: an `_action` route on OutletRestocks resolves through the
 * record loader, so the request and its child rows arrive on `resourceRecord` already.
 *
 * The preview is Layer 2's answer, read here rather than re-derived — the same predicates
 * `CancelRestock/PageAction.js` validates from, so the screen and the batch cannot drift.
 *
 * It also keeps the BATCH live: the cancellation nodes are applied as soon as a reason is
 * typed, so `pageState` always holds exactly what will be sent and `PageAction.submit`
 * only has to validate (UI_PAGE_STATE.md §5A).
 */
export function useRestockCancelContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()

  const asRow = (value) => (value && typeof value === 'object' ? value : {})
  const PARENT = 'OutletRestocks'
  const CHILD = 'OutletRestockItems'

  const restock = computed(() => resourceRecord?.record?.value || {})

  const items = computed(() => {
    const rows = (resourceRecord?.childRecordsByResource?.value || {})[CHILD]
    return Array.isArray(rows) ? rows.map(asRow) : []
  })

  /** What returns, what is untouched, and where the parent lands — one domain call. */
  const preview = computed(() => restockCancellationPreview(restock.value, items.value))

  const gate = computed(() => preview.value.gate)

  const reason = computed(() => pageState?.getControls(CANCEL_REASON, null, PARENT) || '')
  const setReason = (value) => pageState?.setControls(CANCEL_REASON, value, PARENT)

  const { user } = useAuth()
  const actor = () => user.value?.name || user.value?.email || ''

  // Keyed off the REASON and the rows, never off the nodes the rebuild writes, so this
  // cannot feed itself. A blank reason means there is nothing to cancel yet.
  watch([reason, restock, items], () => {
    if (!pageState) return
    const parent = restock.value
    const why = String(reason.value || '').trim()
    if (!why || !String(parent.Code || '').trim() || !gate.value.allowed) {
      pageState.removeNode('StockMovements')
      pageState.removeNode(CHILD)
      pageState.setResource(PARENT, { record: {} })
      return
    }
    pageState.applyNodes(buildRestockCancellationNodes(parent, activeItemsOf(items.value, parent.Code), actor(), why))
  }, { immediate: true })

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    ui,
    restock,
    items,
    preview,
    gate,
    reason,
    setReason,
    evaluate: (val) => evaluateProp(val, resourceRecord, resourceConfig)
  }
}
