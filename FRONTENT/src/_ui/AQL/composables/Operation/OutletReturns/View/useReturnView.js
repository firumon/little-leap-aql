import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCurrency } from 'src/composables/useCurrency'
import { grandTotalOf } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
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

export function useReturnView () {
  const { resourceRecord } = useReturnViewContext()

  const { getOutlet } = useOutletResource()
  const { skuLabelText } = useSkuResource()
  const { getWarehouse } = useWarehouseResource()
  const { getPriceList } = usePriceListResource()
  const { _C } = useCurrency()

  const invoices = useRecord('OutletConsumptionInvoices')
  const invoiceItems = useRecord('OutletConsumptionInvoiceItems')
  // Both cards render NAMES, so the master rows they resolve from must be opened too.
  const warehouses = useRecord('Warehouses')
  const priceLists = useRecord('PriceList')

  const text = (value) => (value == null ? '' : String(value).trim())

  const record = computed(() => resourceRecord?.record?.value || null)
  const pending = computed(() => resourceRecord?.loading?.value === true)

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
    return text(getWarehouse(code)?.name) || code
  })

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
      // `buildReturnMarkInvoiceAdjustedNodes`. Saying so is more honest than a blank row.
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

  const sourceInvoice = computed(() => {
    const row = record.value
    const code = text(row?.SourceInvoiceCode)
    if (!code) return null

    const header = invoices.items.value.find((entry) => text(entry.Code) === code) || null
    const sku = text(row?.SKU)

    let qty = 0
    let unitPrice = null
    let lineTotal = 0
    for (const line of invoiceItems.items.value) {
      if (text(line.OutletConsumptionInvoiceCode) !== code) continue
      if (sku && text(line.SKU) !== sku) continue
      const lineQty = Number(line.Qty) || 0
      const linePrice = Number(line.Price) || 0
      qty += lineQty
      lineTotal += Number(line.Total) || lineQty * linePrice
      if (unitPrice === null) unitPrice = linePrice
    }

    const returnedQty = Math.abs(Number(row?.Qty) || 0)
    const returnedPrice = Number(row?.Price) || 0

    return {
      code,
      // Present even when the invoice rows have not loaded (or the bill was archived): the
      // CODE is on the return itself, and stating it beats hiding the whole card.
      found: !!header,
      date: text(header?.Date),
      username: text(header?.Username),
      priceListCode: text(header?.PriceListCode),
      priceListName: text(getPriceList(text(header?.PriceListCode))?.name) || text(header?.PriceListCode),
      invoiceTotal: header ? _C(grandTotalOf(header)) : '',
      billedQty: qty,
      billedUnitPrice: unitPrice === null ? '' : _C(unitPrice),
      billedLineTotal: _C(lineTotal),
      returnedQty,
      priceMatches: unitPrice === null || Math.abs(unitPrice - returnedPrice) < 0.005,
      overReturned: qty > 0 && returnedQty > qty
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
    sourceInvoice,
    invoiceResources: [invoices, invoiceItems, priceLists],
    warehouseResources: [warehouses],
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
