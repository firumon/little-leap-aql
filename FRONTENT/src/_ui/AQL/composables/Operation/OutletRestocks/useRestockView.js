import { computed, inject, onMounted } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'

/**
 * OutletRestocks › View — the read-only aggregate behind the four `View/` cards.
 *
 * ONE reactive source of truth (ARCHITECTURE RULES §6). Every card on the View
 * page renders a projection of the SAME `productGroups` tree — the summary reads
 * its totals, the allocation card reads the bins beneath them — so "how much was
 * requested?" cannot be answered differently by two cards on one screen.
 *
 * Nothing here mutates: there is no plan, no selection and no pageState write.
 * The View page is a statement of what happened, and the actions that changed it
 * live under `Approve/` and `MarkDelivered/`.
 *
 * Named PURE exports first — importable from a page contract or a JS modifier
 * without a setup context; the composable wrapper follows (AQL_CUSTOM_UI_GUIDE §2.2).
 *
 * ISOLATION: imports nothing resource-specific — only `useRecord` and the injected
 * `resourceRecord` (ARCHITECTURE RULES §5).
 */

const PARENT = 'OutletRestocks'
const CHILD = 'OutletRestockItems'

const DEFAULT_STORAGE = '_default'
// Same default the approval and delivery aggregates state, for the same reason: a
// discrete count is what an unconfigured SKU is already treated as everywhere else.
const DEFAULT_UOM = 'PCS'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
// `useRecord().items` CAN CONTAIN `null` — see `useRestockApproval.js` for why. A
// null degrades to an empty row here and is then dropped by the field checks,
// rather than being waved through one guard and dereferenced by the next.
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'
const storageOf = (value) => text(value) || DEFAULT_STORAGE

/**
 * The presentation of every Progress value this page can render.
 *
 * ONE map for the request's own vocabulary (`OutletRestockProgress`) and the item
 * rows' (`OutletRestockItemProgress`) — the two share `DELIVERED` and `CANCELLED`
 * and must not be shown differently on the same screen. Keyed by the raw sheet
 * value, so a state added to `Constants.gs` shows up here as an unstyled grey
 * badge rather than an empty cell.
 */
const PROGRESS_META = {
  DRAFT: { label: 'Draft', color: 'grey-7', icon: 'edit_note' },
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'warning', icon: 'schedule' },
  REVISION_REQUIRED: { label: 'Revision Required', color: 'orange', icon: 'undo' },
  APPROVED: { label: 'Approved', color: 'primary', icon: 'check_circle' },
  PARTIALLY_DELIVERED: { label: 'Partially Delivered', color: 'info', icon: 'local_shipping' },
  DELIVERED: { label: 'Delivered', color: 'positive', icon: 'local_shipping' },
  REJECTED: { label: 'Rejected', color: 'negative', icon: 'cancel' },
  // Item-row states.
  PENDING: { label: 'Pending', color: 'warning', icon: 'schedule' },
  ALLOCATED: { label: 'Allocated', color: 'primary', icon: 'inventory_2' },
  CANCELLED: { label: 'Cancelled', color: 'negative', icon: 'block' }
}

const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

function progressMeta (state) {
  return PROGRESS_META[text(state)] || FALLBACK_META
}

export function progressLabel (state) {
  // An unmapped-but-present state states itself rather than reading as blank.
  return PROGRESS_META[text(state)]?.label || text(state) || FALLBACK_META.label
}
export function progressColor (state) {
  return progressMeta(state).color
}
export function progressIcon (state) {
  return progressMeta(state).icon
}

/**
 * The states in which a request has NOT yet been approved.
 *
 * Expressed as the unapproved set rather than the approved one deliberately: the
 * approved side keeps growing (`APPROVED`, `PARTIALLY_DELIVERED`, `DELIVERED`, and
 * whatever a later delivery stage adds), while the "no allocation exists yet" side
 * is a closed list. `isApproved` is the question the allocation card asks — has
 * stock been committed, so is there anything to show a warehouse for?
 */
export const UNAPPROVED_PROGRESS = ['DRAFT', 'PENDING_APPROVAL', 'REVISION_REQUIRED']

export function isApproved (record) {
  const progress = text(asRow(record).Progress)
  return !!progress && !UNAPPROVED_PROGRESS.includes(progress)
}

/**
 * The workflow stamp columns on `OutletRestocks`, in the order the request walks
 * through them.
 *
 * The column PREFIX is carried beside the state because the two genuinely differ:
 * submitting for approval moves the request to `PENDING_APPROVAL` but stamps
 * `ProgressSubmitted*` (Documents/OPERATION_SHEET_STRUCTURE.md). Deriving the
 * column from the state would silently read a column that does not exist.
 */
export const WORKFLOW_STAMPS = [
  { state: 'PENDING_APPROVAL', prefix: 'ProgressSubmitted', title: 'Submitted for Approval' },
  { state: 'REVISION_REQUIRED', prefix: 'ProgressRevisionRequired', title: 'Sent Back for Revision' },
  { state: 'APPROVED', prefix: 'ProgressApproved', title: 'Approved' },
  { state: 'REJECTED', prefix: 'ProgressRejected', title: 'Rejected' },
  { state: 'DELIVERED', prefix: 'ProgressDelivered', title: 'Delivered' }
]

export const WORKFLOW_STATES = WORKFLOW_STAMPS.map((stamp) => stamp.state)

/**
 * Every workflow event that has actually happened, oldest first.
 *
 * A stamp with no actor is a stage the request never reached, and is dropped —
 * the timeline shows history, not a checklist of what could still happen. Stamps
 * are written as ISO strings by `outletRestockPayload.js`; an unparseable one
 * sorts to the end rather than poisoning the comparison with `NaN`, and keeps its
 * raw text so a malformed stamp is visible instead of silently blank.
 */
export function workflowStamps (record) {
  const row = asRow(record)
  return WORKFLOW_STAMPS
    .map((stamp) => {
      const at = text(row[`${stamp.prefix}At`])
      const parsed = at ? new Date(at) : null
      return {
        state: stamp.state,
        title: stamp.title,
        by: text(row[`${stamp.prefix}By`]),
        at,
        comment: text(row[`${stamp.prefix}Comment`]),
        icon: progressIcon(stamp.state),
        color: progressColor(stamp.state),
        label: progressLabel(stamp.state),
        timestamp: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
      }
    })
    .filter((event) => event.by)
    .sort((a, b) => (a.timestamp?.getTime() ?? Infinity) - (b.timestamp?.getTime() ?? Infinity))
}

/** `2026-08-11T09:14:00.000Z` → `11 Aug 2026, 09:14`. Blank stays blank. */
export function formatStampDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

/**
 * A SKU's display name from its own row plus its product's.
 *
 * A SKU carries its variant VALUES in positional `Variant1..N` columns, and the
 * product names those positions through its `VariantTypes` CSV — so the values are
 * only meaningful in the product's order, which is why both rows are read. Capped
 * at five, matching the column set. Pure, so the lookup stays in the composable.
 */
export function skuLabelFrom (skuRow = {}, productRow = {}, fallback = '') {
  const sku = asRow(skuRow)
  const product = asRow(productRow)
  const code = text(fallback)
  const variantCount = text(product.VariantTypes)
    .split(',').map((label) => label.trim()).filter(Boolean).slice(0, 5).length
  const variants = Array.from({ length: variantCount }, (_, index) => text(sku[`Variant${index + 1}`]))
    .filter(Boolean)
    .join(' / ')
  return {
    primary: text(product.Name) || code,
    secondary: variants || code,
    // Falls back to the SKU so a SKU with no product still forms its own group
    // rather than collapsing every orphan into one nameless card.
    productCode: text(product.Code) || code,
    uom: text(sku.UOM) || DEFAULT_UOM
  }
}

/**
 * Fold the request's item rows into the Product → SKU → bin tree every card reads.
 *
 * ALL active rows are folded, whatever their Progress: the summary states what was
 * requested, and after approval a requested line exists only as the sum of its
 * ALLOCATED bins plus whatever remainder stayed PENDING. Filtering by Progress
 * here would make an approved request's totals disagree with the same request's
 * totals before approval.
 *
 * `label(sku)` is injected rather than resolved here so this stays pure. Insertion
 * order is preserved throughout — groups follow the order the items were requested
 * in, not an arbitrary re-sort.
 */
export function groupViewRows (rows = [], label = () => ({}), warehouseName = (code) => code) {
  const products = new Map()

  ;(Array.isArray(rows) ? rows : []).map(asRow).forEach((row) => {
    const code = text(row.Code)
    if (!code) return
    const sku = text(row.SKU)
    const info = label(sku) || {}
    const productCode = text(info.productCode) || sku || code
    const uom = text(info.uom) || DEFAULT_UOM

    if (!products.has(productCode)) {
      products.set(productCode, {
        productCode,
        productName: text(info.primary) || productCode,
        uom,
        skus: [],
        quantity: 0
      })
    }
    const product = products.get(productCode)

    let group = product.skus.find((entry) => entry.sku === sku)
    if (!group) {
      group = {
        key: `${productCode}:${sku}`,
        sku,
        productCode,
        productName: product.productName,
        label: text(info.secondary) || sku,
        uom,
        quantity: 0,
        rows: [],
        states: []
      }
      product.skus.push(group)
    }

    const quantity = num(row.Quantity)
    const progress = text(row.Progress) || 'PENDING'
    group.rows.push({
      code,
      warehouseCode: text(row.WarehouseCode),
      warehouseName: text(row.WarehouseCode) ? warehouseName(row.WarehouseCode) : '',
      storageName: text(row.WarehouseCode) ? storageOf(row.StorageName) : '',
      quantity,
      uom,
      progress
    })
    group.quantity += quantity
    if (!group.states.includes(progress)) group.states.push(progress)
    product.quantity += quantity
  })

  return Array.from(products.values())
}

export function useRestockView () {
  const resourceRecord = inject('resourceRecord', null)

  // Same accessor idiom as the rest of the restock flow, so this file imports no
  // store (ARCHITECTURE RULES §5).
  const restockItems = useRecord(CHILD)
  const outlets = useRecord('Outlets')
  const warehouses = useRecord('Warehouses')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  onMounted(() => {
    // A view route loads the record and its relations, but NOT the SKUs ×
    // Products × Warehouses the labelling projects over. `reload()` renders from
    // whatever the store already holds and syncs the delta in the background, so
    // a warm cache shows the page immediately.
    ;[restockItems, outlets, warehouses, skus, products].forEach((resource) => resource.reload())
  })

  const restock = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true)
  const pending = computed(() => !restock.value && loading.value)

  const outletName = computed(() => {
    const code = text(restock.value?.OutletCode)
    if (!code) return ''
    const match = outlets.items.value.find((row) => text(asRow(row).Code) === code)
    return text(asRow(match).Name) || code
  })

  function warehouseName (code) {
    const match = warehouses.items.value.find((row) => text(asRow(row).Code) === text(code))
    return text(asRow(match).Name) || text(code)
  }

  function skuLabel (sku) {
    const code = text(sku)
    if (!code) return { primary: 'Item', secondary: '', productCode: '', uom: DEFAULT_UOM }
    const skuRow = asRow(skus.items.value.find((row) => text(asRow(row).Code) === code))
    const productRow = asRow(products.items.value.find((row) => text(asRow(row).Code) === text(skuRow.ProductCode)))
    return skuLabelFrom(skuRow, productRow, code)
  }

  // Read from the resource rows rather than `childRecordsByResource`, so rows
  // written by an allocation or a delivery show up without a full relation reload.
  const items = computed(() => {
    const code = text(restock.value?.Code)
    if (!code) return []
    return restockItems.items.value
      .map(asRow)
      .filter((row) => text(row.OutletRestockCode) === code && isActive(row) && text(row.Code))
  })

  const productGroups = computed(() => groupViewRows(items.value, skuLabel, warehouseName))

  const approved = computed(() => isApproved(restock.value))
  const events = computed(() => workflowStamps(restock.value))

  return {
    // context
    restock,
    loading,
    pending,
    outletName,
    approved,
    // rows
    items,
    productGroups,
    skuLabel,
    warehouseName,
    // workflow
    events,
    // presentation
    progressLabel,
    progressColor,
    progressIcon,
    formatStampDate
  }
}
