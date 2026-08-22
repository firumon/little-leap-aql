import { computed } from 'vue'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import {
  progressColor,
  progressIcon,
  progressLabel,
  reasonLabel,
  reasonIcon,
  warehouseActionLabel,
  warehouseActionColor,
  warehouseActionIcon,
  invoiceAdjustmentRequired,
  invoiceAdjustmentDone,
  warehouseActionRequired,
  warehouseActionCompleted,
  workflowStamps,
  returnValueOf
} from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'
import { useReturnViewContext } from './useReturnViewContext'

/**
 * OutletReturns › View — the presentation aggregate all five View cards read.
 *
 * ONE composable, so the cards cannot disagree (UI_MODULE_DEVELOPER_GUIDE.md §7.4). Every
 * card reads a projection of the same derived record rather than each re-deriving its own
 * — which is what makes "what came back" and "what happened to it" impossible to drift
 * apart on screen.
 *
 * Not one business rule is re-derived here. Every predicate, label and colour is a call
 * into `_resource/Operation/OutletReturns` (§4); the master names come from the Outlets,
 * SKUs and Warehouses domains in series, never from a raw store scan (§10.1). What this
 * file adds is display assembly and nothing else.
 *
 * `pending` exists because View cards are declared in `sections`, which render OUTSIDE
 * `<AqlContentWrapper>` and therefore self-guard their own loading and empty states
 * (§10.4, §7.4).
 */
export function useReturnView () {
  const { resourceRecord } = useReturnViewContext()

  const { getOutlet } = useOutletResource()
  const { skuLabelText } = useSkuResource()
  const { getWarehouse } = useWarehouseResource()

  const text = (value) => (value == null ? '' : String(value).trim())

  const record = computed(() => resourceRecord?.record?.value || null)
  const pending = computed(() => resourceRecord?.loading?.value === true)

  /**
   * Master names, resolved through each owning domain.
   *
   * Each falls back to the raw code rather than to a dash: an unresolved code is still
   * information the reader can act on (they can search for it), while an em dash discards
   * it. A blank source stays blank so the card's own row filter can drop the line.
   */
  const outletName = computed(() => {
    const code = text(record.value?.OutletCode)
    if (!code) return ''
    return text(getOutlet(code)?.Name) || code
  })

  const skuName = computed(() => {
    const code = text(record.value?.SKU)
    if (!code) return ''
    return text(skuLabelText(code)) || code
  })

  const warehouseName = computed(() => {
    const code = text(record.value?.WarehouseCode)
    if (!code) return ''
    return text(getWarehouse(code)?.Name) || code
  })

  /**
   * The two tracks, each as a small display object the status cards render directly.
   *
   * `state` is the word the card prints; `color`/`icon` come from the same vocabulary the
   * progress chip uses, so a settled track and a completed return read as the same green.
   */
  const commercialTrack = computed(() => {
    const row = record.value
    if (!row) return null
    const required = invoiceAdjustmentRequired(row)
    const done = invoiceAdjustmentDone(row)
    const invoiceCode = text(row.ConsumptionInvoiceCode)
    return {
      required,
      done,
      invoiceCode,
      state: !required ? 'Not required' : (done ? 'Credited' : 'Pending credit'),
      // A settled-directly credit carries no invoice code — see
      // `buildReturnMarkInvoiceAdjustedBatch`. Saying so is more honest than a blank row.
      detail: !required ? '' : (done ? (invoiceCode || 'Settled directly') : ''),
      color: !required ? 'grey-7' : (done ? 'positive' : 'warning'),
      icon: !required ? 'remove_circle_outline' : (done ? 'check_circle' : 'schedule')
    }
  })

  const warehouseTrack = computed(() => {
    const row = record.value
    if (!row) return null
    const required = warehouseActionRequired(row)
    const done = warehouseActionCompleted(row)
    const disposition = warehouseActionLabel(row)
    return {
      required,
      done,
      disposition,
      warehouseName: warehouseName.value,
      state: !required ? 'Not required' : (done ? (disposition || 'Completed') : 'Pending receipt'),
      color: !required ? 'grey-7' : (done ? warehouseActionColor(row) : 'warning'),
      icon: !required ? 'remove_circle_outline' : (done ? warehouseActionIcon(row) : 'schedule'),
      // Whichever stamp the disposition actually wrote — the other is blank by definition.
      at: text(row.WarehouseActionStockedAt) || text(row.WarehouseActionDisposedAt),
      by: text(row.WarehouseActionStockedBy) || text(row.WarehouseActionDisposedBy),
      disposalReason: text(row.WarehouseActionDisposedReason)
    }
  })

  /** The audit events that actually happened, oldest first — built by Layer 2. */
  const timeline = computed(() => workflowStamps(record.value))

  /** `Qty × Price`, from the one function the Index metric and the invoice also use. */
  const creditValue = computed(() => returnValueOf(record.value))

  return {
    record,
    pending,
    outletName,
    skuName,
    warehouseName,
    commercialTrack,
    warehouseTrack,
    timeline,
    creditValue,
    // Vocabulary passthroughs, so a card has ONE import for its data and its labels.
    progressColor,
    progressIcon,
    progressLabel,
    reasonLabel,
    reasonIcon
  }
}
