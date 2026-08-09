import { computed, inject, onMounted, watch } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'

/**
 * OutletRestocks › Edit — hydration + read-model behind `EditRestockHeader`.
 *
 * The Edit page contract deliberately drops the generic `Update` content, because
 * a restock must be edited through the same item cards the Add wizard uses, not
 * through a field-by-field form. `Update.vue` is also the component that normally
 * loads the server record and its child rows into pageState, so dropping it means
 * that hydration has to happen here instead — everything downstream
 * (`useRestockStockMatch`, `Edit/PageAction.js`) reads pageState and nothing else.
 *
 * Hydration is one-shot per (node instance, server record), keyed exactly the way
 * `Update.vue` keys it: a re-render must never clobber quantities the user has
 * already adjusted, but a node replacement (PageAction's reset) must re-seed.
 *
 * ONE reactive source of truth (ARCHITECTURE RULES §6): nothing here mirrors the
 * record into local refs — `outletName`/`restockDate`/`comment` are projections of
 * pageState plus the Outlets rows, and `setComment` writes straight back.
 */
const PARENT = 'OutletRestocks'
const CHILD = 'OutletRestockItems'

// Matches the normalizer in `useRestockStockMatch`, which is what will address
// these rows once they are in pageState — the two must agree on what "the same
// SKU" means or this dedupe would pass rows that the cards then merge anyway.
const skuKey = (value) => String(value ?? '').trim().toLowerCase()
const isActive = (row) => (row?.Status || 'Active') === 'Active'

export function useRestockEditForm () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)

  // Same accessor idiom as the Add wizard, so the whole restock flow reads
  // resources through `useRecord` and imports no store (ARCHITECTURE RULES §5).
  const outlets = useRecord('Outlets')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')
  const outletStorages = useRecord('OutletStorages')
  const warehouseStorages = useRecord('WarehouseStorages')

  const parent = pageState.useNode(PARENT)
  const serverRecord = computed(() => resourceRecord?.record?.value || null)

  // Identity of the pristine server record marks "a different record", exactly as
  // in Update.vue — the object reference, not its Code, which can repeat across
  // a refetch of the same row.
  let hydratedKey = ''
  let hydratedChildren = false

  function hydrate () {
    const record = serverRecord.value
    if (!pageState || !record) return

    if (!pageState.hasNode(PARENT)) {
      pageState.initResource(PARENT, { isPrimaryKey: true, reset: true, code: record.Code })
      hydratedChildren = false
    }
    if (!parent.exists.value) return

    const key = `${parent.identifier.value}::${record.Code || ''}::${recordId(record)}`
    if (key !== hydratedKey) {
      hydratedKey = key
      pageState.load(PARENT, record)
    }

    if (hydratedChildren) return
    const rows = (resourceRecord?.childRecordsByResource?.value || {})[CHILD]
    if (!Array.isArray(rows) || !rows.length) return
    hydratedChildren = true

    // One line per SKU. The item cards address a line BY SKU, so a second row for
    // the same SKU is a line the UI can never reach: the card reads the SKU's total
    // while the buttons edit a single line, so the surplus row survives every edit
    // and still rides along in the payload. An Active row wins over an
    // already-deactivated one; rows carrying no SKU are left alone, since nothing
    // addresses them by SKU in the first place.
    const primaryBySku = new Map()
    rows.forEach((row) => {
      const sku = skuKey(row.SKU)
      if (!sku) return
      const current = primaryBySku.get(sku)
      if (!current || (!isActive(current) && isActive(row))) primaryBySku.set(sku, row)
    })

    // Relation/metadata keys are non-enumerable, so the spread yields only schema
    // headers. `update` (not `create`) so GAS patches the existing lines.
    rows.forEach((row) => {
      const sku = skuKey(row.SKU)
      if (sku && primaryBySku.get(sku) !== row) return
      pageState.addChild(PARENT, CHILD, { ...row }, { action: 'update' })
    })
  }

  const recordIds = new WeakMap()
  let recordSeq = 0
  function recordId (record) {
    if (!recordIds.has(record)) recordIds.set(record, `rec-${++recordSeq}`)
    return recordIds.get(record)
  }

  watch(
    [serverRecord, () => parent.identifier.value, () => resourceRecord?.childRecordsByResource?.value],
    () => { hydrate() },
    { immediate: true }
  )

  onMounted(() => {
    // The item cards project (SKUs × Products × OutletStorages × pageState), so
    // those rows must be present or the Edit page renders two empty lists. Add
    // loads them at step 1; Edit has no step 1, so it loads them here.
    // `reload()` renders from whatever the store already holds and syncs the delta
    // in the background, so a warm cache shows the form immediately.
    ;[outlets, skus, products, outletStorages, warehouseStorages].forEach((resource) => resource.reload())
  })

  const outletCode = computed(() => parent.record.value.OutletCode || '')
  // Falls back to the code so the header never renders an empty line while the
  // Outlets rows are still syncing.
  const outletName = computed(() => {
    const code = outletCode.value
    if (!code) return '—'
    return outlets.items.value.find((row) => row.Code === code)?.Name || code
  })

  // The ORIGINAL request date, shown read-only. `Edit/PageAction.js` overwrites
  // the field with today's date on submit, so this reads the pristine server
  // record rather than the node it is about to stamp.
  const restockDate = computed(() => serverRecord.value?.Date || parent.record.value.Date || '—')
  const comment = computed(() => parent.record.value.ProgressSubmittedComment || '')

  function setComment (value) {
    pageState.setField(PARENT, 'ProgressSubmittedComment', value ?? '')
  }

  return { parent, outletCode, outletName, restockDate, comment, setComment }
}
