import { inject, computed } from 'vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import {
  CANCEL_REASON,
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
 * `CancelRestock/PageAction.js` submits from, so the screen and the batch cannot drift.
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
