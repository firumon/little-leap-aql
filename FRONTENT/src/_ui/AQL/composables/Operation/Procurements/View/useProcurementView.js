import { computed, onMounted } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import {
  WORKFLOW_STATES,
  progressLabel,
  progressColor,
  progressIcon,
  progressOf,
  stageIndexOf,
  isTerminal,
  settledAt
} from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import { progressLabel as requisitionLabel, progressColor as requisitionColor } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'
import { progressLabel as rfqLabel, progressColor as rfqColor } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'
import { progressLabel as quotationLabel, progressColor as quotationColor } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'
import { progressLabel as orderLabel, progressColor as orderColor } from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'
import { progressLabel as receivingLabel, progressColor as receivingColor } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'
import { progressLabel as receiptLabel, progressColor as receiptColor, statusOf } from 'src/_resource/Operation/GoodsReceipts/composables/useGoodsReceiptProgress'
import { useProcurementViewContext } from './useProcurementViewContext'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

export { progressLabel, progressColor, progressIcon, WORKFLOW_STATES }

export function formatStampDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function useProcurementView () {
  const { resourceRecord } = useProcurementViewContext()

  const requisitions = useRecord('PurchaseRequisitions')
  const rfqs = useRecord('RFQs')
  const quotations = useRecord('SupplierQuotations')
  const purchaseOrders = useRecord('PurchaseOrders')
  const receivings = useRecord('POReceivings')
  const goodsReceipts = useRecord('GoodsReceipts')

  onMounted(() => {
    ;[requisitions, rfqs, quotations, purchaseOrders, receivings, goodsReceipts]
      .forEach((resource) => resource.reload())
  })

  const procurement = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true)
  const pending = computed(() => !procurement.value && loading.value)

  const code = computed(() => text(procurement.value?.Code))

  function linked (resource) {
    return resource.items.value
      .map(asRow)
      .filter((row) => text(row.ProcurementCode) === code.value && isActive(row))
  }

  // One row per child resource, so the reader sees the whole chain on one screen.
  const chain = computed(() => {
    if (!code.value) return []
    return [
      { title: 'Purchase Requisition', rows: linked(requisitions), label: requisitionLabel, color: requisitionColor, state: (row) => row.Progress },
      { title: 'RFQ', rows: linked(rfqs), label: rfqLabel, color: rfqColor, state: (row) => row.Progress },
      { title: 'Supplier Quotations', rows: linked(quotations), label: quotationLabel, color: quotationColor, state: (row) => row.Progress },
      { title: 'Purchase Orders', rows: linked(purchaseOrders), label: orderLabel, color: orderColor, state: (row) => row.Progress },
      { title: 'PO Receivings', rows: linked(receivings), label: receivingLabel, color: receivingColor, state: (row) => row.Progress },
      { title: 'Goods Receipts', rows: linked(goodsReceipts), label: receiptLabel, color: receiptColor, state: (row) => statusOf(row) }
    ]
      .filter((group) => group.rows.length)
      .map((group) => ({
        title: group.title,
        entries: group.rows.map((row) => ({
          code: text(row.Code),
          label: group.label(group.state(row)),
          color: group.color(group.state(row))
        }))
      }))
  })

  // Stages walked so far, in lifecycle order. Nothing beyond the current one is drawn.
  const stages = computed(() => {
    const current = progressOf(procurement.value)
    const reached = stageIndexOf(current)
    if (reached < 0) return []
    return WORKFLOW_STATES.slice(0, reached + 1).map((state) => ({
      state,
      label: progressLabel(state),
      color: progressColor(state),
      icon: progressIcon(state),
      current: state === current
    }))
  })

  const events = computed(() => stages.value.map((stage) => ({
    state: stage.state,
    title: stage.label,
    by: '',
    at: stage.current ? settledAt(procurement.value) : '',
    comment: '',
    icon: stage.icon,
    color: stage.color,
    label: stage.label
  })))

  const settled = computed(() => isTerminal(procurement.value))

  return {
    procurement,
    loading,
    pending,
    chain,
    stages,
    events,
    settled,
    progressLabel,
    progressColor,
    progressIcon,
    formatStampDate
  }
}
